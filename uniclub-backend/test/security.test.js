const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Real Express routes, JWT verification and authorization middleware. Only the
// database and AI boundary are replaced: no live database writes or AI calls.
process.env.JWT_SECRET = 'security-regression-tests-only-never-use-in-production';
process.env.REQUIRE_ENROLLED_ROSTER = 'true';
const member = '111111111111111111111111';
const admin = '222222222222222222222222';
const stranger = '333333333333333333333333';
const item = 'aaaaaaaaaaaaaaaaaaaaaaaa';
let accounts, calls, resources, events, pastEvents, news;
const clone = (value) => structuredClone(value);
const query = (value) => ({
  select() { return this; }, populate() { return this; }, lean() { return this; },
  sort() { return this; }, limit() { return this; }, skip() { return this; },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
});
const stub = (name, exports) => {
  const id = require.resolve(name);
  require.cache[id] = { id, filename: id, loaded: true, exports };
};
const User = {
  findById: (id) => query(accounts[id] || null),
  findOne: (filter) => query(Object.values(accounts).find((u) =>
    Object.entries(filter).every(([key, value]) => value instanceof RegExp ? value.test(u[key]) : u[key] === value)
  ) || null),
  updateOne: async (filter, update) => {
    const u = accounts[filter._id];
    if (!u || u.isAdmin !== filter.isAdmin) return { modifiedCount: 0 };
    Object.assign(u, update.$set);
    u.tokenVersion = (u.tokenVersion || 0) + (update.$inc?.tokenVersion || 0);
    calls.push({ model: 'User', op: 'update', update: clone(update) });
    return { modifiedCount: 1 };
  },
  updateMany: () => { throw new Error('Bulk avatar mutation must never execute'); },
  create: async (data) => { calls.push({ model: 'User', op: 'create', data: clone(data) }); return data; },
};
stub('../models/User', User);
stub('../models/EnrolledUser', { findOne: () => query(null) });
function model(name, store) {
  return class {
    constructor(data) { Object.assign(this, { _id: item }, data); }
    async save() { calls.push({ model: name, op: 'create', data: clone(this.toObject()) }); store()[item] = this.toObject(); }
    async populate() { return this; }
    toObject() { return { ...this }; }
    static find(filter) { return query(Object.values(store()).filter((value) => Object.entries(filter).every(([k,v]) => value[k] === v)).map((value) => new this(value))); }
    static countDocuments() { return query(Object.keys(store()).length); }
    static aggregate(pipeline) {
      const match = pipeline.find((stage) => stage.$match)?.$match || {};
      return query(Object.values(store()).filter((value) => Object.entries(match).every(([k,v]) => value[k] === v)));
    }
    static findById(id) { return query(store()[id] || null); }
    static findByIdAndUpdate(id, update) {
      calls.push({ model: name, op: 'update', update: clone(update) });
      const value = store()[id];
      if (!value) return query(null);
      Object.assign(value, update.$set || update);
      for (const field of Object.keys(update.$unset || {})) delete value[field];
      return query(clone(value));
    }
    static findByIdAndDelete(id) {
      calls.push({ model: name, op: 'delete' });
      const value = store()[id]; delete store()[id]; return query(value || null);
    }
  };
}
const Resource = model('Resource', () => resources);
const Event = model('Event', () => events);
stub('../models/Resource', Resource);
stub('../models/Event', Event);
stub('../models/PastEvent', model('PastEvent', () => pastEvents));
stub('../models/News', model('News', () => news));
stub('../models/Comment', { aggregate: () => query([]) });
stub('../services/EventService', {
  async createEvent(data, organizer) {
    const result = new Event({ ...data, organizer }); await result.save(); return result;
  },
});
stub('../services/EngagementService', {});
stub('../services/ContentCurationService', {
  async curateFeaturedContent() { calls.push({ model: 'AI', op: 'curate' }); return {}; },
  async testCuration() { calls.push({ model: 'AI', op: 'test' }); return {}; },
});
stub('../services/NewsCurationService', class {
  async runMidnightCuration() { calls.push({ model: 'AI', op: 'news' }); }
});
stub('../services/DailyAiNewsService', {
  getDailyNewsService: () => ({
    async tick() { calls.push({ model: 'AI', op: 'news' }); return { started: false }; },
  }),
});
// Activity route guards use a small service fixture here. The separate
// activityMongo.integration.js exercises the actual service/CAS/Mongoose rules.
const activityPolicy = require('../utils/activityPolicy');
const eventFixture = {
  now: () => new Date(),
  async create(body, organizer) {
    const data = activityPolicy.validateInput(body);
    const result = new Event({ ...data, organizer, status: data.status || 'draft' }); await result.save(); return result;
  },
  async update(id, body) { return Event.findByIdAndUpdate(id, { $set: body }); },
  async readableEvent(id, userId) {
    const event = events[id];
    if (!event || (event.status !== 'published' && accounts[userId]?.isAdmin !== true)) throw activityPolicy.fail('Not found', 404, 'NOT_FOUND');
    return event;
  },
  async account(userId) { return accounts[userId]; },
  async list(userId, params) {
    if (params.status && params.status !== 'published' && accounts[userId]?.isAdmin !== true) throw activityPolicy.fail('Admin required', 403, 'ADMIN_REQUIRED');
    const rows = Object.values(events).filter(event => event.status === (params.status || 'published'));
    const result = { events: rows, pagination: { total: rows.length }, years: [], types: [] };
    Object.defineProperty(result, 'rawEvents', { value: rows }); return result;
  },
};
const app = express();
app.use(express.json());
for (const [name, router] of [
  ['cron', 'cronRouter'], ['users', 'userRouter'], ['curation', 'curationRouter'], ['past-events', 'pastEventRouter'],
  ['resources', 'resourceRouter'], ['events', 'eventRouter'], ['news', 'newsRouter'], ['auth', 'authRouter'],
]) {
  const loaded = require(`../routes/${router}`);
  app.use(`/api/${name}`, name === 'events' ? loaded.createEventRouter({ service: eventFixture, mediaService: null, mediaRouter: express.Router() }) : loaded);
}
const auth = require('../middleware/auth');
app.get('/protected', auth, (req, res) => res.json({ userId: req.user.userId }));
let server, origin;
const { authLimit, curationLimit } = require('../middleware/rateLimit');
before(async () => {
  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', (err) => err ? reject(err) : resolve());
    server.on('error', reject);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); });
