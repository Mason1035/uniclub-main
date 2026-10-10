const { test } = require('node:test');
const assert = require('node:assert/strict');
const policy = require('../utils/activityPolicy');
const { eventDTO } = require('../services/ActivityService');
const mongoose = require('mongoose');
const base = { _id: new mongoose.Types.ObjectId(), title: '活动', description: '完整介绍', eventType: 'CLASS_MEETING', status: 'published',
  startDate: new Date('2026-10-10T00:00:00Z'), endDate: new Date('2026-10-10T02:00:00Z'), location: { type: 'physical', address: '教室' }, maxCapacity: null, rsvpDeadline: null };
test('canonical classifications and lifecycle/time states stay separate', () => {
  assert.equal(policy.meta.types.length, 5);
  assert.equal(policy.phaseOf(base, new Date('2026-10-10T01:00:00Z')), 'ONGOING');
  assert.equal(policy.phaseOf(base, new Date('2026-10-10T02:00:00Z')), 'ENDED');
  assert.equal(policy.registrationRule(base, new Date('2026-10-10T02:00:00Z')), '活动已结束，报名已关闭。');
});
test('new old classifications rejected, unchanged historic type retained without rewrite', () => {
  assert.throws(() => policy.validateInput({ ...base, eventType: 'Workshop' }), error => error.code === 'INVALID_TYPE');
  const old = { ...base, eventType: 'unknown-legacy' };
  assert.deepEqual(policy.validateInput({ title: '修订', eventType: 'unknown-legacy' }, old), { title: '修订' });
  assert.equal(policy.validateInput({ eventType: 'OTHER' }, old).eventType, 'OTHER');
});
test('capacity, time and URL validation have meaningful failures', () => {
  for (const update of [{ maxCapacity: 1.5 }, { maxCapacity: -1 }, { endDate: base.startDate }, { location: { type: 'virtual', virtualLink: 'javascript:alert(1)' } }, { rsvpLink: 'data:text/html,bad' }]) assert.throws(() => policy.validateInput(update, base));
});
test('DTO allowlist excludes ledger, user secrets, storage key and internal pointer', () => {
  const dto = eventDTO({ ...base, registrations: [{ name: 'Private student', reviewNote: 'Private note' }], registrationVersion: 22, activityV2MigrationBackup: { bad: true }, mediaRefs: [{ mediaId: 'private' }], mediaTombstones: ['private'], secretKey: 'bad', coverMediaId: 'private', imageUrl: 'https://old.example/cover.png' });
  assert.doesNotMatch(JSON.stringify(dto), /Private|secret|registrations|registrationVersion|coverMediaId|mediaRefs|mediaTombstones|MigrationBackup/);
  assert.equal(dto.imageUrl, 'https://old.example/cover.png');
  assert.equal(eventDTO({ ...base, legacyCoverHidden: true, imageUrl: 'https://old.example' }).imageUrl, null);
});
