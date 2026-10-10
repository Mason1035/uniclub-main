const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { createRandomCallMembersService } = require('../services/RandomCallMembersService');

process.env.JWT_SECRET = 'isolated-random-call-tests-only';
const memberId = '111111111111111111111111';
const adminId = '222222222222222222222222';
const outsiderId = '333333333333333333333333';
let users, roster, reads, rosterFailure;
const get = (row, path) => path.split('.').reduce((value, key) => value?.[key], row);
function project(row, fields) {
  if (!row) return null;
  const result = { _id: row._id };
  for (const path of fields.split(' ')) {
    const value = get(row, path);
    if (value === undefined) continue;
    const keys = path.split('.');
    let target = result;
    for (const key of keys.slice(0, -1)) target = target[key] ||= {};
    target[keys.at(-1)] = value;
  }
  return result;
}
const query = (value, source) => ({
  select(fields) {
    reads.push({ source, fields });
    value = Array.isArray(value) ? value.map(row => project(row, fields)) : project(value, fields);
    return this;
  },
  sort() { return this; },
  lean() { return this; },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
});
const UserModel = {
  findById(id) { return query(users.find(user => user._id === id), 'account'); },
  find(filter) {
    reads.push({ source: 'pool', filter });
    return query(users.filter(user => user.isEnrolled === filter.isEnrolled && filter.uniqueId.$in.includes(user.uniqueId)), 'pool');
  },
};
const RosterModel = { async distinct(field) {
  assert.equal(field, 'uniqueId');
  if (rosterFailure) throw new Error('database failure must not reach client');
  return [...new Set(roster.map(row => row.uniqueId))];
} };
function stub(path, exports) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub('../models/User', UserModel);
stub('../models/EnrolledUser', RosterModel);
const service = createRandomCallMembersService({ UserModel, RosterModel });
const app = express();
app.use('/api/users', require('../routes/userRouter'));
let server, origin;
before(async () => {
  server = await new Promise((resolve, reject) => {
    const started = app.listen(0, '127.0.0.1', () => resolve(started));
    started.on('error', reject);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); });
beforeEach(() => {
  users = [
    { _id: memberId, uniqueId: 'member', name: '班级成员', isEnrolled: true, tokenVersion: 0, email: 'private@example.com', passwordHash: 'secret' },
    { _id: adminId, uniqueId: 'student-admin', name: '班级管理员', isEnrolled: true, isAdmin: true, tokenVersion: 0, profile: { avatar: { contentType: 'image/webp', data: 'private-image-data' } } },
    { _id: outsiderId, uniqueId: 'external-admin', name: '外部账号', isEnrolled: true, isAdmin: true, tokenVersion: 0 },
    { _id: '444444444444444444444444', uniqueId: 'inactive', name: '无效账号', isEnrolled: false, tokenVersion: 0 },
    { _id: '555555555555555555555555', uniqueId: 'removed', name: '已移出班级', isEnrolled: true, tokenVersion: 0 },
    { _id: '666666666666666666666666', uniqueId: 'invalid-name', name: '   ', isEnrolled: true, tokenVersion: 0 },
  ];
  roster = ['member', 'student-admin', 'inactive', 'invalid-name', 'deleted-account'].map(uniqueId => ({ uniqueId }));
  reads = []; rosterFailure = false;
});
const token = (id = memberId, version = 0) => jwt.sign({ userId: id, tokenVersion: version }, process.env.JWT_SECRET);
const request = auth => fetch(`${origin}/api/users/random-call-members`, {
  headers: auth ? { Authorization: `Bearer ${auth}` } : {},
});

test('pool is current roster intersected with enrolled accounts, including the student administrator', async () => {
  const members = await service(memberId);
  assert.deepEqual(members.map(member => member.id), [memberId, adminId]);
  const poolRead = reads.find(read => read.filter);
  assert.equal(poolRead.filter.isAdmin, undefined);
  assert.equal(poolRead.filter.isEnrolled, true);
  assert.ok(poolRead.filter.uniqueId.$in.includes('student-admin'));
});

test('response is minimal and reuses avatar endpoint; secrets and image data are never selected', async () => {
  const members = await service(memberId);
  assert.deepEqual(members, [
    { id: memberId, name: '班级成员', avatar: null },
    { id: adminId, name: '班级管理员', avatar: `/api/users/avatar/${adminId}` },
  ]);
  assert.deepEqual(reads.filter(read => read.fields).map(read => read.fields), [
    'uniqueId isEnrolled', '_id name profile.avatar.contentType',
  ]);
  for (const member of members) assert.deepEqual(Object.keys(member).sort(), ['avatar', 'id', 'name']);
});

test('unknown, unenrolled and out-of-roster accounts cannot read the class pool, even as administrators', async () => {
  for (const id of [outsiderId, '444444444444444444444444', '777777777777777777777777', '555555555555555555555555']) {
    await assert.rejects(service(id), error => error.status === 403);
  }
  assert.ok(!reads.some(read => read.source === 'pool'));
});

test('empty eligible pool remains an array and unsupported avatars use the existing frontend fallback', async () => {
  users[1].profile.avatar.contentType = 'unsupported/type';
  assert.equal((await service(memberId))[1].avatar, null);
  users[0].name = ''; users[1].name = '';
  assert.deepEqual(await service(memberId), []);
});

test('real endpoint rejects guest, invalid and revoked JWTs before exposing members', async () => {
  for (const auth of [undefined, 'invalid', token(memberId, 1), token('777777777777777777777777')]) {
    const response = await request(auth);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).members, undefined);
  }
  assert.ok(!reads.some(read => read.source === 'pool'));
});

test('real endpoint permits member and class administrator but rejects an outside administrator', async () => {
  for (const id of [memberId, adminId]) {
    const response = await request(token(id));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual((await response.json()).members.map(member => member.id), [memberId, adminId]);
  }
  const outsider = await request(token(outsiderId));
  assert.equal(outsider.status, 403);
  assert.equal((await outsider.json()).members, undefined);
});

test('database failures return a controlled unavailable response without database details', async () => {
  rosterFailure = true;
  const response = await request(token());
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error, '暂时无法获取班级名单，请重新加载。');
  assert.equal(body.members, undefined);
});
