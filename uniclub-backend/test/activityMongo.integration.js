// Explicit isolated real-Mongo test. Does not load .env or use the normal DB.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'activity-isolated-verification-only';
const User = require('../models/User');
const Roster = require('../models/EnrolledUser');
const Event = require('../models/Event');
const RSVP = require('../models/EventRSVP');
const { ActivityService } = require('../services/ActivityService');
const { createEventRouter } = require('../routes/eventRouter');
const { migrateActivities, rollbackActivities, evidence } = require('../migrations/20261008_activity_v2');

test('Activities V2 HTTP + real standalone MongoDB business closure', { timeout: 120000 }, async t => {
  const uri = process.env.ACTIVITY_TEST_MONGO_URI;
  assert.ok(/^mongodb:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(uri || ''), 'ACTIVITY_TEST_MONGO_URI must explicitly target an isolated loopback Mongo server');
  const dbName = `classhub_activity_test_${Date.now()}_${randomBytes(4).toString('hex')}`;
  let server; let time = new Date('2026-10-08T00:00:00Z');
  const service = new ActivityService({ now: () => new Date(time) });
  try {
    await mongoose.connect(uri, { dbName, autoIndex: false, serverSelectionTimeoutMS: 5000 });
    for (const Model of [User, Roster, Event, RSVP]) { await Model.createCollection(); await Model.createIndexes(); }
    const account = async (name, uniqueId, { member = true, admin = false } = {}) => {
      const user = await User.create({ name, uniqueId, passwordHash: 'unusable-test-only', isEnrolled: member, isAdmin: admin });
      if (member) await Roster.create({ name, uniqueId }); return user;
    };
    const admin = await account('班级测试管理员', 'TEST-admin', { admin: true });
    const platform = await account('平台测试管理员', 'TEST-platform', { member: false, admin: true });
    const student = await account('同名测试成员', 'TEST-student');
    const other = await account('同名测试成员', 'TEST-other');
    const missing = await account('未报名测试成员', 'TEST-missing');
    const outsider = await account('外部测试账号', 'TEST-outsider', { member: false });
    const departed = await account('已离班测试成员', 'TEST-departed');
    await Roster.deleteOne({ uniqueId: departed.uniqueId });
    await Roster.create({ name: '尚未注册测试成员', uniqueId: 'TEST-unregistered-account' });
    const app = express(); app.use(express.json());
    const access = require('../middleware/activityReadAccess').createActivityReadAccess({ service });
    app.get('/api/events/verification/event/:id', access.content, (req, res) => res.json({ protected: true }));
    app.get('/api/events/verification/news/:id', access.content, (req, res) => res.json({ unchanged: true }));
    app.get('/api/events/verification/optional', access.optional, (req, res) => res.json({ canReadActivities: req.canReadActivities }));
    const router = createEventRouter({ service, mediaService: null, mediaRouter: express.Router() });
    app.use('/api/events', router);
    server = await new Promise(resolve => { const started = app.listen(0, '127.0.0.1', () => resolve(started)); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const request = async (method, path, user = student, body) => {
      const headers = body !== undefined ? { 'Content-Type': 'application/json' } : {};
      if (user) headers.Authorization = `Bearer ${jwt.sign({ userId: String(user._id), tokenVersion: 0, isAdmin: true }, process.env.JWT_SECRET)}`;
      const response = await fetch(origin + '/api/events' + path, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, body: await response.json() };
    };
    const data = { title: '隔离测试活动', description: '完整的活动介绍\n第二段正文', startDate: '2026-10-09T00:00:00Z', endDate: '2026-10-09T02:00:00Z', location: { type: 'physical', address: '测试教室', room: '101' }, eventType: 'CLASS_MEETING', maxCapacity: 2, status: 'draft', rsvpDeadline: null };
    let activity;
    await t.test('CASE 01 admin creates draft, stable ID and basic information', async () => {
      const result = await request('POST', '', admin, data); assert.equal(result.status, 201);
      activity = result.body.event; assert.equal(activity.phase, 'UPCOMING'); assert.equal(activity.registrationOpen, false); assert.equal(activity.title, data.title);
    });
    await t.test('CASE 02 member cannot create/edit/hide even with forged admin JWT claim', async () => {
      assert.equal((await request('POST', '', student, data)).status, 403);
      assert.equal((await request('PUT', `/${activity.id}`, student, { title: 'forbidden' })).status, 403);
      assert.equal((await request('DELETE', `/${activity.id}`, student)).status, 403);
    });
    await t.test('member visibility blocks draft and calendar leakage; anonymous denied', async () => {
      assert.equal((await request('GET', `/${activity.id}`)).status, 404);
      assert.equal((await request('POST', `/${activity.id}/calendar`)).status, 404);
      assert.equal((await request('GET', '', null)).status, 401);
      assert.equal((await request('GET', `/${activity.id}/admin`, platform)).status, 200);
      assert.equal((await request('POST', `/${activity.id}/rsvp`, platform, {})).status, 403);
    });
    await t.test('publish gives members complete content and opens registration', async () => {
      const result = await request('PUT', `/${activity.id}`, admin, { status: 'published' }); assert.equal(result.status, 200);
      assert.equal(result.body.event.registrationOpen, true);
      const read = await request('GET', `/${activity.id}`); assert.equal(read.status, 200); assert.equal(read.body.event.description, data.description);
      assert.doesNotMatch(JSON.stringify(read.body), /registrations|registrationVersion|passwordHash|reviewNote|TEST-student/);
    });
    await t.test('current membership required; stale isEnrolled cannot authorize after roster removal', async () => {
      for (const user of [outsider, departed]) {
        assert.equal((await request('GET', `/${activity.id}`, user)).status, 403);
        assert.equal((await request('POST', `/${activity.id}/rsvp`, user, {})).status, 403);
      }
    });
    await t.test('activityReadAccess rejects anonymous, forged-role and departed accounts, preserving unrelated content', async () => {
      assert.equal((await request('GET', `/verification/event/${activity.id}`, null)).status, 401);
      assert.equal((await request('GET', `/verification/event/${activity.id}`, departed)).status, 403);
      assert.equal((await request('GET', `/verification/event/${activity.id}`, student)).status, 200);
      assert.equal((await request('GET', `/verification/news/${activity.id}`, null)).status, 200);
      assert.equal((await request('GET', '/verification/optional', null)).body.canReadActivities, false);
      assert.equal((await request('GET', '/verification/optional', departed)).body.canReadActivities, false);
      assert.equal((await request('GET', '/verification/optional', student)).body.canReadActivities, true);
      assert.equal((await request('GET', '/verification/optional', platform)).body.canReadActivities, true);
      const draft = await request('POST', '', admin, { ...data, title: '权限测试草稿' });
      assert.equal((await request('GET', `/verification/event/${draft.body.event.id}`, student)).status, 404, 'fake admin JWT claim cannot reveal draft');
      assert.equal((await request('GET', `/verification/event/${draft.body.event.id}`, admin)).status, 200);
      await request('DELETE', `/${draft.body.event.id}`, admin);
    });
    await t.test('CASE 06 + 07 repeated concurrent submissions produce one current PENDING row', async () => {
      const responses = await Promise.all(Array.from({ length: 8 }, () => request('POST', `/${activity.id}/rsvp`, student, {})));
      assert.ok(responses.every(result => result.status === 200), JSON.stringify(responses));
      assert.equal(new Set(responses.map(result => result.body.rsvp.id)).size, 1);
      const raw = await service.rawEvent(activity.id); assert.equal(raw.registrations.length, 1); assert.equal(raw.registrations[0].history.length, 1);
      assert.equal(await RSVP.countDocuments({ event: activity.id }), 0);
      assert.equal((await request('POST', `/${activity.id}/rsvp`, student, { status: 'APPROVED' })).status, 400);
    });
    await t.test('CASE 08 + 09 + 10 pending review, repeated approve keeps actor/time and refresh result', async () => {
      const pending = await request('GET', `/${activity.id}/registrations?filter=pending`, admin);
      assert.equal(pending.body.members.length, 1); const version = pending.body.members[0].registration.version;
      const responses = await Promise.all(Array.from({ length: 5 }, () => request('POST', `/${activity.id}/registrations/${student._id}/review`, admin, { status: 'APPROVED', version, note: '批准' })));
      assert.ok(responses.every(result => result.status === 200));
      assert.equal(new Set(responses.map(result => result.body.rsvp.reviewedAt)).size, 1);
      assert.equal(responses[0].body.rsvp.reviewedBy, String(admin._id));
      const mine = await request('GET', `/${activity.id}/rsvp`); assert.equal(mine.body.rsvp.status, 'APPROVED');
    });
    await t.test('CASE 11 + 12 rejection remains a historical submitted member, reapply advances same ID', async () => {
      const apply = await request('POST', `/${activity.id}/rsvp`, other, {});
      const rejected = await request('POST', `/${activity.id}/registrations/${other._id}/review`, admin, { status: 'REJECTED', version: apply.body.rsvp.version, note: '本次未通过' });
      assert.equal(rejected.status, 200); assert.equal(rejected.body.rsvp.status, 'REJECTED');
      const unregistered = await request('GET', `/${activity.id}/registrations?filter=unregistered`, admin);
      assert.ok(!unregistered.body.members.some(row => row.userId === String(other._id)));
      const reapply = await request('POST', `/${activity.id}/rsvp`, other, {});
      assert.equal(reapply.body.rsvp.id, apply.body.rsvp.id); assert.equal(reapply.body.rsvp.status, 'PENDING'); assert.equal(reapply.body.rsvp.version, rejected.body.rsvp.version + 1);
    });
    await t.test('CASE 13 + 14 missing includes rostered admin and unregistered roster, excludes platform admin; same names separate IDs', async () => {
      const result = await request('GET', `/${activity.id}/registrations?filter=unregistered`, admin);
      const names = result.body.members.map(row => row.name);
      assert.ok(names.includes(admin.name)); assert.ok(names.includes(missing.name)); assert.ok(names.includes('尚未注册测试成员')); assert.ok(!names.includes(platform.name));
      assert.equal(result.body.stats.totalMembers, 5);
      const sameName = await request('GET', `/${activity.id}/registrations?search=同名`, admin);
      assert.equal(sameName.body.members.length, 2); assert.equal(new Set(sameName.body.members.map(row => row.userId)).size, 2);
      assert.doesNotMatch(JSON.stringify(result.body), /email|phone|password|dietary/);
    });
    await t.test('CASE 15 real standalone concurrent approvals never exceed capacity', async () => {
      const applicants = [other];
      for (let i = 0; i < 8; i++) { const user = await account(`并发测试成员 ${i}`, `TEST-race-${i}`); applicants.push(user); await request('POST', `/${activity.id}/rsvp`, user, {}); }
      const pending = await request('GET', `/${activity.id}/registrations?filter=pending&limit=100`, admin);
      const responses = await Promise.all(pending.body.members.map(row => request('POST', `/${activity.id}/registrations/${row.userId}/review`, admin, { status: 'APPROVED', version: row.registration.version })));
      assert.equal(responses.filter(result => result.status === 200).length, 1);
      assert.ok(responses.filter(result => result.status !== 200).every(result => result.status === 409 && result.body.code === 'CAPACITY_FULL'));
      assert.equal((await service.rawEvent(activity.id)).registrations.filter(row => row.status === 'APPROVED').length, 2);
      assert.equal((await request('PUT', `/${activity.id}`, admin, { maxCapacity: 1 })).body.code, 'CAPACITY_TOO_LOW');
    });
    await t.test('stale conflicting reviewer never overwrites current review outcome', async () => {
      const pending = await request('GET', `/${activity.id}/registrations?filter=pending`, admin); const row = pending.body.members[0];
      const first = await request('POST', `/${activity.id}/registrations/${row.userId}/review`, admin, { status: 'REJECTED', version: row.registration.version });
      assert.equal(first.status, 200);
      const stale = await request('POST', `/${activity.id}/registrations/${row.userId}/review`, platform, { status: 'APPROVED', version: row.registration.version });
      assert.equal(stale.status, 409); assert.equal(stale.body.code, 'VERSION_CONFLICT');
    });
    await t.test('bulk approve reports exact partial successes and failures; duplicates rejected', async () => {
      const pending = await request('GET', `/${activity.id}/registrations?filter=pending`, admin);
      const registrations = pending.body.members.slice(0, 2).map(row => ({ userId: row.userId, version: row.registration.version }));
      await request('PUT', `/${activity.id}`, admin, { maxCapacity: 3 });
      const result = await request('POST', `/${activity.id}/registrations/bulk-review`, admin, { status: 'APPROVED', registrations });
      assert.equal(result.status, 200); assert.equal(result.body.succeeded, 1); assert.equal(result.body.failed, 1);
      assert.equal((await request('POST', `/${activity.id}/registrations/bulk-review`, admin, { status: 'APPROVED', registrations: [registrations[0], registrations[0]] })).status, 400);
    });
    await t.test('cancel retains record/history and reapply same identity; approved seat becomes available atomically', async () => {
      const before = (await request('GET', `/${activity.id}/rsvp`)).body.rsvp;
      const cancelled = await request('DELETE', `/${activity.id}/rsvp`); assert.equal(cancelled.body.rsvp.status, 'CANCELLED'); assert.equal(cancelled.body.rsvp.id, before.id);
      assert.ok(!(await request('GET', `/${activity.id}/registrations?filter=unregistered`, admin)).body.members.some(row => row.userId === String(student._id)));
      const reapplied = await request('POST', `/${activity.id}/rsvp`, student); assert.equal(reapplied.body.rsvp.id, before.id); assert.equal(reapplied.body.rsvp.status, 'PENDING');
    });
    await t.test('CASE 16 + 17 + 19 + 20 ending closes apply/cancel; archive keeps summary and historic applications', async () => {
      await request('PUT', `/${activity.id}/summary`, admin, { summary: '真实隔离测试活动总结' });
      time = new Date('2026-10-09T03:00:00Z');
      assert.equal((await request('POST', `/${activity.id}/rsvp`, missing, {})).body.code, 'REGISTRATION_CLOSED');
      assert.equal((await request('DELETE', `/${activity.id}/rsvp`)).body.code, 'REGISTRATION_CLOSED');
      const past = await request('GET', '?view=past&year=2026'); assert.ok(past.body.events.some(row => row.id === activity.id)); assert.ok(past.body.years.includes(2026));
      assert.equal((await request('POST', `/${activity.id}/archive`, admin)).status, 200);
      const read = await request('GET', `/${activity.id}`); assert.equal(read.body.event.status, 'archived'); assert.equal(read.body.event.summary, '真实隔离测试活动总结');
      assert.equal(read.body.event.phase, 'ENDED'); assert.equal(read.body.event.registrationOpen, false);
      assert.ok((await request('GET', `/${activity.id}/registrations`, admin)).body.stats.pending > 0);
    });
    await t.test('CASE 21 member cannot read full lists, admin stats, approve, summary or legacy attendees', async () => {
      for (const path of [`/${activity.id}/registrations`, `/${activity.id}/admin`, `/${activity.id}/attendees`]) assert.equal((await request('GET', path)).status, 403);
      assert.equal((await request('POST', `/${activity.id}/registrations/${other._id}/review`, student, { status: 'REJECTED', version: 1 })).status, 403);
      assert.equal((await request('PUT', `/${activity.id}/summary`, student, { summary: 'forbidden' })).status, 403);
    });
    await t.test('soft hide retains ledgers, objects references and ID; restore permits past access', async () => {
      const before = await service.rawEvent(activity.id);
      assert.equal((await request('DELETE', `/${activity.id}`, admin)).status, 200);
      assert.equal((await request('GET', `/${activity.id}`)).status, 404);
      assert.equal(await Event.countDocuments({ _id: activity.id }), 1);
      assert.deepEqual((await service.rawEvent(activity.id)).registrations, before.registrations);
      assert.equal((await request('POST', `/${activity.id}/restore`, admin)).status, 200);
      assert.equal((await request('GET', `/${activity.id}`)).status, 200);
    });
    await t.test('activityPreview strips ledgers, media refs/tombstones and audit metadata', async () => {
      const raw = await service.rawEvent(activity.id);
      raw.mediaRefs = []; raw.mediaTombstones = [new mongoose.Types.ObjectId()];
      const dto = await require('../middleware/activityReadAccess').activityPreview(raw, String(student._id));
      assert.doesNotMatch(JSON.stringify(dto), /registrations|registrationVersion|registrationSchemaVersion|reviewNote|mediaRefs|mediaTombstones|MigrationBackup/);
      const list = await service.list(student._id, { view: 'past' });
      assert.equal(Object.prototype.propertyIsEnumerable.call(list, 'rawEvents'), false);
      assert.doesNotMatch(JSON.stringify(list), /rawEvents|registrations|mediaRefs|mediaTombstones/);
    });
    await t.test('CASE 24 + 25 legacy import preserves exact original types/RSVP/cover evidence; historical approval metadata is not fabricated', async () => {
      const legacy = await Event.create({ ...data, title: '历史工作坊', eventType: 'Workshop', status: 'completed', imageUrl: 'https://historic.example/cover.jpg', organizer: admin._id });
      const row = await RSVP.create({ event: legacy._id, user: student._id, status: 'going', notes: '原始历史备注保留' });
      const before = await evidence(service);
      assert.equal((await service.mine(legacy._id, student._id)).status, 'APPROVED');
      assert.equal((await service.mine(legacy._id, student._id)).reviewedAt, null);
      const dry = await migrateActivities({ service }); assert.equal(dry.mode, 'DRY_RUN');
      const applied = await migrateActivities({ service, apply: true }); assert.deepEqual(applied.before, applied.after); assert.deepEqual(await evidence(service), before);
      const current = await service.mine(legacy._id, student._id); assert.equal(current.id, String(row._id)); assert.equal(current.legacyStatus, 'going');
      const preserved = await RSVP.findById(row._id).lean(); assert.equal(preserved.notes, '原始历史备注保留'); assert.equal(preserved.status, 'going');
      assert.equal((await request('PUT', `/${legacy._id}`, admin, { title: '历史介绍修订', eventType: 'Workshop' })).status, 200);
      assert.equal((await Event.findById(legacy._id).lean()).eventType, 'Workshop');
      assert.equal((await request('PUT', `/${legacy._id}`, admin, { eventType: 'OTHER' })).status, 200);
      assert.equal((await Event.findById(legacy._id).lean()).legacyEventType, 'Workshop');
      assert.equal((await Event.findById(legacy._id).lean()).imageUrl, 'https://historic.example/cover.jpg');
      assert.equal((await RSVP.findById(row._id).lean()).status, 'going');
    });
    await t.test('legacy unknown classification stays readable and editable; list projects no ledger; DB indexes exist', async () => {
      const id = new mongoose.Types.ObjectId();
      await Event.collection.insertOne({ ...data, _id: id, organizer: admin._id, eventType: 'UnmappedHistoricalType', status: 'published', startDate: new Date(data.startDate), endDate: new Date(data.endDate) });
      assert.equal((await request('GET', `/${id}`)).body.event.eventType, 'UnmappedHistoricalType');
      assert.equal((await request('PUT', `/${id}`, admin, { title: '保留未知历史分类', eventType: 'UnmappedHistoricalType' })).status, 200);
      const list = await service.list(student._id, { view: 'past', search: '.*' }); assert.equal(list.events.length, 0, 'regex metacharacters treated as literal');
      const raw = await Event.findById(activity.id).lean(); assert.equal(raw.registrations, undefined);
      const indexes = await Event.collection.indexes(); assert.ok(indexes.some(index => index.key.deletedAt === 1 && index.key.endDate === -1));
      assert.ok(indexes.some(index => index.key['registrations.userId'] === 1));
    });
    await t.test('untouched rollback restores absent approvedCount and original rsvpCount without changing legacy data', async () => {
      const rollbackDb = `${dbName}_rollback`;
      const connection = await mongoose.createConnection(uri, { dbName: rollbackDb, autoIndex: false }).asPromise();
      try {
        const models = {
          UserModel: connection.model('User', User.schema), RosterModel: connection.model('EnrolledUser', Roster.schema, 'EnrolledUser'),
          EventModel: connection.model('Event', Event.schema), RSVPModel: connection.model('EventRSVP', RSVP.schema),
        };
        const isolated = new ActivityService({ ...models, now: () => new Date(time) });
        const u = await models.UserModel.create({ name: '回滚测试成员', uniqueId: 'TEST-rollback', passwordHash: 'unusable-test' });
        const id = new mongoose.Types.ObjectId();
        await models.EventModel.collection.insertOne({ ...data, _id: id, eventType: 'Workshop', organizer: u._id, rsvpCount: 7,
          startDate: new Date(data.startDate), endDate: new Date(data.endDate), imageUrl: 'https://historic.example/rollback.jpg' });
        await models.RSVPModel.create({ event: id, user: u._id, status: 'maybe', notes: '不可丢失的原始报名记录' });
        const withCounter = new mongoose.Types.ObjectId();
        await models.EventModel.collection.insertOne({ ...data, _id: withCounter, eventType: 'Social', organizer: u._id, rsvpCount: 5, approvedCount: 4, startDate: new Date(data.startDate), endDate: new Date(data.endDate) });
        const before = await evidence(isolated);
        await migrateActivities({ service: isolated, apply: true });
        const imported = await isolated.rawEvent(id);
        assert.equal(imported.activityV2MigrationBackup.hadApprovedCount, false);
        assert.equal(imported.activityV2MigrationBackup.rsvpCount, 7);
        assert.equal(imported.approvedCount, 0); assert.equal(imported.rsvpCount, 1);
        const rolled = await rollbackActivities({ service: isolated, apply: true }); assert.equal(rolled.untouchedLedgers, 2);
        const restored = await models.EventModel.collection.findOne({ _id: id });
        assert.equal(restored.rsvpCount, 7); assert.equal(Object.hasOwn(restored, 'approvedCount'), false);
        assert.equal(Object.hasOwn(restored, 'registrations'), false); assert.equal(Object.hasOwn(restored, 'registrationSchemaVersion'), false);
        const preservedCounter = await models.EventModel.collection.findOne({ _id: withCounter });
        assert.equal(preservedCounter.approvedCount, 4); assert.equal(preservedCounter.rsvpCount, 5);
        assert.deepEqual(await evidence(isolated), before);
      } finally {
        if (connection.name === rollbackDb && /^classhub_activity_test_/.test(rollbackDb)) await connection.dropDatabase();
        await connection.close();
      }
    });
    await t.test('rollback refuses any loss of new V2 applications; cancelled/hidden drafts never publicly archived', async () => {
      await assert.rejects(rollbackActivities({ service, apply: true }), /Rollback refused/);
      const draft = await request('POST', '', admin, { ...data, title: '过期草稿' });
      assert.equal((await request('POST', `/${draft.body.event.id}/archive`, admin)).body.code, 'INVALID_TRANSITION');
      const past = await request('GET', '?view=past'); assert.ok(!past.body.events.some(row => row.id === draft.body.event.id));
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName && /^classhub_activity_test_/.test(dbName)) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
