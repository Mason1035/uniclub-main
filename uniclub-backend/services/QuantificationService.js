const mongoose = require('mongoose');
const Repository = require('./QuantificationRepository');
const createStorageAdapter = require('./storage');
const StorageSettings = require('./QuantificationStorageSettings');
const { MAX_FILE_BYTES, PART_BYTES, fail, assertId, assertOpen, availability, validateCollection, validateFile, safeKey, safeMaterialKey, verifyZip } = require('../utils/quantificationPolicy');

const idOf = (doc) => String(doc._id);
const publicSubmission = (s) => s ? ({ id: idOf(s), collectionId: String(s.collectionId), originalFilename: s.originalFilename, fileSize: s.fileSize, mimeType: s.mimeType, status: s.status, version: s.version, submittedAt: s.submittedAt }) : null;
const publicUpload = (u) => u ? ({ id: idOf(u), originalFilename: u.originalFilename, fileSize: u.fileSize, state: u.state, expiresAt: u.expiresAt }) : null;

class QuantificationService {
  constructor({ repository = new Repository(), storage, settings, storageFactory = createStorageAdapter, now = () => new Date() } = {}) {
    this.repo = repository;
    this.settings = settings || (storage ? null : new StorageSettings());
    this.fixedStorage = Boolean(storage);
    this.storageFactory = storageFactory;
    this.storage = storage || storageFactory(this.settings.environment());
    this.now = now;
  }
  // Each operation uses one immutable configuration snapshot. Configuration
  // changes cannot race an upload, confirmation, download or cleanup in flight.
  async run(operation) {
    const release = this.settings?.enterOperation();
    try {
      const scoped = this.fixedStorage ? this : new QuantificationService({ repository: this.repo, storage: this.storageFactory(this.settings.environment()), settings: this.settings, now: this.now });
      return await operation(scoped);
    } finally { release?.(); }
  }
  storageConfig() {
    if (!this.settings) fail(503, '当前服务未启用网页存储配置。');
    return this.settings.view();
  }
  async saveStorageConfig(body, actor) {
    if (!this.settings) fail(503, '当前服务未启用网页存储配置。');
    return this.settings.save(body, actor, () => this.repo.hasStorageRecords());
  }
  async testStorageConfig() {
    if (!this.storage.testConnection) fail(400, '请先保存云函数配置，再检查连接。');
    return this.storage.testConnection();
  }
  describeCollection(c) { return { id: idOf(c), title: c.title, description: c.description, startAt: c.startAt, deadline: c.deadline, status: c.status, availability: availability(c, this.now()), createdAt: c.createdAt }; }
  async collection(id, admin = false) {
    assertId(id);
    const c = await this.repo.getCollection(id);
    if (!c || (!admin && c.status === 'draft')) fail(404, '收集期不存在或尚未发布。');
    return c;
  }
  async collections(admin = false) {
    const items = await this.repo.listCollections(admin);
    return { collections: items.map(c => this.describeCollection(c)), storage: this.storage.describe(), limits: { maxFileBytes: MAX_FILE_BYTES, partBytes: PART_BYTES } };
  }
  async access(userId) { const u = await this.repo.getUser(userId); return { canManage: u?.isAdmin === true }; }
  async createCollection(body, userId) { return this.describeCollection(await this.repo.createCollection({ ...validateCollection(body), createdBy: userId })); }
  async editCollection(id, body) {
    const c = await this.collection(id, true);
    return this.describeCollection(await this.repo.updateCollection(id, validateCollection(body, c)));
  }
  async mine(collectionId, userId) {
    const c = await this.collection(collectionId);
    const [submission, upload] = await Promise.all([this.repo.getSubmission(userId, collectionId), this.repo.getPendingUpload(userId, collectionId, this.now())]);
    return { collection: this.describeCollection(c), submission: publicSubmission(submission), pendingUpload: publicUpload(upload) };
  }
  assertStorage() { if (!this.storage.describe().configured) fail(503, '文件存储尚未配置，请联系管理员后再上传。', 'STORAGE_UNCONFIGURED'); }
  async initUpload(collectionId, userId, body) {
    const file = validateFile(body);
    const c = await this.collection(collectionId);
    assertOpen(c, this.now());
    this.assertStorage();
    const current = await this.repo.getSubmission(userId, collectionId);
    const id = String(new mongoose.Types.ObjectId());
    const prefix = `${this.storage.directoryPrefix || 'quantification/'}${collectionId}/${userId}`;
    const directKey = this.storage.uploadKey?.(file.originalFilename);
    if (directKey) await this.storage.assertAvailable(directKey);
    const u = await this.repo.createUpload({ _id: id, collectionId, user: userId, ...file,
      stagingKey: directKey || `${prefix}/staging/${id}.zip`, finalKey: directKey || `${prefix}/submitted/${id}.zip`, previousKey: current?.storageKey || '', baseVersion: current?.version || 0,
      expiresAt: new Date(this.now().getTime() + 2 * 60 * 60 * 1000), state: 'pending' });
    try {
      const credentials = await this.storage.credentials(u.stagingKey);
      const multipartId = file.fileSize > PART_BYTES ? await this.storage.initiateUpload(u.stagingKey, id) : '';
      await this.repo.updateUpload(id, { multipartId, credentialExpiresAt: new Date(credentials.ExpiredTime * 1000) });
      return { upload: publicUpload(u), target: this.storage.uploadTarget(u.stagingKey, multipartId, PART_BYTES), credentials };
    } catch (error) {
      await this.repo.updateUpload(id, { state: 'aborted', cleanupAfter: new Date(this.now().getTime() + 2 * 60 * 60 * 1000) });
      throw error;
    }
  }
  async ownedUpload(id, userId) {
    assertId(id);
    const u = await this.repo.getUpload(id);
    if (!u || String(u.user) !== userId) fail(404, '上传记录不存在。');
    return u;
  }
  async credentials(id, userId) {
    const u = await this.ownedUpload(id, userId);
    const c = await this.collection(String(u.collectionId));
    assertOpen(c, this.now());
    if (u.state !== 'pending' || new Date(u.expiresAt) <= this.now()) fail(409, '上传会话已经结束，请重新选择文件。');
    const credentials = await this.storage.credentials(u.stagingKey);
    await this.repo.updateUpload(id, { credentialExpiresAt: new Date(credentials.ExpiredTime * 1000) });
    return { credentials };
  }
  async authorizeUpload(id, userId, body) {
    const { assertFields } = require('../utils/quantificationPolicy');
    assertFields(body, ['partNumber']);
    const u = await this.ownedUpload(id, userId);
    assertOpen(await this.collection(String(u.collectionId)), this.now());
    if (u.state !== 'pending' || new Date(u.expiresAt) <= this.now()) fail(409, '上传会话已经结束，请重新提交。');
    if (!this.storage.authorizeUpload) fail(400, '当前存储方式不使用云函数上传签名。');
    const part = body.partNumber;
    if (u.multipartId ? !Number.isInteger(part) || part < 1 || part > Math.ceil(u.fileSize / PART_BYTES) : part !== null) fail(400, '上传分片编号无效。');
    const authorization = await this.storage.authorizeUpload(u.stagingKey, u.multipartId, part, idOf(u));
    await this.repo.updateUpload(id, { credentialExpiresAt: new Date(authorization.expiresAt) });
    return authorization;
  }
  async parts(id, userId) {
    const u = await this.ownedUpload(id, userId);
    assertOpen(await this.collection(String(u.collectionId)), this.now());
    if (u.state !== 'pending' || new Date(u.expiresAt) <= this.now()) fail(409, '上传会话已经结束，请重新提交。');
    return { parts: u.multipartId ? await this.storage.listParts(u.stagingKey, u.multipartId) : [] };
  }
  cleanupTime(u) { return new Date(Math.max(this.now().getTime() + 15 * 60 * 1000, new Date(u.credentialExpiresAt || u.expiresAt).getTime() + 5 * 60 * 1000)); }
  async finish(u, oldKey) {
    await this.repo.updateUpload(idOf(u), { state: 'confirmed', confirmedAt: this.now(), confirmLeaseUntil: null,
      cleanupAfter: this.cleanupTime(u), cleanupKeys: [...new Set([u.stagingKey, ...(oldKey && oldKey !== u.finalKey ? [oldKey] : [])])] });
  }
  async confirm(id, userId) {
    const u = await this.ownedUpload(id, userId);
    const current = await this.repo.getSubmission(userId, String(u.collectionId));
    // Recover a committed submission when its response or session update was lost.
    if (current && String(current.upload) === idOf(u)) { await this.finish(u, u.previousKey); return { submission: publicSubmission(current) }; }
    if (u.state === 'confirmed') fail(409, '本次上传已经确认，当前材料可能已被后续提交替换。', 'ALREADY_REPLACED');
    if (['aborted', 'expired'].includes(u.state) || new Date(u.expiresAt) <= this.now()) fail(409, '上传会话已结束，请重新提交。', 'UPLOAD_EXPIRED');
    const c = await this.collection(String(u.collectionId));
    assertOpen(c, this.now());
    this.assertStorage();
    // Native COS isolates each confirmation copy. SCF keeps original filenames;
    // its adapter prevents overwrites and binds flat objects to their upload.
    const confirmationId = String(new mongoose.Types.ObjectId());
    if (!safeKey(u.stagingKey) && !(this.storage.uploadKey && safeMaterialKey(u.stagingKey))) fail(400, '上传路径无效。');
    const finalKey = this.storage.confirmationTarget ? this.storage.confirmationTarget(u.stagingKey, u.originalFilename) : u.stagingKey.replace(/staging\/[a-f\d]{24}\.zip$/, `submitted/${confirmationId}.zip`);
    const locked = await this.repo.claimUpload(id, this.now(), finalKey, confirmationId);
    if (!locked) fail(409, '正在确认这份材料，请稍后重新确认。', 'CONFIRMING');
    let sealStarted = false;
    try {
      let head;
      try { head = await this.storage.headObject(u.stagingKey); }
      catch (error) {
        if (error.status !== 404 || !u.multipartId) throw error;
        await this.storage.completeMultipart(u.stagingKey, u.multipartId, u.fileSize, PART_BYTES);
        head = await this.storage.headObject(u.stagingKey);
      }
      if (head.fileSize !== u.fileSize || head.fileSize > MAX_FILE_BYTES || !head.etag || !['application/zip', 'application/x-zip-compressed', 'application/octet-stream'].includes(head.mimeType.split(';')[0])) fail(400, '实际文件大小或类型与上传记录不一致，请重新提交。', 'OBJECT_MISMATCH');
      if (this.storage.uploadKey && safeMaterialKey(u.stagingKey) && head.uploadId !== idOf(u)) fail(409, '桶内文件不属于本次上传，请重新选择文件提交。', 'OBJECT_MISMATCH');
      await verifyZip(this.storage, u.stagingKey, u.fileSize, head.etag);
      sealStarted = true;
      const sealed = locked.finalKey === u.stagingKey ? head : await this.storage.sealObject(u.stagingKey, locked.finalKey, head.etag, idOf(u));
      if (sealed.fileSize !== u.fileSize || !sealed.etag) fail(502, '正式文件校验失败，请重新确认。');
      // Recheck the actual period after cloud operations, immediately before commit.
      assertOpen(await this.collection(String(u.collectionId)), this.now());
      if (new Date(u.expiresAt) <= this.now()) fail(409, '上传会话已结束，请重新提交。', 'UPLOAD_EXPIRED');
      if (!await this.repo.renewConfirmation(id, confirmationId, this.now())) fail(409, '本次确认已超时或已由另一请求接续，请重新确认。', 'CONFIRMATION_EXPIRED');
      const submission = await this.repo.saveSubmission({ user: u.user, collectionId: u.collectionId, upload: u._id,
        originalFilename: u.originalFilename, storageKey: locked.finalKey, fileSize: u.fileSize, mimeType: 'application/zip', etag: sealed.etag, status: 'submitted', submittedAt: this.now() }, u.baseVersion);
      if (!submission) fail(409, '已有更新的材料提交成功，本次上传不会覆盖它。请刷新查看当前材料。', 'VERSION_CONFLICT');
      // Keep the old key in the durable cleanup record before reporting success.
      try { await this.finish(locked, u.previousKey); }
      catch { /* A retry recovers the current submission; expired upload cleanup is also safe. */ }
      return { submission: publicSubmission(submission) };
    } catch (error) {
      await this.repo.releaseUpload(id, confirmationId);
      // A late cloud copy can finish after an earlier cleanup. Retain another
      // cleanup pass without changing a concurrent request's state or lease.
      if (sealStarted) await this.repo.deferCleanup(id, this.cleanupTime(u));
      throw error;
    }
  }
  async abort(id, userId) {
    const u = await this.ownedUpload(id, userId);
    if (u.state === 'confirmed') fail(409, '已经提交的材料不能通过取消上传删除。');
    const result = await this.repo.abortUpload(id, { state: 'aborted', cleanupAfter: this.cleanupTime(u) });
    if (!result && u.state !== 'aborted') fail(409, '材料正在确认，暂时不能取消。');
    if (u.multipartId && this.storage.describe().configured) { try { await this.storage.abortMultipart(u.stagingKey, u.multipartId); } catch { /* Durable cleanup retries. */ } }
    return { cancelled: true };
  }
  async download(id, userId, admin = false) {
    assertId(id);
    const s = await this.repo.getSubmissionById(id);
    if (!s || (!admin && String(s.user) !== userId)) fail(404, '材料不存在或不属于当前账号。');
    this.assertStorage();
    const head = await this.storage.headObject(s.storageKey);
    if (head.fileSize !== s.fileSize || head.etag !== s.etag) fail(409, '存储文件与提交记录不一致，请联系管理员。', 'OBJECT_CHANGED');
    return { submissionId: id, originalFilename: s.originalFilename, url: await this.storage.downloadUrl(s.storageKey, s.originalFilename), expiresAt: new Date(this.now().getTime() + 300000) };
  }
  async bulkDownload(ids, userId) {
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 50 || ids.some(id => typeof id !== 'string')) fail(400, '请一次选择 1 至 50 份材料。');
    const links = [];
    const errors = [];
    for (const id of [...new Set(ids)]) {
      try { links.push(await this.download(id, userId, true)); }
      catch (error) { errors.push({ submissionId: id, error: error.status ? error.message : '暂时无法下载这份材料。' }); }
    }
    return { links, errors };
  }
  async storageFiles() {
    this.assertStorage();
    if (!this.storage.listFiles) fail(400, '请保存云函数配置后查看存储桶材料。');
    const files = await this.storage.listFiles();
    const uploads = this.repo.getStorageUploads ? await this.repo.getStorageUploads(files.map(file => file.key)) : [];
    const byKey = new Map(uploads.map(upload => [upload.stagingKey, upload]));
    const available = new Set(files.map(file => file.key));
    const rows = files.filter(file => {
      const upload = byKey.get(file.key);
      return !(upload?.state === 'confirmed' && upload.finalKey !== file.key && available.has(upload.finalKey));
    }).map(file => {
      const upload = byKey.get(file.key);
      return { ...file, name: upload?.originalFilename || file.name,
        legacyPath: file.key.includes('/staging/'), pending: Boolean(upload && ['pending', 'confirming'].includes(upload.state)) };
    });
    return { prefix: this.storage.directoryPrefix, count: rows.length, files: rows, retainedCopies: files.length - rows.length, refreshedAt: this.now() };
  }
  async storageDownloads(keys) {
    this.assertStorage();
    if (!this.storage.listFiles || !Array.isArray(keys) || keys.length < 1 || keys.length > 50 || keys.some(key => typeof key !== 'string')) fail(400, '请一次选择 1 至 50 份存储桶材料。');
    const available = new Map((await this.storageFiles()).files.map(file => [file.key, file]));
    const links = [], errors = [];
    for (const key of [...new Set(keys)]) {
      if (!available.has(key)) { errors.push({ submissionId: key, error: '材料不在当前上传目录中，或文件已经不存在。' }); continue; }
      try {
        const filename = available.get(key).name.split('/').at(-1);
        links.push({ submissionId: key, originalFilename: filename, url: await this.storage.downloadUrl(key, filename), expiresAt: new Date(this.now().getTime() + 300000) });
      } catch (error) { errors.push({ submissionId: key, error: error.status ? error.message : '暂时无法下载这份材料。' }); }
    }
    return { links, errors };
  }
  async overview(collectionId, query = {}) {
    const c = await this.collection(collectionId, true);
    const [roster, users, submissions] = await Promise.all([this.repo.getRoster(), this.repo.getUsers(), this.repo.listSubmissions(collectionId)]);
    const usersByStudentId = new Map(users.map(u => [u.uniqueId, u]));
    const usersById = new Map(users.map(u => [idOf(u), u]));
    const byUser = new Map(submissions.map(s => [String(s.user), s]));
    const rosterUserIds = new Set();
    const rows = roster.map(entry => {
      const user = usersByStudentId.get(entry.uniqueId);
      if (user) rosterUserIds.add(idOf(user));
      return { id: `roster-${idOf(entry)}`, name: entry.name, studentId: entry.uniqueId, registered: Boolean(user), outsideRoster: false, submission: publicSubmission(user ? byUser.get(idOf(user)) : null) };
    });
    const submitted = rows.filter(r => r.submission).length;
    for (const s of submissions) {
      if (rosterUserIds.has(String(s.user))) continue;
      const u = usersById.get(String(s.user));
      rows.push({ id: `extra-${String(s.user)}`, name: u?.name || '账号已删除', studentId: u?.uniqueId || '', registered: Boolean(u), outsideRoster: true, submission: publicSubmission(s) });
    }
    const keyword = String(query.search || '').trim().toLocaleLowerCase().slice(0, 100);
    const status = ['submitted', 'missing'].includes(query.status) ? query.status : 'all';
    const filtered = rows.filter(row => (!keyword || `${row.name} ${row.studentId} ${row.submission?.originalFilename || ''}`.toLocaleLowerCase().includes(keyword)) &&
      (status === 'all' || (status === 'submitted' ? Boolean(row.submission) : !row.submission)));
    const sort = ['name', 'studentId', 'submittedAt', 'fileSize'].includes(query.sort) ? query.sort : 'studentId';
    const direction = query.direction === 'desc' ? -1 : 1;
    filtered.sort((a, b) => {
      const x = sort === 'submittedAt' ? new Date(a.submission?.submittedAt || 0).getTime() : sort === 'fileSize' ? a.submission?.fileSize || 0 : a[sort];
      const y = sort === 'submittedAt' ? new Date(b.submission?.submittedAt || 0).getTime() : sort === 'fileSize' ? b.submission?.fileSize || 0 : b[sort];
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'zh-CN', { numeric: true })) * direction || a.id.localeCompare(b.id);
    });
    const limit = Math.max(1, Math.min(50, parseInt(query.limit, 10) || 20));
    const pages = Math.max(1, Math.ceil(filtered.length / limit));
    const page = Math.min(pages, Math.max(1, parseInt(query.page, 10) || 1));
    return { collection: this.describeCollection(c), rows: filtered.slice((page - 1) * limit, page * limit), summary: { total: roster.length, submitted, missing: roster.length - submitted, outsideRoster: rows.length - roster.length }, pagination: { page, limit, total: filtered.length, pages } };
  }
  async cleanup() {
    if (!this.storage.describe().configured) return { processed: 0, failed: 0, configured: false };
    const candidates = await this.repo.cleanupCandidates(this.now());
    let processed = 0, failed = 0;
    for (const candidate of candidates) {
      const u = await this.repo.claimCleanup(idOf(candidate), this.now());
      if (!u) continue;
      try {
        const keys = new Set([u.stagingKey, u.finalKey, u.previousKey, ...(u.sealedKeys || []), ...(u.cleanupKeys || [])].filter(Boolean));
        for (const key of this.storage.retainObjects ? [] : keys) {
          if (!safeKey(key)) fail(400, '清理路径无效。');
          if (await this.repo.isCurrentKey(key)) continue;
          await this.storage.deleteObject(key);
        }
        await this.storage.abortMultipart(u.stagingKey, u.multipartId);
        await this.repo.updateUpload(idOf(u), { cleanedAt: this.now(), cleanupLeaseUntil: null, state: ['pending', 'confirming'].includes(u.state) ? 'expired' : u.state });
        processed++;
      } catch {
        await this.repo.updateUpload(idOf(u), { cleanupLeaseUntil: null, cleanupAfter: new Date(this.now().getTime() + 15 * 60 * 1000) });
        failed++;
      }
    }
    return { processed, failed, configured: true, retainedFiles: Boolean(this.storage.retainObjects) };
  }
}
module.exports = QuantificationService;
