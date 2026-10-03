const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ActualUser = require('../models/User');
const ActualRoster = require('../models/EnrolledUser');
const { validateEntries, parseRosterText } = require('../utils/rosterPolicy');
const { prepareStudentLogin } = require('../scripts/prepareStudentLogin');

process.env.JWT_SECRET = 'student-roster-regression-tests-only';
const adminId = '111111111111111111111111';
const memberId = '222222222222222222222222';
let users, roster, writes, sequence;
const matches = (row, filter) => Object.entries(filter).every(([key, value]) =>
  key === '$or' ? value.some(part => matches(row, part)) : value instanceof RegExp ? value.test(row[key] || '') : row[key] === value);
const query = (initial) => {
  let value = initial;
  return {
    select() { return this; }, lean() { return this; },
    sort() { if (Array.isArray(value)) value = [...value].sort((a, b) => a.uniqueId.localeCompare(b.uniqueId)); return this; },
    skip(n) { if (Array.isArray(value)) value = value.slice(n); return this; },
    limit(n) { if (Array.isArray(value)) value = value.slice(0, n); return this; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
};
function memoryModel(name, store) {
  return {
    findOne: filter => query(store().find(row => matches(row, filter)) || null),
    findById: id => query(store().find(row => row._id === id) || null),
    find: filter => query(store().filter(row => matches(row, filter))),
    countDocuments: filter => Promise.resolve(store().filter(row => matches(row, filter)).length),
    distinct: key => Promise.resolve([...new Set(store().map(row => row[key]).filter(value => value !== undefined))]),
    async create(data) {
      const row = { _id: (++sequence).toString(16).padStart(24, '0'), tokenVersion: 0, ...structuredClone(data) };
      store().push(row); writes.push({ name, op: 'create' }); return row;
    },
    async updateOne(filter, update) {
      const row = store().find(row => matches(row, filter));
      if (row) Object.assign(row, update.$set);
      writes.push({ name, op: 'update' }); return { modifiedCount: row ? 1 : 0 };
    },
    async findOneAndUpdate(filter, update, options) {
      let row = store().find(row => matches(row, filter));
      if (!row && options.upsert) row = await this.create(filter);
      if (row) Object.assign(row, structuredClone(update.$set));
      writes.push({ name, op: 'upsert' }); return row;
    },
    async findByIdAndDelete(id) {
      const index = store().findIndex(row => row._id === id);
      if (index < 0) return null;
      writes.push({ name, op: 'delete' }); return store().splice(index, 1)[0];
    },
  };
}
const UserModel = memoryModel('users', () => users);
const RosterModel = memoryModel('roster', () => roster);
function stub(name, exports) {
  const id = require.resolve(name);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub('../models/User', UserModel);
stub('../models/EnrolledUser', RosterModel);
// Unrelated admin modules are not exercised and never access live services.
stub('../routes/quantificationRouter', { adminRouter: express.Router() });
for (const name of ['announcements', 'gallery', 'ai']) stub(`../routes/admin/${name}`, express.Router());
const RosterService = require('../services/RosterService');
const service = () => new RosterService({ UserModel, RosterModel, hashPassword: password => bcrypt.hash(password, 4) });
const app = express();
app.use(express.json());
app.use('/api/admin', require('../routes/adminRouter'));
let server, origin;
before(async () => {
  server = await new Promise((resolve, reject) => {
    const started = app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve(started));
    started.on('error', reject);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); });
beforeEach(() => {
  users = [
    { _id: adminId, uniqueId: 'ADMIN-admin', name: 'Administrator', isAdmin: true, tokenVersion: 3 },
    { _id: memberId, uniqueId: '2023000001', name: 'Existing member', isAdmin: false, tokenVersion: 0 },
  ];
  roster = []; writes = []; sequence = 10;
});
async function request(method, path, id, body, extra = {}) {
  const account = users.find(row => row._id === id);
  const response = await fetch(origin + path, {
    method,
    headers: {
      ...(id ? { Authorization: `Bearer ${jwt.sign({ userId: id, tokenVersion: account?.tokenVersion || 0, ...extra }, process.env.JWT_SECRET)}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

for (const text of [
  '2023000002,张三\n2023000003,李四',
  '学号\t姓名\n2023000002\t张三\n2023000003\t李四',
  '\n\uFEFF姓名,学号\n张三,2023000002\n李四,2023000003\n',
  '张三 2023000002\n李四 2023000003',
  '学号，姓名\n2023000002，张三\n2023000003，李四',
]) test('two-column roster supports Excel paste and CSV without email', () => {
  assert.deepEqual(validateEntries(parseRosterText(text)), [
    { uniqueId: '2023000002', name: '张三' }, { uniqueId: '2023000003', name: '李四' },
  ]);
});
test('old email CSV and quoted names remain compatible', () => {
  assert.deepEqual(validateEntries(parseRosterText('email,name,uniqueId\nTEST@example.com,"张,三",2023000002')), [
    { uniqueId: '2023000002', name: '张,三', email: 'test@example.com' },
  ]);
  assert.equal(validateEntries(parseRosterText('test@example.com,张三,2023000002'))[0].email, 'test@example.com');
});
test('schema validates email-less students and keeps student IDs unique', async () => {
  const data = { uniqueId: '2023000002', name: 'Student', passwordHash: 'already-hashed' };
  await new ActualUser(data).validate();
  await new ActualRoster(data).validate();
  for (const schema of [ActualUser.schema, ActualRoster.schema]) {
    const index = schema.indexes().find(([, options]) => options.name === 'email_optional_unique');
    assert.deepEqual(index[1].partialFilterExpression, { email: { $type: 'string' } });
    assert.equal(index[1].unique, true);
    assert.equal(schema.path('uniqueId').options.unique, true);
  }
  await assert.rejects(new ActualUser({ ...data, email: 'invalid' }).validate());
});
test('49 students receive usable hashed initial passwords and no administrator privileges', async () => {
  users = [];
  const entries = Array.from({ length: 49 }, (_, i) => ({ uniqueId: String(2023000100 + i), name: `Student ${i + 1}` }));
  const result = await service().import(entries);
  assert.deepEqual({ created: result.created, accountsCreated: result.accountsCreated, failed: result.failed, total: result.total }, { created: 49, accountsCreated: 49, failed: 0, total: 49 });
  assert.equal(users.length, 49);
  for (const account of users) {
    assert.notEqual(account.passwordHash, account.uniqueId);
    assert.equal(await bcrypt.compare(account.uniqueId, account.passwordHash), true);
    assert.equal(account.isAdmin, false);
    assert.equal(account.isEnrolled, true);
    assert.equal(account.email, undefined);
  }
  const hashes = users.map(row => row.passwordHash);
  const repeated = await service().import(entries);
  assert.equal(repeated.accountsCreated, 0);
  assert.equal(repeated.updated, 49);
  assert.deepEqual(users.map(row => row.passwordHash), hashes);
});
test('existing passwords, roles, contact details and profiles survive reimport', async () => {
  const account = users[1];
  Object.assign(account, { passwordHash: await bcrypt.hash('Changed-password', 4), tokenVersion: 9, email: 'existing@example.com', profile: { bio: 'Keep this' }, isAdmin: true, isEnrolled: false });
  const expected = structuredClone(account);
  const result = await service().upsert({ uniqueId: account.uniqueId, name: 'Updated roster name' });
  assert.equal(result.accountCreated, false);
  assert.deepEqual(account, { ...expected, isEnrolled: true });
  assert.equal(await bcrypt.compare('Changed-password', account.passwordHash), true);
  assert.equal(roster[0].name, 'Updated roster name');
});
test('dry run performs no writes or password hashing', async () => {
  const result = await new RosterService({ UserModel, RosterModel, hashPassword() { throw new Error('must not hash'); } }).import([{ uniqueId: '2023000002', name: 'Student' }], { dryRun: true });
  assert.equal(result.accountsCreated, 1);
  assert.deepEqual(writes, []);
  assert.equal(roster.length, 0);
});
for (const entries of [
  [{ uniqueId: '2023000002', name: 'One' }, { uniqueId: '2023000002', name: 'Duplicate' }],
  [{ uniqueId: '2023000002', name: 'One' }, { uniqueId: { $ne: null }, name: 'Invalid' }],
  [{ uniqueId: '2023000002', name: 'One', email: 'same@example.com' }, { uniqueId: '2023000003', name: 'Two', email: 'same@example.com' }],
]) test('invalid or duplicate roster input is rejected before writing', async () => {
  await assert.rejects(service().import(entries));
  assert.deepEqual(writes, []);
});
test('email conflicts are checked across all records before creating accounts', async () => {
  users[1].email = 'existing@example.com';
  await assert.rejects(service().import([
    { uniqueId: '2023000002', name: 'One' }, { uniqueId: '2023000003', name: 'Two', email: users[1].email },
  ]), /其他学号/);
  assert.deepEqual(writes, []);
});
test('optional email index is created before only the obsolete email index is removed', async () => {
  const operations = [], collections = new Map();
  const db = { collection(name) {
    if (!collections.has(name)) collections.set(name, [{ name: '_id_', key: { _id: 1 } }, { name: 'email_1', key: { email: 1 }, unique: true }, { name: 'uniqueId_1', key: { uniqueId: 1 }, unique: true }, { name: 'other_1', key: { email: 1, name: 1 }, unique: true }]);
    return {
      async createIndex(key, options) { operations.push(`${name}:create`); if (!collections.get(name).some(index => index.name === options.name)) collections.get(name).push({ key, ...options }); },
      async indexes() { return structuredClone(collections.get(name)); },
      async dropIndex(indexName) { operations.push(`${name}:drop:${indexName}`); collections.set(name, collections.get(name).filter(index => index.name !== indexName)); },
    };
  } };
  await prepareStudentLogin(db);
  assert.deepEqual(operations, ['users:create', 'users:drop:email_1', 'EnrolledUser:create', 'EnrolledUser:drop:email_1']);
  await prepareStudentLogin(db);
  assert.equal(operations.filter(op => op.includes(':drop:')).length, 2);
  for (const indexes of collections.values()) assert.deepEqual(indexes.map(index => index.name), ['_id_', 'uniqueId_1', 'other_1', 'email_optional_unique']);
});
for (const [id, expected] of [[undefined, 401], [memberId, 403]]) {
  for (const [method, path, body] of [
    ['GET', '/api/admin/roster', undefined],
    ['POST', '/api/admin/roster', { uniqueId: '2023000002', name: 'Student' }],
    ['POST', '/api/admin/roster/bulk', { text: '2023000002,Student' }],
  ]) test(`roster ${method} requires administrator access (${expected})`, async () => {
    const result = await request(method, path, id, body, { isAdmin: true });
    assert.equal(result.status, expected);
    assert.deepEqual(writes, []);
  });
}
test('administrator can add and bulk import students with only ID and name', async () => {
  const added = await request('POST', '/api/admin/roster', adminId, { uniqueId: '2023000002', name: 'Student', isAdmin: true, passwordHash: 'forged' });
  assert.equal(added.status, 201);
  assert.equal(added.body.accountCreated, true);
  const account = users.find(row => row.uniqueId === '2023000002');
  assert.equal(account.isAdmin, false);
  assert.equal(await bcrypt.compare(account.uniqueId, account.passwordHash), true);
  assert.equal(added.body.entry.passwordHash, undefined);
  const bulk = await request('POST', '/api/admin/roster/bulk', adminId, { text: '学号\t姓名\n2023000003\tStudent three\n2023000004\tStudent four' });
  assert.equal(bulk.status, 200);
  assert.equal(bulk.body.accountsCreated, 2);
  assert.equal(bulk.body.total, 3);
});
test('roster counts accounts by student ID and excludes administrator outside roster', async () => {
  roster.push({ _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', uniqueId: users[1].uniqueId, name: 'Member' }, { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', uniqueId: '2023000002', name: 'No account' });
  const result = await request('GET', '/api/admin/roster?search=Member', adminId);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.summary, { total: 2, registered: 1 });
  assert.equal(result.body.roster.length, 1);
  assert.equal(result.body.roster[0].registered, true);
  assert.equal(result.body.roster[0].email, '');
});
test('removing a roster record preserves the existing login account', async () => {
  const row = await service().upsert({ uniqueId: users[1].uniqueId, name: 'Member' });
  const result = await request('DELETE', `/api/admin/roster/${row.entry.id}`, adminId);
  assert.equal(result.status, 200);
  assert.equal(roster.length, 0);
  assert.equal(users.length, 2);
});
