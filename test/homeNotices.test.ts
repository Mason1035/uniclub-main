import test from 'node:test';
import assert from 'node:assert/strict';
import { selectHomeNotices, homeNoticeTarget } from '../src/lib/homeNotices';
import type { Announcement } from '../src/lib/announcementMeta';
const now = Date.parse('2026-10-27T12:00:00Z');
const notice = (id: string, offset: number, fields: Partial<Announcement> = {}): Announcement => ({
  _id: id, title: `Notice ${id}`, body: 'Announcement body', level: 'info', pinned: false,
  publishedAt: new Date(now + offset).toISOString(), expiresAt: null, ...fields,
});
test('latest pinned/important/urgent and latest ordinary notice are distinct and correctly labelled', () => {
  const selected = selectHomeNotices([notice('a', -10000, { pinned: true }), notice('b', -2000),
    notice('c', -5000, { level: 'urgent' }), notice('d', -8000)], now);
  assert.deepEqual(selected.map(item => [item.announcement._id, item.label]), [['c', '紧急通知'], ['b', '最近通知']]);
  assert.equal(selectHomeNotices([notice('e', -1000, { level: 'important' })], now)[0].label, '重要通知');
});
test('missing categories, duplicate rows, expired and scheduled notices do not create fabricated or repeated bubbles', () => {
  const row = notice('a', -1000);
  assert.deepEqual(selectHomeNotices([row, row], now).map(item => item.announcement._id), ['a']);
  assert.deepEqual(selectHomeNotices([notice('a', 10000), notice('b', -1000, { expiresAt: new Date(now).toISOString() })], now), []);
  assert.deepEqual(selectHomeNotices([], now), []);
  assert.equal(selectHomeNotices([notice('x', -1000, { pinned: true })], now).length, 1);
});
test('a bubble links to its exact announcement rather than a generic listing or external source', () => {
  assert.equal(homeNoticeTarget('abc'), '/announcements?notice=abc');
  assert.equal(homeNoticeTarget('a&b'), '/announcements?notice=a%26b');
});
