const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const req = createRequire(require('node:path').join(__dirname, '../package.json'));
process.env.JWT_SECRET = 'activity-staff-isolated-regression';
const userId = '111111111111111111111111';
const eventId = '222222222222222222222222';
let account;
const picks = [];
function project(row, fields) {
  if (!row) return null;
  const result = { _id: row._id };
  for (const field of fields.split(' ')) if (Object.hasOwn(row, field)) result[field] = structuredClone(row[field]);
  return result;
}
function userQuery(row) {
  let fields;
  return { select(value) { fields = value; picks.push(value); return this; },
    lean() { return Promise.resolve(project(row, fields)); },
    then(resolve, reject) { return Promise.resolve(project(row, fields)).then(resolve, reject); } };
}
const User = { findById: () => userQuery(account) };
const userPath = req.resolve('./models/User');
require.cache[userPath] = { id: userPath, filename: userPath, loaded: true, exports: User };
const { ActivityService } = req('./services/ActivityService');
const { ActivityMediaService } = req('./services/ActivityMediaService');
const { createSearchService } = req('./services/GlobalSearchService');
const { hasPermission } = req('./utils/roles');
const roles = ['student', 'committee', 'teacher', 'admin'];
const draft = { _id: eventId, title: '材料活动草稿', status: 'draft', registrationSchemaVersion: 1, registrations: [], startDate: new Date('2099-01-01'), endDate: new Date('2099-01-02') };
const setAccount = (role, enrolled = false) => account = { _id: userId, role, isAdmin: role === 'admin', name: role, uniqueId: '2023000001', isEnrolled: enrolled, tokenVersion: 0 };

test('activity management checks projected live roles without changing administrator identity; roster membership remains mandatory for RSVP', async () => {
  let rosterMember = false, writes = 0;
  const service = new ActivityService({ UserModel: User, RosterModel: { exists: async () => rosterMember }, EventModel: { create: async () => { writes++; return { _id: eventId }; } } });
  service.rawEvent = async () => structuredClone(draft);
  for (const role of roles) {
    setAccount(role);
    if (role === 'student') {
      await assert.rejects(service.account(userId, { admin: true }), error => error.status === 403 && error.code === 'STAFF_REQUIRED');
      await assert.rejects(service.readableEvent(eventId, userId), error => error.code === 'MEMBERSHIP_REQUIRED');
    } else {
      const verified = await service.account(userId, { admin: true });
      assert.equal(verified.role, role);
      assert.equal(verified.isAdmin, role === 'admin');
      assert.equal((await service.readableEvent(eventId, userId)).status, 'draft');
      await assert.rejects(service.apply(eventId, userId), error => error.code === 'MEMBERSHIP_REQUIRED');
      await assert.rejects(service.cancel(eventId, userId), error => error.code === 'MEMBERSHIP_REQUIRED');
    }
    setAccount(role, true);
    rosterMember = false;
    await assert.rejects(service.account(userId, { member: true }), error => error.code === 'MEMBERSHIP_REQUIRED');
    rosterMember = true;
    assert.equal((await service.account(userId, { member: true })).role, role);
    if (role === 'student') await assert.rejects(service.readableEvent(eventId, userId), error => error.status === 404);
  }
  assert.equal(writes, 0);
  for (const fields of picks) assert.ok(fields.split(' ').includes('role') && fields.split(' ').includes('isAdmin'), fields);
  account = { _id: userId, isAdmin: true, isEnrolled: false };
  assert.equal((await service.account(userId, { admin: true })).isAdmin, true, 'legacy admin compatibility');
  setAccount('teacher');
  await service.account(userId, { admin: true });
  setAccount('student');
  await assert.rejects(service.account(userId, { admin: true }), error => error.status === 403, 'live demotion is effective');
});

test('media management accepts staff, denies student before media/storage work, and uses both role fields', async () => {
  let readable = 0;
  const service = new ActivityMediaService({ UserModel: User, activityService: { readableEvent: async () => { readable++; return draft; } }, storage: {} });
  picks.length = 0;
  for (const role of roles) {
    setAccount(role);
    if (role === 'student') await assert.rejects(service.adminEvent(eventId, userId), error => error.status === 403 && error.code === 'STAFF_REQUIRED');
    else assert.equal(await service.adminEvent(eventId, userId), draft);
  }
  assert.equal(readable, 3);
  assert.deepEqual(picks, roles.map(() => 'role isAdmin'));
  setAccount('teacher');
  await service.adminEvent(eventId, userId);
  setAccount('student');
  await assert.rejects(service.adminEvent(eventId, userId), error => error.status === 403);
});

