const { randomBytes, createHash } = require('node:crypto');
const { fail, PART_BYTES } = require('../../utils/quantificationPolicy');
const ids = { member: '111111111111111111111111', admin: '222222222222222222222222', other: '333333333333333333333333', collection: 'aaaaaaaaaaaaaaaaaaaaaaaa' };
const copy = value => value == null ? value : structuredClone(value);
const objectId = () => randomBytes(12).toString('hex');
const emptyZip = () => { const b = Buffer.alloc(22); b.writeUInt32LE(0x06054b50); return b; };

class MemoryRepository {
  constructor(clock) { this.clock = clock; this.reset(); }
  reset() {
    this.collections = new Map([[ids.collection, { _id: ids.collection, title: '测试收集期（隔离测试）', description: '不是真实班级内容', startAt: null, deadline: new Date(this.clock().getTime() + 3600000), status: 'open', createdAt: this.clock() }]]);
    this.users = new Map(Object.entries(ids).filter(([key]) => key !== 'collection').map(([key, id]) => [id, { _id: id, name: `测试${key}`, uniqueId: `TEST-${key}`, email: `${key}@example.test`, isAdmin: key === 'admin', tokenVersion: 0 }]));
    this.roster = [{ _id: objectId(), name: '测试成员', uniqueId: 'TEST-member', email: 'member@example.test' }, { _id: objectId(), name: '未注册测试成员', uniqueId: 'TEST-unregistered', email: 'unregistered@example.test' }];
    this.uploads = new Map(); this.submissions = new Map(); this.failSave = false; this.failFinish = false;
  }
  async listCollections(admin) { return [...this.collections.values()].filter(c => admin || c.status !== 'draft').map(copy); }
  async getCollection(id) { return copy(this.collections.get(id)); }
  async createCollection(data) { const c = { _id: objectId(), createdAt: this.clock(), ...data }; this.collections.set(c._id, c); return copy(c); }
  async updateCollection(id, data) { Object.assign(this.collections.get(id), data); return this.getCollection(id); }
  async getUser(id) { return copy(this.users.get(id)); }
  async getRoster() { return copy(this.roster); }
  async getUsers() { return [...this.users.values()].map(copy); }
  async getSubmission(user, collection) { return copy([...this.submissions.values()].find(s => String(s.user) === String(user) && String(s.collectionId) === String(collection))); }
  async getSubmissionById(id) { return copy(this.submissions.get(id)); }
  async listSubmissions(collection) { return [...this.submissions.values()].filter(s => String(s.collectionId) === collection).map(copy); }
  async createUpload(data) { const u = { createdAt: this.clock(), multipartId: '', cleanupKeys: [], previousKey: '', cleanedAt: null, ...data }; this.uploads.set(u._id, u); return copy(u); }
  async getStorageUploads(keys) { return [...this.uploads.values()].filter(u => keys.includes(u.stagingKey)).map(copy); }
  async getUpload(id) { return copy(this.uploads.get(id)); }
  async getPendingUpload(user, collection, now) { return copy([...this.uploads.values()].filter(u => String(u.user) === user && String(u.collectionId) === collection && ['pending', 'confirming'].includes(u.state) && u.expiresAt > now).at(-1)); }
  async updateUpload(id, data) { if (this.failFinish && data.state === 'confirmed') throw new Error('Test persistence failure'); Object.assign(this.uploads.get(id), copy(data)); return this.getUpload(id); }
  async claimUpload(id, now, finalKey, confirmationId) { const u = this.uploads.get(id); if (!u || (u.state !== 'pending' && !(u.state === 'confirming' && u.confirmLeaseUntil < now))) return null; u.state = 'confirming'; u.finalKey = finalKey; u.confirmationId = confirmationId; u.sealedKeys = [...(u.sealedKeys || []), finalKey]; u.confirmLeaseUntil = new Date(now.getTime() + 300000); return copy(u); }
  async releaseUpload(id, confirmationId) { const u = this.uploads.get(id); if (u?.state === 'confirming' && u.confirmationId === confirmationId) { u.state = 'pending'; u.confirmLeaseUntil = null; } }
  async renewConfirmation(id, confirmationId, now) { const u = this.uploads.get(id); if (!u || u.state !== 'confirming' || u.confirmationId !== confirmationId || u.expiresAt <= now || u.confirmLeaseUntil <= now || u.cleanupLeaseUntil > now) return null; u.confirmLeaseUntil = new Date(now.getTime() + 300000); return copy(u); }
  async deferCleanup(id, after) { const u = this.uploads.get(id); u.cleanedAt = null; u.cleanupAfter = copy(after); }
  async saveSubmission(data, version) {
    if (this.failSave) throw new Error('Test database failure');
    const previous = [...this.submissions.values()].find(s => String(s.user) === String(data.user) && String(s.collectionId) === String(data.collectionId));
    if ((previous?.version || 0) !== version) return null;
    const next = { _id: previous?._id || objectId(), ...copy(data), version: version + 1 };
    this.submissions.set(next._id, next); return copy(next);
  }
  async abortUpload(id, data) { const u = this.uploads.get(id); if (u?.state !== 'pending') return null; Object.assign(u, copy(data)); return copy(u); }
  async cleanupCandidates(now) { return [...this.uploads.values()].filter(u => !u.cleanedAt && (!u.credentialExpiresAt || u.credentialExpiresAt < now) &&
    ((['confirmed', 'aborted', 'expired'].includes(u.state) && u.cleanupAfter <= now) || (['pending', 'confirming'].includes(u.state) && u.expiresAt < now && (!u.confirmLeaseUntil || u.confirmLeaseUntil < now))) && (!u.cleanupLeaseUntil || u.cleanupLeaseUntil < now)).map(copy); }
  async claimCleanup(id, now) { const u = this.uploads.get(id); if (!(await this.cleanupCandidates(now)).some(item => item._id === id)) return null; u.cleanupLeaseUntil = new Date(now.getTime() + 180000); return copy(u); }
  async isCurrentKey(key) { return [...this.submissions.values()].some(s => s.storageKey === key); }
}