beforeEach(() => {
  accounts = Object.fromEntries([member, admin, stranger].map((id) => [id, {
    _id: id, email: `${id}@example.com`, name: 'Test account', uniqueId: id,
    isAdmin: id === admin, tokenVersion: 0,
  }]));
  calls = [];
  delete process.env.CRON_SECRET;
  resources = { [item]: { _id: item, title: 'Reviewed', uploadedBy: member, status: 'approved',
    isApproved: true, isFeatured: true, approvedBy: admin, approvedAt: new Date() } };
  events = { [item]: { _id: item, title: 'Reviewed', organizer: member, status: 'published' } };
  pastEvents = { [item]: { _id: item, title: 'Gallery' } };
  news = {};
  authLimit.resetKey('127.0.0.1'); curationLimit.resetKey(admin);
});
const token = (id, extra = {}) => jwt.sign({ userId: id, tokenVersion: 0, ...extra }, process.env.JWT_SECRET);
async function request(method, path, id, body, overrideToken) {
  const response = await fetch(origin + path, {
    method, headers: {
      ...(id || overrideToken ? { Authorization: `Bearer ${overrideToken || token(id)}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  return { status: response.status, body: text.startsWith('{') ? JSON.parse(text) : text };
}
for (const id of [undefined, member, admin]) test(`removed avatar cleanup returns 404 (${id || 'anonymous'})`, async () => {
  assert.equal((await request('DELETE', '/api/users/cleanup-avatars', id)).status, 404);
  assert.deepEqual(calls, []);
});
for (const endpoint of ['/run', '/test']) {
  for (const [id, status] of [[undefined, 401], [member, 403], [admin, 200]]) {
    test(`curation ${endpoint}: ${id || 'anonymous'} -> ${status}`, async () => {
      assert.equal((await request('POST', `/api/curation${endpoint}`, id, {})).status, status);
      assert.equal(calls.filter((c) => c.model === 'AI').length, id === admin ? 1 : 0);
    });
  }
}
test('curation fourth run is rate limited across run/test routes', async () => {
  for (const path of ['/run', '/test', '/run']) assert.equal((await request('POST', '/api/curation' + path, admin, {})).status, 200);
  assert.equal((await request('POST', '/api/curation/test', admin, {})).status, 429);
  assert.equal(calls.length, 3);
});
const pastBody = { poster: { data: 'data:image/png;base64,AA==', contentType: 'image/png' },
  title: 'Event', subtitle: 'Class', date: '2026-09-30', body: 'Details' };
for (const [method, suffix, body] of [['POST', '', pastBody], ['PUT', '/' + item, { title: 'Updated' }], ['DELETE', '/' + item, undefined]]) {
  for (const [id, status] of [[undefined, 401], [member, 403], [admin, 200]]) {
    test(`past event ${method}: ${id || 'anonymous'} -> ${status}`, async () => {
      assert.equal((await request(method, '/api/past-events' + suffix, id, body)).status, status);
      assert.equal(calls.length, id === admin ? 1 : 0);
    });
  }
}
const resourceBody = { title: 'Handout', description: 'Class material', type: 'Document', category: 'Study' };
test('member resource submission is pending and cannot forge owner or counters', async () => {
  assert.equal((await request('POST', '/api/resources', member, { ...resourceBody, uploadedBy: admin, downloadCount: 999 })).status, 201);
  const data = calls[0].data;
  assert.equal(data.status, 'pending'); assert.equal(data.isApproved, false); assert.equal(data.uploadedBy, member);
  assert.equal(data.downloadCount, undefined); assert.equal(data.approvedBy, undefined);
});
for (const field of ['status', 'isApproved', 'approvedBy', 'approvedAt', 'isFeatured']) test(`member cannot submit review field ${field}`, async () => {
  assert.equal((await request('POST', '/api/resources', member, { ...resourceBody, [field]: field === 'status' ? 'approved' : true })).status, 403);
  assert.equal(calls.length, 0);
});
for (const field of ['status', 'isApproved', 'approvedBy', 'approvedAt', 'isFeatured']) test(`owner cannot update review field ${field}`, async () => {
  assert.equal((await request('PUT', '/api/resources/' + item, member, { [field]: field === 'status' ? 'approved' : true })).status, 403);
  assert.equal(calls.length, 0);
});
test('owner editing approved resource causes re-review and clears review metadata', async () => {
  const result = await request('PUT', '/api/resources/' + item, member, { title: 'Changed', uploadedBy: admin, likes: 999, $set: { status: 'approved' } });
  assert.equal(result.status, 200);
  assert.equal(resources[item].status, 'pending'); assert.equal(resources[item].isApproved, false);
  assert.equal(resources[item].isFeatured, false); assert.equal(resources[item].approvedBy, undefined);
  assert.equal(resources[item].approvedAt, undefined); assert.equal(resources[item].uploadedBy, member);
  assert.equal(resources[item].likes, undefined);
});
test('another member cannot modify resource', async () => {
  assert.equal((await request('PUT', '/api/resources/' + item, stranger, { title: 'Changed' })).status, 403);
  assert.equal(calls.length, 0);
});
test('administrator can approve and revoke resource with consistent metadata', async () => {
  resources[item].status = 'pending';
  assert.equal((await request('PUT', '/api/resources/' + item, admin, { status: 'approved', isFeatured: true })).status, 200);
  assert.equal(resources[item].isApproved, true); assert.equal(resources[item].approvedBy, admin);
  assert.ok(resources[item].approvedAt); assert.equal(resources[item].isFeatured, true);
  assert.equal((await request('PUT', '/api/resources/' + item, admin, { status: 'rejected' })).status, 200);
  assert.equal(resources[item].isApproved, false); assert.equal(resources[item].approvedBy, undefined);
  assert.equal(resources[item].isFeatured, false);
});
const eventBody = { title: 'Class meeting', description: 'Details', startDate: '2026-10-01', endDate: '2026-10-02', eventType: 'CLASS_MEETING', location: { type: 'physical', address: 'Classroom' } };
for (const method of ['POST', 'PUT']) test(`member cannot publish event with ${method}`, async () => {
  assert.equal((await request(method, '/api/events' + (method === 'PUT' ? '/' + item : ''), member, { ...eventBody, status: 'published' })).status, 403);
  assert.equal(calls.length, 0);
});
test('member cannot create a draft activity or forge ownership/counters', async () => {
  assert.equal((await request('POST', '/api/events', member, { ...eventBody, organizer: admin, likes: 999 })).status, 403);
  assert.equal(calls.length, 0);
});
test('legacy event ownership does not grant activity editing privileges', async () => {
  assert.equal((await request('PUT', '/api/events/' + item, member, { title: 'Changed', organizer: admin, isFeatured: true })).status, 403);
  assert.equal(events[item].status, 'published'); assert.equal(events[item].organizer, member); assert.equal(calls.length, 0);
});
test('another member cannot update event', async () => {
  assert.equal((await request('PUT', '/api/events/' + item, stranger, { title: 'Changed' })).status, 403);
  assert.equal(calls.length, 0);
});
test('administrator can publish event', async () => {
  assert.equal((await request('POST', '/api/events', admin, { ...eventBody, status: 'published' })).status, 201);
  assert.equal(calls[0].data.status, 'published');
});
const newsBody = { title: 'Class news', excerpt: 'Short description', content: 'Content', source: 'ClassHub' };
test('member news is pending without publication or recommendation metadata', async () => {
  assert.equal((await request('POST', '/api/news', member, newsBody)).status, 201);
  assert.equal(calls[0].data.status, 'pending'); assert.equal(calls[0].data.publishedAt, undefined);
  assert.equal(calls[0].data.isFeatured, false); assert.equal(calls[0].data.author, member);
});
for (const field of ['status', 'isFeatured', 'isTrending', 'publishedAt']) test(`member cannot control news ${field}`, async () => {
  assert.equal((await request('POST', '/api/news', member, { ...newsBody, [field]: field === 'status' ? 'approved' : true })).status, 403);
  assert.equal(calls.length, 0);
});
test('administrator can publish news', async () => {
  assert.equal((await request('POST', '/api/news', admin, newsBody)).status, 201);
  assert.equal(calls[0].data.status, 'approved'); assert.ok(calls[0].data.publishedAt);
});
for (const [path, body] of [
  ['/login', { uniqueId: '2023000000', password: 'Incorrect-password' }],
  ['/signup-step1', { email: 'invalid' }], ['/signup-step2', {}], ['/signup-step3', {}],
]) test(`sixth failed authentication attempt is limited on ${path}`, async () => {
  for (let i = 0; i < 5; i++) assert.equal((await request('POST', '/api/auth' + path, undefined, body)).status, 400);
  assert.equal((await request('POST', '/api/auth' + path, undefined, body)).status, 429);
});
test('successful signup validation does not consume failed-attempt quota', async () => {
  for (let i = 0; i < 7; i++) assert.equal((await request('POST', '/api/auth/signup-step1', undefined, { email: 'new@example.com' })).status, 200);
});
test('login includes token version, hides password hash and allows repeated successful logins', async () => {
  accounts[admin].passwordHash = await bcrypt.hash('Regression-test-password', 4);
  accounts[admin].tokenVersion = 4;
  for (let i = 0; i < 6; i++) {
    const result = await request('POST', '/api/auth/login', undefined, { uniqueId: accounts[admin].uniqueId, password: 'Regression-test-password' });
    assert.equal(result.status, 200); assert.equal(result.body.user.passwordHash, undefined);
    assert.equal(jwt.verify(result.body.token, process.env.JWT_SECRET).tokenVersion, 4);
  }
});
test('revoked and legacy tokens fail after password rotation; new version succeeds', async () => {
  accounts[admin].tokenVersion = 1;
  assert.equal((await request('GET', '/protected', admin)).status, 401);
  const legacy = jwt.sign({ userId: admin }, process.env.JWT_SECRET);
  assert.equal((await request('GET', '/protected', undefined, undefined, legacy)).status, 401);
  assert.equal((await request('GET', '/protected', undefined, undefined, token(admin, { tokenVersion: 1 }))).status, 200);
});
test('malformed identity, missing user, and wrong signature fail closed', async () => {
  assert.equal((await request('GET', '/protected', undefined, undefined, token('invalid'))).status, 401);
  delete accounts[member]; assert.equal((await request('GET', '/protected', member)).status, 401);
  const bad = jwt.sign({ userId: admin }, 'different-test-key');
  assert.equal((await request('GET', '/protected', undefined, undefined, bad)).status, 401);
});
test('rotation utility hashes the new password and revokes existing tokens', async () => {
  const { rotateAdminPassword } = require('../scripts/rotateAdminPassword');
  await rotateAdminPassword(accounts[admin].email, 'New-regression-test-password');
  assert.equal(accounts[admin].tokenVersion, 1);
  assert.equal(await bcrypt.compare('New-regression-test-password', accounts[admin].passwordHash), true);
  await assert.rejects(rotateAdminPassword(accounts[member].email, 'New-regression-test-password'), /管理员/);
  await assert.rejects(rotateAdminPassword(accounts[admin].email, 'short'), /12/);
});

for (const [path, store, status] of [
  ['/api/resources', () => resources, 'pending'], ['/api/events', () => events, 'draft'],
]) {
  for (const [id, expected] of [[undefined, 404], [stranger, 404], [member, 200], [admin, 200]]) {
    test(`non-public detail ${path}: ${id || 'anonymous'} -> ${path === '/api/events' ? (id === undefined ? 401 : id === admin ? 200 : 404) : expected}`, async () => {
      store()[item].status = status;
      assert.equal((await request('GET', path + '/' + item, id)).status, path === '/api/events' ? (id === undefined ? 401 : id === admin ? 200 : 404) : expected);
    });
  }
  for (const [id, expected] of [[undefined, 401], [member, 403], [admin, 200]]) {
    test(`non-public list ${path}: ${id || 'anonymous'} -> ${expected}`, async () => {
      store()[item].status = status;
      assert.equal((await request('GET', path + '?status=' + status, id)).status, expected);
    });
  }
  test(`published detail obeys the content access rule ${path}`, async () => {
    assert.equal((await request('GET', path + '/' + item)).status, path === '/api/events' ? 401 : 200);
    if (path === '/api/events') assert.equal((await request('GET', path + '/' + item, member)).status, 200);
  });
}
test('cron without a configured secret fails closed', async () => {
  assert.equal((await request('GET', '/api/cron/news-curation')).status, 503);
  assert.equal(calls.length, 0);
});
test('cron rejects missing and incorrect secrets without invoking AI', async () => {
  process.env.CRON_SECRET = 'test-cron-secret';
  assert.equal((await request('GET', '/api/cron/news-curation')).status, 401);
  assert.equal((await request('GET', '/api/cron/news-curation', undefined, undefined, 'wrong')).status, 401);
  assert.equal(calls.length, 0);
});
test('cron with correct secret invokes the scheduler service', async () => {
  process.env.CRON_SECRET = 'test-cron-secret';
  assert.equal((await request('GET', '/api/cron/news-curation', undefined, undefined, 'test-cron-secret')).status, 200);
  assert.equal(calls[0].op, 'news');
});
for (const [id, expected] of [[undefined, 401], [member, 403]]) test(`news curation alias rejects ${id || 'anonymous'}`, async () => {
  assert.equal((await request('POST', '/api/news/trigger-curation', id, {})).status, expected);
  assert.equal(calls.length, 0);
});
test('news curation alias shares the administrator quota', async () => {
  for (let i = 0; i < 3; i++) assert.equal((await request('POST', '/api/curation/run', admin, {})).status, 200);
  assert.equal((await request('POST', '/api/news/trigger-curation', admin, {})).status, 429);
  assert.equal(calls.length, 3);
});
test('news curation alias is retired even for an administrator and cannot run the old importer', async () => {
  assert.equal((await request('POST', '/api/news/trigger-curation', admin, {})).status, 410);
  assert.equal(calls.length, 0);
});
test('administrator claims in a JWT cannot override the database role', async () => {
  assert.equal((await request('POST', '/api/curation/run', undefined, {}, token(member, { isAdmin: true }))).status, 403);
  accounts[admin].isAdmin = false;
  assert.equal((await request('POST', '/api/curation/run', admin, {})).status, 403);
  assert.equal(calls.length, 0);
});
for (const [route, body] of [['resources', resourceBody], ['events', eventBody], ['news', newsBody]]) {
  test(`anonymous ${route} creation requires login`, async () => {
    assert.equal((await request('POST', '/api/' + route, undefined, body)).status, 401);
    assert.equal(calls.length, 0);
  });
  test(`invalid ${route} status is rejected even for an administrator`, async () => {
    assert.equal((await request('POST', '/api/' + route, admin, { ...body, status: 'invalid' })).status, 400);
    assert.equal(calls.length, 0);
  });
}

test('student ID login works without email and retains JWT authentication', async () => {
  const uniqueId = '2023000001';
  accounts[member].uniqueId = uniqueId;
  delete accounts[member].email;
  accounts[member].passwordHash = await bcrypt.hash(uniqueId, 4);
  const result = await request('POST', '/api/auth/login', undefined, { uniqueId: ` ${uniqueId} `, password: uniqueId });
  assert.equal(result.status, 200);
  assert.equal(result.body.user.email, '');
  assert.equal(result.body.user.uniqueId, uniqueId);
  assert.equal(result.body.user.isAdmin, false);
  assert.equal(result.body.user.passwordHash, undefined);
  assert.equal((await request('GET', '/protected', undefined, undefined, result.body.token)).status, 200);
  const me = await request('GET', '/api/auth/me', undefined, undefined, result.body.token);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, '');
  assert.equal(me.body.user.uniqueId, uniqueId);
});

test('email alone can no longer authenticate even with the correct password', async () => {
  accounts[member].passwordHash = await bcrypt.hash('Existing-password', 4);
  const result = await request('POST', '/api/auth/login', undefined, { email: accounts[member].email, password: 'Existing-password' });
  assert.equal(result.status, 400);
  assert.equal(result.body.token, undefined);
});

for (const body of [
  { uniqueId: { $ne: null }, password: '2023000001' },
  { uniqueId: '2023000001', password: { $ne: null } },
  { uniqueId: ['2023000001'], password: '2023000001' },
]) test('login rejects malformed identity/password types', async () => {
  assert.equal((await request('POST', '/api/auth/login', undefined, body)).status, 400);
});

test('unknown ID and wrong password produce the same login failure', async () => {
  accounts[member].passwordHash = await bcrypt.hash('Existing-password', 4);
  const wrong = await request('POST', '/api/auth/login', undefined, { uniqueId: accounts[member].uniqueId, password: 'Wrong-password' });
  const missing = await request('POST', '/api/auth/login', undefined, { uniqueId: '2023000099', password: 'Wrong-password' });
  assert.equal(wrong.status, 400);
  assert.deepEqual(wrong, missing);
});

test('legacy administrator ID uses the existing password and role', async () => {
  accounts[admin].uniqueId = 'ADMIN-admin';
  accounts[admin].passwordHash = await bcrypt.hash('Existing-admin-password', 4);
  accounts[admin].tokenVersion = 8;
  const result = await request('POST', '/api/auth/login', undefined, { uniqueId: 'ADMIN-admin', password: 'Existing-admin-password' });
  assert.equal(result.status, 200);
  assert.equal(result.body.user.isAdmin, true);
  assert.equal(jwt.verify(result.body.token, process.env.JWT_SECRET).tokenVersion, 8);
});
