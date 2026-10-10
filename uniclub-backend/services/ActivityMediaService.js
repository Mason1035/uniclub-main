const mongoose = require('mongoose');
const ActivityMedia = require('../models/ActivityMedia');
const Event = require('../models/Event');
const User = require('../models/User');
const StorageSettings = require('./QuantificationStorageSettings');
const ActivityMediaStorage = require('./storage/ActivityMediaStorage');
const { MAX_PHOTOS, MIME_EXTENSIONS, validId, fail, assertFields, validateUpload, verifyImage } = require('../utils/activityMediaPolicy');

const idOf = value => String(value?._id || value);
async function boundedMap(rows, action, concurrency = 6) {
  const results = new Array(rows.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
    while (next < rows.length) { const index = next++; results[index] = await action(rows[index]); }
  }));
  return results;
}
class ActivityMediaService {
  constructor({ EventModel = Event, MediaModel = ActivityMedia, UserModel = User, activityService, storage, settings, storageFactory = env => new ActivityMediaStorage(env), now = () => new Date() } = {}) {
    this.events = EventModel; this.media = MediaModel; this.users = UserModel;
    this.activities = activityService; this.storage = storage; this.settings = settings || (storage ? null : StorageSettings.sharedStorageSettings); this.storageFactory = storageFactory; this.now = now;
  }
  activityService() { return this.activities || require('./ActivityService').activityService; }
  async scoped(operation) {
    const release = this.settings?.enterOperation();
    try { return await operation(this.storage || this.storageFactory(this.settings.environment())); }
    finally { release?.(); }
  }
  assertId(value) { if (!validId(value)) fail(400, '活动或图片编号无效。', 'INVALID_ID'); }
  async readableEvent(activityId, userId) {
    this.assertId(activityId);
    return this.activityService().readableEvent(activityId, userId);
  }
  async adminEvent(activityId, userId) {
    const user = await this.users.findById(userId).select('isAdmin');
    if (user?.isAdmin !== true) fail(403, '只有管理员可以管理活动图片。', 'ADMIN_REQUIRED');
    return this.readableEvent(activityId, userId);
  }
  assertStorage(storage) { if (!storage.describe().configured) fail(503, '活动图片存储尚未完成安全配置，请联系管理员。', 'ACTIVITY_STORAGE_UNCONFIGURED'); }
  versionFilter(event) {
    return event.mediaVersion ? { mediaVersion: event.mediaVersion } : { $or: [{ mediaVersion: 0 }, { mediaVersion: { $exists: false } }] };
  }
  refs(event) { return (event.mediaRefs || []).map(ref => ({ mediaId: idOf(ref.mediaId), mediaType: ref.mediaType, sortOrder: ref.sortOrder || 0 })); }
  tombstones(event) { return (event.mediaTombstones || []).map(idOf); }
  async mutateEvent(activityId, mutation, expectedVersion = null) {
    // One activity document is the authoritative publication manifest. Exact
    // version CAS works on standalone Mongo and across multiple Node processes.
    for (let attempt = 0; attempt < 12; attempt++) {
      const event = await this.events.findById(activityId).select('coverMediaId mediaVersion +mediaRefs +mediaTombstones legacyCoverHidden deletedAt');
      if (!event) fail(404, '活动不存在。', 'EVENT_NOT_FOUND');
      const version = event.mediaVersion || 0;
      if (expectedVersion !== null && expectedVersion !== version) fail(409, '活动图片已更新，请刷新后重试。', 'MEDIA_VERSION_CONFLICT');
      const change = await mutation(event);
      if (change.noop) return { ...change.result, version };
      const result = await this.events.updateOne({ _id: activityId, ...this.versionFilter(event) }, { $set: change.set, $inc: { mediaVersion: 1 } });
      if (result.modifiedCount === 1) return { ...change.result, version: version + 1 };
    }
    fail(409, '活动图片正在被其他管理员更新，请刷新后重试。', 'MEDIA_CONFLICT');
  }
  async shape(record, storage) {
    return { id: idOf(record), type: record.mediaType, thumbnailUrl: await storage.downloadUrl(record.thumbnailKey), url: await storage.downloadUrl(record.objectKey), expiresAt: new Date(this.now().getTime() + 300000), caption: record.caption || '', width: record.width, height: record.height, sortOrder: record.sortOrder };
  }
  async list(activityId, userId, query = {}) {
    const event = await this.readableEvent(activityId, userId);
    const page = Math.max(1, Math.min(10000, parseInt(query.page, 10) || 1));
    const limit = Math.max(1, Math.min(50, parseInt(query.limit, 10) || 24));
    const refs = this.refs(event);
    const filter = { activityId, _id: { $in: refs.map(ref => ref.mediaId) }, state: 'READY' };
    const total = await this.media.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / limit));
    const current = Math.min(page, pages);
    const positions = new Map(refs.map(ref => [ref.mediaId, ref.sortOrder]));
    const all = await this.media.find(filter).lean();
    all.forEach(row => { row.sortOrder = positions.get(idOf(row)) || 0; });
    all.sort((a, b) => a.mediaType.localeCompare(b.mediaType) || a.sortOrder - b.sortOrder || idOf(a).localeCompare(idOf(b)));
    const rows = all.slice((current - 1) * limit, current * limit);
    const items = rows.length ? await this.scoped(async storage => { this.assertStorage(storage); return boundedMap(rows, row => this.shape(row, storage)); }) : [];
    return { media: items, version: event.mediaVersion || 0, pagination: { page: current, limit, total, pages } };
  }
  async init(activityId, userId, body) {
    const event = await this.adminEvent(activityId, userId);
    const input = validateUpload(body);
    const pending = await this.media.countDocuments({ activityId, state: 'UPLOADING', deletedAt: null, expiresAt: { $gt: this.now() } });
    if (pending >= 30) fail(409, '当前有较多待确认图片，请先完成已有上传。', 'PENDING_MEDIA_LIMIT');
    if (input.mediaType === 'PHOTO' && this.refs(event).filter(ref => ref.mediaType === 'PHOTO').length >= MAX_PHOTOS) fail(409, '每个活动最多保存 200 张照片。', 'PHOTO_LIMIT');
    return this.scoped(async storage => {
      this.assertStorage(storage);
      const id = String(new mongoose.Types.ObjectId());
      const directory = input.mediaType === 'COVER' ? 'cover' : 'photos';
      const root = `activity/${activityId}/${directory}/${id}`;
      const objectKey = `${root}.${MIME_EXTENSIONS[input.mimeType]}`;
      const record = await this.media.create({ _id: id, activityId, ...input, objectKey, thumbnailKey: `${root}-thumb.webp`, uploadedBy: userId, baseMediaVersion: event.mediaVersion || 0, expiresAt: new Date(this.now().getTime() + 2 * 60 * 60 * 1000) });
      try { const target = await storage.authorizeImage(objectKey, input.mimeType, id, input.fileSize); return { upload: { id, ...target } }; }
      catch (error) { await this.media.updateOne({ _id: record._id, state: 'UPLOADING' }, { $set: { state: 'FAILED' } }); throw error; }
    });
  }
  async ownedMedia(activityId, mediaId) {
    this.assertId(mediaId);
    const record = await this.media.findOne({ _id: mediaId, activityId });
    if (!record || record.deletedAt) fail(404, '图片不存在或已经删除。', 'MEDIA_NOT_FOUND');
    return record;
  }
  async complete(activityId, mediaId, userId, body = {}) {
    assertFields(body, []);
    await this.adminEvent(activityId, userId);
    let record = await this.ownedMedia(activityId, mediaId);
    if (record.state !== 'READY' && (record.state !== 'UPLOADING' || record.expiresAt <= this.now())) fail(409, '上传会话已失效，请重新上传图片。', 'MEDIA_UPLOAD_EXPIRED');
    return this.scoped(async storage => {
      this.assertStorage(storage);
      if (record.state !== 'READY') {
        let image, head;
        try {
          head = await storage.headObject(record.objectKey);
          if (head.fileSize !== record.fileSize || head.mimeType.split(';')[0] !== record.mimeType || !head.etag || head.uploadId !== mediaId) fail(400, '云端图片与本次上传记录不一致。', 'OBJECT_MISMATCH');
          const bytes = await storage.readRange(record.objectKey, 0, record.fileSize - 1, head.etag);
          if (bytes.length !== record.fileSize) fail(400, '图片尚未传输完整。', 'OBJECT_MISMATCH');
          image = await verifyImage(bytes, record.mimeType);
          await storage.putThumbnail(record.thumbnailKey, image.thumbnail, mediaId);
        } catch (error) {
          if (error.status === 400) await this.media.updateOne({ _id: mediaId, state: 'UPLOADING', deletedAt: null }, { $set: { state: 'FAILED' } });
          throw error;
        }
        // READY means verified, not published. Failed Event CAS leaves a durable
        // verified object; repeating completion can safely retry association.
        record = await this.media.findOneAndUpdate({ _id: mediaId, activityId, state: 'UPLOADING', deletedAt: null, expiresAt: { $gt: this.now() } }, { $set: { state: 'READY', etag: head.etag, width: image.width, height: image.height, completedAt: this.now() } }, { new: true });
        if (!record) record = await this.ownedMedia(activityId, mediaId);
        if (record.state !== 'READY') fail(409, '上传会话已失效，请重新上传。', 'MEDIA_UPLOAD_EXPIRED');
      }
      await this.adminEvent(activityId, userId);
      const result = await this.mutateEvent(activityId, event => {
        if (event.deletedAt) fail(409, '活动已隐藏，不能添加图片。', 'EVENT_HIDDEN');
        const tombstones = this.tombstones(event);
        if (tombstones.includes(mediaId)) fail(404, '图片已经删除，本次确认不会恢复它。', 'MEDIA_NOT_FOUND');
        const refs = this.refs(event);
        if (refs.some(ref => ref.mediaId === mediaId)) return { noop: true, result: {} };
        const set = {};
        if (record.mediaType === 'COVER') {
          if ((event.mediaVersion || 0) !== record.baseMediaVersion) fail(409, '封面上传期间活动图片已经更新，请重新上传以确认替换。', 'MEDIA_VERSION_CONFLICT');
          const oldCover = event.coverMediaId && idOf(event.coverMediaId);
          if (oldCover && oldCover !== mediaId && !tombstones.includes(oldCover)) tombstones.push(oldCover);
          set.mediaRefs = [...refs.filter(ref => ref.mediaType !== 'COVER'), { mediaId, mediaType: 'COVER', sortOrder: 0 }];
          set.coverMediaId = mediaId; set.legacyCoverHidden = true; set.mediaTombstones = tombstones;
        } else {
          const photos = refs.filter(ref => ref.mediaType === 'PHOTO');
          if (photos.length >= MAX_PHOTOS) fail(409, '每个活动最多保存 200 张照片。', 'PHOTO_LIMIT');
          const order = photos.reduce((max, ref) => Math.max(max, ref.sortOrder + 1), 0);
          set.mediaRefs = [...refs, { mediaId, mediaType: 'PHOTO', sortOrder: order }];
        }
        return { set, result: {} };
      });
      return { media: await this.shape(record, storage), version: result.version };
    });
  }
  async remove(activityId, mediaId, userId, body = {}) {
    assertFields(body, []);
    await this.adminEvent(activityId, userId); this.assertId(mediaId);
    const record = await this.media.findOne({ _id: mediaId, activityId });
    if (!record) fail(404, '活动图片不存在。', 'MEDIA_NOT_FOUND');
    const result = await this.mutateEvent(activityId, event => {
      const tombstones = this.tombstones(event);
      if (tombstones.includes(mediaId)) return { noop: true, result: { deleted: true } };
      const set = { mediaRefs: this.refs(event).filter(ref => ref.mediaId !== mediaId), mediaTombstones: [...tombstones, mediaId] };
      if (event.coverMediaId && idOf(event.coverMediaId) === mediaId) { set.coverMediaId = null; set.legacyCoverHidden = true; }
      return { set, result: { deleted: true } };
    });
    // The audit row may be repaired later; Event publication already vanished.
    // COS objects are retained regardless of this optional follow-up outcome.
    await this.media.updateOne({ _id: mediaId, activityId, deletedAt: null }, { $set: { deletedAt: this.now(), deletedBy: userId } }).catch(() => {});
    return result;
  }
  async clearCover(activityId, userId, body = {}) {
    assertFields(body, ['clearLegacy', 'version']);
    if (body.clearLegacy !== true || !Number.isSafeInteger(body.version)) fail(400, '请明确确认删除封面并提供当前版本。', 'INVALID_FIELDS');
    await this.adminEvent(activityId, userId);
    return this.mutateEvent(activityId, event => {
      const old = event.coverMediaId && idOf(event.coverMediaId); const tombstones = this.tombstones(event);
      if (old && !tombstones.includes(old)) tombstones.push(old);
      return { set: { coverMediaId: null, legacyCoverHidden: true, mediaRefs: this.refs(event).filter(ref => ref.mediaType !== 'COVER'), mediaTombstones: tombstones }, result: { deleted: true } };
    }, body.version);
  }
  async order(activityId, userId, body) {
    assertFields(body, ['ids', 'version']);
    if (!Array.isArray(body.ids) || body.ids.length < 2 || body.ids.length > MAX_PHOTOS || body.ids.some(id => !validId(id)) || new Set(body.ids).size !== body.ids.length || !Number.isSafeInteger(body.version)) fail(400, '照片顺序或版本无效。', 'INVALID_MEDIA_ORDER');
    await this.adminEvent(activityId, userId);
    return this.mutateEvent(activityId, event => {
      const refs = this.refs(event); const photos = refs.filter(ref => ref.mediaType === 'PHOTO').sort((a, b) => a.sortOrder - b.sortOrder || a.mediaId.localeCompare(b.mediaId));
      const selected = new Set(body.ids); const existing = new Set(photos.map(ref => ref.mediaId));
      if (body.ids.some(id => !existing.has(id))) fail(400, '排序包含其他活动或已删除的照片。', 'INVALID_MEDIA_ORDER');
      let next = 0;
      const ordered = photos.map(ref => selected.has(ref.mediaId) ? body.ids[next++] : ref.mediaId);
      return { set: { mediaRefs: [...refs.filter(ref => ref.mediaType === 'COVER'), ...ordered.map((id, index) => ({ mediaId: id, mediaType: 'PHOTO', sortOrder: index }))] }, result: { ordered: true } };
    }, body.version);
  }
  async decorateEvent(dto, raw, userId) {
    if (Object.hasOwn(dto, 'mediaVersion')) dto.coverMediaId = raw.coverMediaId ? idOf(raw.coverMediaId) : null;
    if (raw.legacyCoverHidden) { dto.imageUrl = ''; dto.coverUrl = ''; }
    if (!raw.coverMediaId) return dto;
    // Caller already validated the activity; exact database reference prevents
    // members from signing arbitrary keys or borrowing another activity's media.
    if (!this.refs(raw).some(ref => ref.mediaId === idOf(raw.coverMediaId) && ref.mediaType === 'COVER')) { dto.imageUrl = ''; dto.coverUrl = ''; return dto; }
    const cover = await this.media.findOne({ _id: raw.coverMediaId, activityId: raw._id, mediaType: 'COVER', state: 'READY' });
    if (!cover) { dto.imageUrl = ''; dto.coverUrl = ''; return dto; }
    try { dto.imageUrl = await this.scoped(async storage => { this.assertStorage(storage); return storage.downloadUrl(cover.thumbnailKey); }); }
    catch (error) { dto.imageUrl = ''; dto.coverMediaUnavailable = true; }
    dto.coverUrl = dto.imageUrl;
    return dto;
  }
}
const activityMediaService = new ActivityMediaService();
module.exports = { ActivityMediaService, activityMediaService };