class MemoryStorage {
  constructor(clock) { this.clock = clock; this.config = { bucket: 'classhub-verification-1234567890', region: 'ap-guangzhou' }; this.reset(); }
  reset() { this.objects = new Map(); this.multipart = new Map(); this.calls = []; this.configured = true; this.beforeSeal = null; this.failDelete = false; }
  describe() { return { provider: 'cos', configured: this.configured }; }
  uploadTarget(key, multipartId, partBytes) { return { provider: 'cos', ...this.config, key, multipartId, partBytes }; }
  async credentials(key) { this.calls.push(['credentials', key]); return { TmpSecretId: 'isolated-test-temporary-id', TmpSecretKey: 'isolated-test-temporary-key', SecurityToken: 'isolated-test-session-token', StartTime: Math.floor(this.clock().getTime() / 1000), ExpiredTime: Math.floor(this.clock().getTime() / 1000) + 1800, ScopeLimit: true }; }
  put(key, body = emptyZip(), metadata = {}) { const bytes = Buffer.from(body); this.objects.set(key, { body: bytes, fileSize: bytes.length, mimeType: 'application/zip', etag: `"${createHash('sha256').update(bytes).digest('hex')}"`, ...metadata }); }
  async initiateUpload(key) { const id = objectId(); this.multipart.set(id, { key, parts: new Map() }); return id; }
  async listParts(key, id) { const upload = this.multipart.get(id); if (!upload || upload.key !== key) fail(404, '测试分片不存在。'); return [...upload.parts].map(([n, b]) => ({ partNumber: n, size: b.length, etag: `"test-part-${n}"` })); }
  async completeMultipart(key, id, size, partBytes = PART_BYTES) { const parts = await this.listParts(key, id); if (parts.length !== Math.ceil(size / partBytes) || parts.some(p => p.size !== Math.min(partBytes, size - (p.partNumber - 1) * partBytes))) fail(409, '分片不完整。', 'PARTS_INCOMPLETE'); const m = this.multipart.get(id); this.put(key, Buffer.concat([...m.parts].sort((a,b) => a[0]-b[0]).map(([, b]) => b))); this.multipart.delete(id); }
  async headObject(key) { this.calls.push(['head', key]); const o = this.objects.get(key); if (!o) fail(404, '文件尚未上传完成。', 'OBJECT_MISSING'); return { fileSize: o.fileSize, mimeType: o.mimeType, etag: o.etag }; }
  async readRange(key, start, end, etag) { const o = this.objects.get(key); if (!o || o.etag !== etag) fail(409, '文件发生变化。', 'OBJECT_CHANGED'); return o.body.subarray(start, end + 1); }
  async sealObject(source, target, etag) { if (this.beforeSeal) await this.beforeSeal(); const o = this.objects.get(source); if (!o || o.etag !== etag) fail(409, '文件发生变化。', 'OBJECT_CHANGED'); this.put(target, o.body, { fileSize: o.fileSize, mimeType: o.mimeType }); this.calls.push(['seal', source, target]); return this.headObject(target); }
  async downloadUrl(key) { this.calls.push(['download', key]); return `https://storage.example.test/${key}?isolated-test-signature`; }
  async deleteObject(key) { if (this.failDelete) throw new Error('Test delete failure'); this.calls.push(['delete', key]); this.objects.delete(key); }
  async abortMultipart(key, id) { if (this.multipart.get(id)?.key === key) this.multipart.delete(id); }
}
module.exports = { ids, emptyZip, MemoryRepository, MemoryStorage };
