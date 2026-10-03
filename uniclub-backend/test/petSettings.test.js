const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/User');
const { NOTIFICATION_DEFAULTS } = require('../utils/accountSettingsPolicy');
const { PET_DEFAULTS, resolveUserSettings } = require('../utils/petSettingsPolicy');

process.env.JWT_SECRET = 'classhub-pet-test-only-never-use-in-production';
const a = '111111111111111111111111';
const b = '222222222222222222222222';
const admin = '333333333333333333333333';
let accounts, writes, databaseFails;
const query = value => ({
  select() { return this; }, lean() { return this; },
  then(resolve, reject) {
    return (databaseFails ? Promise.reject(new Error('Database unavailable')) : Promise.resolve(value)).then(resolve, reject);
  },
});
const fakeUser = {
  findById: id => query(accounts[id] || null),
  findByIdAndUpdate: (id, update, options) => {
    const account = accounts[id];
    if (!databaseFails && account) {
      writes.push({ id, update: structuredClone(update), options });
      account.settings ||= {};
      for (const [key, value] of Object.entries(update.$set)) account.settings[key.slice('settings.'.length)] = value;
    }
    return query(account || null);
  },
};
const moduleId = require.resolve('../models/User');
require.cache[moduleId] = { id: moduleId, filename: moduleId, loaded: true, exports: fakeUser };
const app = express();
app.use(express.json());
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
  accounts = Object.fromEntries([a, b, admin].map(id => [id, {
    _id: id, tokenVersion: 0, isAdmin: id === admin,
    settings: { profileVisibility: 'private', emailNotifications: false },
  }]));
  writes = []; databaseFails = false;
});
const token = (id, extra = {}) => jwt.sign({ userId: id, tokenVersion: 0, ...extra }, process.env.JWT_SECRET);
async function request(method, id, body, suffix = '', credential) {
  const response = await fetch(`${origin}/api/users/me/settings${suffix}`, {
    method, headers: {
      ...(id || credential ? { Authorization: `Bearer ${credential || token(id)}` } : {}),
      'Content-Type': 'application/json',
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = response.headers.get('content-type')?.includes('application/json')
    ? await response.json() : { error: await response.text() };
  return { status: response.status, data, headers: response.headers };
}

test('anonymous reads and writes are refused', async () => {
  assert.equal((await request('GET')).status, 401);
  assert.equal((await request('PATCH', null, { petEnabled: false })).status, 401);
  assert.equal(writes.length, 0);
});
test('forged, revoked and deleted-account tokens cannot update settings', async () => {
  const forged = jwt.sign({ userId: a }, 'another-secret');
  assert.equal((await request('PATCH', a, { petEnabled: false }, '', forged)).status, 401);
  accounts[a].tokenVersion = 1;
  assert.equal((await request('PATCH', a, { petEnabled: false })).status, 401);
  delete accounts[a];
  assert.equal((await request('GET', a)).status, 401);
  assert.equal(writes.length, 0);
});
test('legacy users receive defaults without overwriting existing personal settings', async () => {
  const result = await request('GET', a);
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.settings, { ...accounts[a].settings, ...PET_DEFAULTS, notifications: NOTIFICATION_DEFAULTS });
  assert.equal(result.headers.get('cache-control'), 'private, no-store');
  assert.equal(writes.length, 0);
  assert.equal('passwordHash' in result.data, false);
});
test('partial account preferences persist and preserve other fields', async () => {
  const patch = { petSkin: 'whale', petSize: 160, petVolume: 65, petPokeAction: 'dance', petCelebrateAction: 'breach' };
  const saved = await request('PATCH', a, patch);
  assert.equal(saved.status, 200);
  assert.deepEqual(Object.fromEntries(Object.keys(patch).map(key => [key, saved.data.settings[key]])), patch);
  assert.equal((await request('GET', a)).data.settings.petSize, 160);
  assert.equal(accounts[a].settings.profileVisibility, 'private');
  assert.equal(accounts[a].settings.emailNotifications, false);
  assert.equal((await request('GET', b)).data.settings.petSkin, 'panda');
  assert.equal(writes[0].id, a);
  assert.equal(writes[0].options.runValidators, true);
});
test('normal users and administrators can only target their own account', async () => {
  for (const id of [a, admin]) {
    assert.equal((await request('PATCH', id, { petEnabled: false, userId: b })).status, 400);
    assert.equal((await request('PATCH', id, { petEnabled: false }, `?userId=${b}`)).status, 400);
    assert.equal((await request('PATCH', id, { petEnabled: false })).status, 200);
    assert.equal(writes.at(-1).id, id);
  }
  assert.equal(resolveUserSettings(accounts[b].settings).petEnabled, true);
});
test('every bundled skin persists through the API and passes the database schema', async () => {
  const { skins } = require('../../shared/pet-settings.json');
  for (const petSkin of skins) {
    assert.equal((await request('PATCH', a, { petSkin })).status, 200);
    assert.equal((await request('GET', a)).data.settings.petSkin, petSkin);
    const user = new UserModel({ name: 'Pet schema', uniqueId: 'SKIN', passwordHash: 'hash', settings: { petSkin } });
    assert.equal(user.validateSync(), undefined);
  }
  assert.equal((await request('GET', b)).data.settings.petSkin, 'panda');
});
for (const [label, body] of [
  ['empty patch', {}], ['array', []], ['null', null], ['string flag', { petMuted: 'true' }],
  ['invalid skin', { petSkin: 'third-party-character' }], ['remote skin URL', { petSkin: 'https://example.com/pet.png' }],
  ['size too small', { petSize: 71 }], ['size too large', { petSize: 201 }], ['fractional size', { petSize: 120.5 }],
  ['opacity too low', { petOpacity: 0.19 }], ['opacity too high', { petOpacity: 1.1 }],
  ['volume too high', { petVolume: 101 }], ['negative hue', { petHue: -1 }], ['hue too high', { petHue: 361 }],
  ['unknown action', { petPokeAction: 'inject' }], ['local position', { petPositionX: 50 }],
  ['nested settings', { settings: { petEnabled: false } }], ['privilege escalation', { isAdmin: true }],
  ['Mongo operator', { $set: { petEnabled: false } }], ['dot path', { 'settings.petEnabled': false }],
  ['mixed valid and invalid', { petSkin: 'whale', petSize: '200' }],
]) test(`rejects ${label} atomically`, async () => {
  assert.equal((await request('PATCH', a, body)).status, 400);
  assert.equal(writes.length, 0);
  assert.equal(accounts[a].settings.petSkin, undefined);
});
test('all boundary values and existing general settings are accepted', async () => {
  const patch = { ...PET_DEFAULTS, petSize: 72, petOpacity: 0.2, petVolume: 0, petHue: 360,
    profileVisibility: 'public', emailNotifications: true, commentNotifications: false };
  assert.equal((await request('PATCH', a, patch)).status, 200);
  assert.equal((await request('PATCH', a, { petSize: 200, petOpacity: 1, petVolume: 100 })).status, 200);
});
test('database failure is a controlled 503 response', async () => {
  databaseFails = true;
  assert.equal((await request('GET', a)).status, 503);
  assert.equal((await request('PATCH', a, { petEnabled: false })).status, 503);
});
test('Mongoose schema has defaults and rejects out-of-range and unknown action values', async () => {
  const member = new UserModel({ name: 'Fixture', uniqueId: 'PET-UNIT', passwordHash: 'unusable' });
  assert.equal(member.settings.petEnabled, true);
  assert.equal(member.settings.petSkin, 'panda');
  member.settings.petSize = 201;
  member.settings.petPokeAction = 'bad';
  member.settings.petOpacity = 0.1;
  await assert.rejects(member.validate(), error => Boolean(error.errors['settings.petSize'] && error.errors['settings.petPokeAction'] && error.errors['settings.petOpacity']));
});
