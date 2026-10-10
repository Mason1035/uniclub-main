// Explicit isolated standalone Mongo + real HTTP image transfer. No .env/cloud.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
process.env.JWT_SECRET = 'activity-media-isolated-test-only';
const User = require('../models/User');
const Roster = require('../models/EnrolledUser');
const Event = require('../models/Event');
const Media = require('../models/ActivityMedia');
const { ActivityService } = require('../services/ActivityService');
const { ActivityMediaService } = require('../services/ActivityMediaService');
const { createEventRouter } = require('../routes/eventRouter');
const { createActivityMediaRouter } = require('../routes/activityMediaRouter');
const { ActivityMediaMemoryStorage } = require('./fixtures/activityMediaMemory');

test('Activities V2 media: actual standalone Mongo and isolated HTTP object transport', { timeout: 120000 }, async t => {
  const uri = process.env.ACTIVITY_TEST_MONGO_URI;
  assert.match(uri || '', /^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\/?$/, 'explicit isolated loopback Mongo required');
  const dbName = `classhub_activity_media_test_${Date.now()}_${randomBytes(4).toString('hex')}`;
  const storage = new ActivityMediaMemoryStorage(); const activities = new ActivityService();
  const media = new ActivityMediaService({ activityService: activities, storage }); let server;
  try {
    await mongoose.connect(uri, { dbName, autoIndex: false, serverSelectionTimeoutMS: 5000 });
    for (const Model of [User, Roster, Event, Media]) { await Model.createCollection(); await Model.createIndexes(); }
    const account = async (name, uniqueId, isAdmin) => { const user = await User.create({ name, uniqueId, passwordHash: 'unusable-test-only', isEnrolled: true, isAdmin }); await Roster.create({ name, uniqueId }); return user; };
    const admin = await account('媒体测试管理员', 'MEDIA-admin', true); const student = await account('媒体测试同学', 'MEDIA-student', false);
    const app = express(); app.use(storage.createRouter()); app.use(express.json()); app.use('/api/events', createEventRouter({ service: activities, mediaService: media, mediaRouter: createActivityMediaRouter(media) }));
    server = await new Promise(resolve => { const started = app.listen(0, '127.0.0.1', () => resolve(started)); }); storage.origin = `http://127.0.0.1:${server.address().port}`;
    const request = async (method, path, user = admin, body) => {
      const headers = { Authorization: `Bearer ${jwt.sign({ userId: String(user._id), tokenVersion: 0, isAdmin: true }, process.env.JWT_SECRET)}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) };
      const response = await fetch(storage.origin + '/api/events' + path, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }); return { status: response.status, body: await response.json() };
    };
    const eventData = { title: '媒体闭环测试', description: '完整介绍', startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-01T02:00:00Z', location: { type: 'physical', address: '测试教室' }, eventType: 'CLASS_MEETING', status: 'published', rsvpDeadline: null };
    const activity = (await request('POST', '', admin, eventData)).body.event;
    const other = (await request('POST', '', admin, { ...eventData, title: '另一个测试活动' })).body.event;
    const bytes = await sharp({ create: { width: 32, height: 24, channels: 3, background: '#0988a2' } }).png().toBuffer();
    const init = async (type = 'PHOTO', eventId = activity.id, data = bytes, mimeType = 'image/png') => {
      const response = await request('POST', `/${eventId}/media/init`, admin, { mediaType: type, filename: '同名照片.png', mimeType, size: data.length }); assert.equal(response.status, 201, JSON.stringify(response)); return response.body.upload;
    };
    const transfer = async (upload, data = bytes) => { const response = await fetch(upload.url, { method: upload.method, headers: upload.headers, body: data }); assert.equal(response.status, 200); };
    const complete = (upload, eventId = activity.id) => request('POST', `/${eventId}/media/${upload.id}/complete`, admin, {});
    let cover, photo1, photo2;
    await t.test('CASE 03 cover direct HTTP PUT, complete, private headers and thumbnails', async () => {
      cover = await init('COVER'); assert.equal(cover.method, 'PUT'); assert.equal(cover.headers['x-cos-acl'], 'private'); assert.equal(cover.headers['x-cos-forbid-overwrite'], 'true');
      assert.equal((await fetch(cover.url, { method: 'PUT', headers: cover.headers, body: Buffer.concat([bytes, Buffer.from('extra')]) })).status, 403, 'signature length rejects extra bytes before object creation');
      assert.doesNotMatch(JSON.stringify(cover), /Secret|JWT|passwordHash/); await transfer(cover);
      const result = await complete(cover); assert.equal(result.status, 200); assert.equal(result.body.media.width, 32); assert.equal(result.body.media.height, 24);
      const raw = await activities.rawEvent(activity.id); assert.equal(String(raw.coverMediaId), cover.id); assert.equal(raw.mediaRefs.length, 1);
      const detail = await request('GET', `/${activity.id}`, student); assert.equal(detail.status, 200); assert.ok(detail.body.event.imageUrl.includes('/test-storage/'));
      const thumb = await fetch(detail.body.event.imageUrl); assert.equal(thumb.status, 200); assert.equal((await sharp(Buffer.from(await thumb.arrayBuffer())).metadata()).format, 'webp');
      assert.equal((await fetch(cover.url, { method: 'PUT', headers: cover.headers, body: bytes })).status, 409, 'original cannot be overwritten');
    });
    await t.test('CASE 04 MIME, byte signature, image decode and 10MiB bounds rejected', async () => {
      for (const body of [{ mediaType: 'PHOTO', filename: 'photo.svg', mimeType: 'image/svg+xml', size: 12 }, { mediaType: 'PHOTO', filename: 'photo.png', mimeType: 'image/png', size: 10 * 1024 * 1024 + 1 }]) assert.equal((await request('POST', `/${activity.id}/media/init`, admin, body)).status, 400);
      const invalid = Buffer.from('not an image at all'); const upload = await init('PHOTO', activity.id, invalid); await transfer(upload, invalid); const result = await complete(upload); assert.equal(result.status, 400); assert.equal(result.body.code, 'INVALID_IMAGE');
      assert.equal((await Media.findById(upload.id)).state, 'FAILED'); assert.ok(!(await activities.rawEvent(activity.id)).mediaRefs.some(ref => String(ref.mediaId) === upload.id));
      const fake = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]); const broken = await init('PHOTO', activity.id, fake); await transfer(broken, fake); assert.equal((await complete(broken)).status, 400);
    });
    await t.test('CASE 05 missing objects and thumbnail failure leave no display reference; same session retry succeeds', async () => {
      const upload = await init(); assert.equal((await complete(upload)).status, 404); await transfer(upload); storage.failThumbnail = true;
      assert.equal((await complete(upload)).status, 502); assert.ok(!(await activities.rawEvent(activity.id)).mediaRefs.some(ref => String(ref.mediaId) === upload.id));
      storage.failThumbnail = false; assert.equal((await complete(upload)).status, 200); photo1 = upload;
    });
    await t.test('DB association failure retains verified READY object; retry completes once without repeating thumbnail', async () => {
      const upload = await init(); await transfer(upload); const original = Event.updateOne;
      Event.updateOne = async () => { throw new Error('isolated database failure'); };
      try { assert.equal((await complete(upload)).status, 500); } finally { Event.updateOne = original; }
      assert.equal((await Media.findById(upload.id)).state, 'READY'); assert.ok(!(await activities.rawEvent(activity.id)).mediaRefs.some(ref => String(ref.mediaId) === upload.id));
      const results = await Promise.all(Array.from({ length: 4 }, () => complete(upload))); assert.ok(results.every(result => result.status === 200));
      assert.equal((await activities.rawEvent(activity.id)).mediaRefs.filter(ref => String(ref.mediaId) === upload.id).length, 1); photo2 = upload;
    });
    await t.test('CASE 18 album lazy signed URLs and stable metadata; no base64 or arbitrary keys', async () => {
      const listing = await request('GET', `/${activity.id}/media?limit=2`, student); assert.equal(listing.status, 200); assert.equal(listing.body.media.length, 2); assert.equal(listing.body.pagination.total, 3);
      assert.ok(listing.body.media.every(row => row.url !== row.thumbnailUrl)); assert.doesNotMatch(JSON.stringify(listing.body), /base64|objectKey|Secret|password/);
      assert.equal((await fetch(listing.body.media[0].url)).status, 200); assert.equal((await request('GET', `/${activity.id}/media?limit=2&page=2`, student)).body.media.length, 1);
    });
    await t.test('CASE 22 cross-activity completion/deletion/order cannot touch other photos', async () => {
      assert.equal((await complete(photo1, other.id)).status, 404); assert.equal((await request('DELETE', `/${other.id}/media/${photo1.id}`, admin, {})).status, 404);
      const version = (await activities.rawEvent(other.id)).mediaVersion;
      assert.equal((await request('PATCH', `/${other.id}/media/order`, admin, { ids: [photo1.id, photo2.id], version })).status, 400);
      assert.ok((await activities.rawEvent(activity.id)).mediaRefs.some(ref => String(ref.mediaId) === photo1.id));
    });
    await t.test('PHOTO subset order exact CAS retains others; stale version rejected', async () => {
      const version = (await activities.rawEvent(activity.id)).mediaVersion;
      assert.equal((await request('PATCH', `/${activity.id}/media/order`, admin, { ids: [photo2.id, photo1.id], version })).status, 200);
      assert.equal((await request('PATCH', `/${activity.id}/media/order`, admin, { ids: [photo1.id, photo2.id], version })).body.code, 'MEDIA_VERSION_CONFLICT');
      const list = await request('GET', `/${activity.id}/media`, student); assert.deepEqual(list.body.media.filter(row => row.type === 'PHOTO').map(row => row.id), [photo2.id, photo1.id]);
    });
    await t.test('CASE 23 cover replacement preserves objects and prevents old retry or stale upload from replacing newest', async () => {
      const newer = await init('COVER'); const stale = await init('COVER'); await transfer(newer); await transfer(stale);
      assert.equal((await complete(newer)).status, 200); assert.equal((await complete(stale)).body.code, 'MEDIA_VERSION_CONFLICT'); assert.equal((await complete(cover)).body.code, 'MEDIA_NOT_FOUND');
      assert.equal(String((await activities.rawEvent(activity.id)).coverMediaId), newer.id); assert.ok(storage.objects.size >= 8);
      assert.equal((await request('GET', `/${activity.id}/media`, student)).body.media.filter(row => row.type === 'COVER').length, 1); cover = newer;
    });
    await t.test('soft removal canonical tombstone prevents revival even when audit metadata write fails', async () => {
      const original = Media.updateOne; Media.updateOne = async () => { throw new Error('isolated audit write failure'); };
      try { assert.equal((await request('DELETE', `/${activity.id}/media/${photo1.id}`, admin, {})).status, 200); } finally { Media.updateOne = original; }
      assert.equal((await Media.findById(photo1.id)).deletedAt, null); assert.equal((await complete(photo1)).body.code, 'MEDIA_NOT_FOUND');
      assert.ok(!(await request('GET', `/${activity.id}/media`, student)).body.media.some(row => row.id === photo1.id)); assert.ok(storage.objects.size >= 8);
    });
    await t.test('delete in-flight upload wins against late completion; current class/draft permissions enforced', async () => {
      const upload = await init(); await transfer(upload); let entered; const started = new Promise(resolve => { entered = resolve; }); let release; const pause = new Promise(resolve => { release = resolve; }); const original = storage.putThumbnail.bind(storage);
      storage.putThumbnail = async (...args) => { entered(); await pause; return original(...args); };
      const completion = complete(upload); await started; assert.equal((await request('DELETE', `/${activity.id}/media/${upload.id}`, admin, {})).status, 200); release(); assert.equal((await completion).status, 404); storage.putThumbnail = original;
      const draft = (await request('POST', '', admin, { ...eventData, status: 'draft' })).body.event;
      assert.equal((await request('GET', `/${draft.id}/media`, student)).status, 404);
      assert.equal((await request('POST', `/${activity.id}/media/init`, student, { mediaType: 'PHOTO', filename: 'photo.png', mimeType: 'image/png', size: bytes.length })).status, 403);
      assert.equal((await request('DELETE', `/${activity.id}/media/${cover.id}`, student, {})).status, 403);
    });
    await t.test('clear uploaded/legacy cover keeps historical URL data and cannot show removed fallback', async () => {
      await Event.updateOne({ _id: activity.id }, { $set: { imageUrl: 'https://historic.example/cover.jpg' } });
      const version = (await activities.rawEvent(activity.id)).mediaVersion;
      assert.equal((await request('DELETE', `/${activity.id}/media/cover`, admin, { clearLegacy: true, version })).status, 200);
      const detail = await request('GET', `/${activity.id}`, student); assert.ok(!detail.body.event.imageUrl);
      assert.equal((await activities.rawEvent(activity.id)).imageUrl, 'https://historic.example/cover.jpg'); assert.equal((await complete(cover)).body.code, 'MEDIA_NOT_FOUND');
      assert.equal(storage.calls.filter(call => call[0] === 'delete').length, 0);
    });
    await t.test('shared bucket/region cannot be changed with retained activity records, even without quantification records', async () => {
      const Settings = require('../services/QuantificationStorageSettings');
      const Repository = require('../services/QuantificationRepository');
      const repository = new Repository(); assert.equal(await repository.hasStorageRecords(), true);
      const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'activity-bucket-guard-'));
      try {
        const settings = new Settings({ filename: path.join(directory, 'storage.json'), env: { COS_BUCKET: 'isolated-media-1234567890', COS_REGION: 'ap-guangzhou' } });
        const body = { revision: settings.view().revision, bucket: 'another-media-1234567890', region: 'ap-guangzhou', endpoint: 'https://another-media-1234567890.cos.ap-guangzhou.myqcloud.com', directoryPrefix: 'quantification/', tokenEndpoint: 'https://isolated-token.ap-guangzhou.tencentscf.com', functionUrl: 'https://isolated-download.ap-guangzhou.tencentscf.com' };
        await assert.rejects(settings.save(body, String(admin._id), () => repository.hasStorageRecords()), error => error.code === 'STORAGE_IN_USE');
        assert.equal(settings.view().bucket, 'isolated-media-1234567890'); assert.equal((await fs.readdir(directory)).length, 0);
      } finally { await fs.rm(directory, { recursive: true, force: true }); }
    });
    await t.test('default media and quantification services share the same configuration operation gate', async () => {
      const Quantification = require('../services/QuantificationService');
      const Settings = require('../services/QuantificationStorageSettings');
      const defaultMedia = new ActivityMediaService(); const defaultQuantification = new Quantification();
      assert.equal(defaultMedia.settings, defaultQuantification.settings); assert.equal(defaultMedia.settings, Settings.sharedStorageSettings);
      const release = defaultMedia.settings.enterOperation();
      try { assert.equal(defaultQuantification.settings.active, 1); await assert.rejects(defaultQuantification.settings.save({}, String(admin._id), async () => false), error => error.code === 'CONFIG_BUSY'); }
      finally { release(); }
      assert.equal(defaultMedia.settings.active, 0);
    });
    await t.test('concurrent PHOTO publication at 199 slots never exceeds canonical 200 limit', async () => {
      // Occupied IDs fixture exercises publication capacity independently of
      // browser pagination and legacy metadata projection.
      const refs = Array.from({ length: 199 }, (_, index) => ({ mediaId: new mongoose.Types.ObjectId(), mediaType: 'PHOTO', sortOrder: index }));
      await Event.updateOne({ _id: other.id }, { $set: { mediaRefs: refs } });
      const first = await init('PHOTO', other.id); const second = await init('PHOTO', other.id); await transfer(first); await transfer(second);
      const results = await Promise.all([complete(first, other.id), complete(second, other.id)]);
      assert.equal(results.filter(result => result.status === 200).length, 1); assert.equal(results.filter(result => result.body.code === 'PHOTO_LIMIT').length, 1);
      assert.equal((await activities.rawEvent(other.id)).mediaRefs.filter(ref => ref.mediaType === 'PHOTO').length, 200);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName && dbName.startsWith('classhub_activity_media_test_')) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