const matches = (row, filter) => Object.entries(filter).every(([key, value]) => {
  if (key === '$or') return value.some(part => matches(row, part));
  if (key === '$and') return value.every(part => matches(row, part));
  const actual = key.split('.').reduce((data, field) => data?.[field], row);
  if (value === null) return actual == null;
  if (value && typeof value === 'object' && !(value instanceof Date)) return Object.entries(value).every(([operator, boundary]) => operator === '$in' ? boundary.some(item => String(item) === String(actual)) : operator === '$lte' ? actual != null && new Date(actual) <= boundary : operator === '$gt' ? actual != null && new Date(actual) > boundary : false);
  return String(actual) === String(value);
});

test('staff search includes content drafts without roster but preserves social privacy; students remain public-content only', async () => {
  const models = { User, Roster: { exists: async () => account.isEnrolled }, Follow: { find: () => ({ select() { return this; }, lean: async () => [] }) } };
  const base = { title: '材料', createdAt: new Date(), publishedAt: new Date('2020-01-01') };
  const records = {
    Announcement: [{ ...base, _id: 'notice-draft', isPublished: false }],
    News: [{ ...base, _id: 'news-draft', status: 'draft' }],
    Event: [{ ...draft, _id: 'event-draft' }, { ...draft, _id: 'event-hidden', deletedAt: new Date() }],
    PastEvent: [], Resource: [{ ...base, _id: 'resource-pending', status: 'pending' }],
    SocialPost: [
      { _id: 'public', content: '材料', status: 'active', author: 'other', visibility: 'public' },
      { _id: 'club', content: '材料', status: 'active', author: 'other', visibility: 'club-members' },
      { _id: 'private', content: '材料', status: 'active', author: 'other', visibility: 'private' },
      { _id: 'friends', content: '材料', status: 'active', author: 'other', visibility: 'friends' },
      { _id: 'own', content: '材料', status: 'active', author: userId, visibility: 'private' },
      { _id: 'deleted', content: '材料', status: 'deleted', author: userId, visibility: 'public' },
    ],
  };
  for (const name of Object.keys(records)) models[name] = { find: filter => ({ select() { return this; }, lean: async () => records[name].filter(row => matches(row, filter)) }) };
  const search = createSearchService(models);
  picks.length = 0;
  for (const role of roles) {
    setAccount(role);
    const ids = (await search('材料', { userId })).results.map(item => item.id).sort();
    assert.deepEqual(ids, role === 'student' ? ['own', 'public'] : ['event-draft', 'news-draft', 'notice-draft', 'own', 'public', 'resource-pending']);
    assert.equal(account.isAdmin, role === 'admin');
  }
  setAccount('student', true);
  assert.deepEqual((await search('材料', { userId })).results.map(item => item.id).sort(), ['club', 'own', 'public']);
  for (const fields of picks) assert.equal(fields, 'isEnrolled uniqueId role isAdmin');
});

test('real event router and JWT enforce live staff status; JWT role claims never grant content management', async () => {
  const express = req('express');
  const jwt = req('jsonwebtoken');
  const { createEventRouter } = req('./routes/eventRouter');
  let writes = 0;
  const service = { now: () => new Date(), create: async () => { writes++; return draft; } };
  const app = express(); app.use(express.json());
  app.use('/events', createEventRouter({ service, mediaService: null, mediaRouter: express.Router() }));
  const server = await new Promise((resolve, reject) => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); value.on('error', reject); });
  try {
    const send = token => fetch(`http://127.0.0.1:${server.address().port}/events`, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` }, body: '{}' });
    for (const role of roles) {
      setAccount(role);
      const token = jwt.sign({ userId, tokenVersion: 0, role: 'admin', isAdmin: true }, process.env.JWT_SECRET);
      assert.equal((await send(token)).status, role === 'student' ? 403 : 201);
      assert.equal(account.isAdmin, role === 'admin');
    }
    assert.equal(writes, 3);
    setAccount('teacher');
    const token = jwt.sign({ userId, tokenVersion: 0, role: 'teacher' }, process.env.JWT_SECRET);
    assert.equal((await send(token)).status, 201);
    setAccount('student');
    assert.equal((await send(token)).status, 403);
    assert.equal(writes, 4);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
