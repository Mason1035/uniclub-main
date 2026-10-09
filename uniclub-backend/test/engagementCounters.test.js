const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
process.env.JWT_SECRET = 'engagement-counters-test-only';
const contentId = '111111111111111111111111';
let filters, failComments, server, origin;
const totals = { totalLikes: 4, totalSaves: 2, totalShares: 1, totalViews: 0 };
const rows = [
  { contentId, contentType: 'news', status: 'active', parentCommentId: null },
  { contentId, contentType: 'news', status: 'active' },
  { contentId, contentType: 'news', status: 'active', parentCommentId: 'reply' },
  { contentId, contentType: 'news', status: 'deleted', parentCommentId: null },
  { contentId, contentType: 'resource', status: 'active', parentCommentId: null },
  { contentId: '222222222222222222222222', contentType: 'news', status: 'active', parentCommentId: null },
];
function stub(name, exports) {
  const id = require.resolve(name);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub('../services/EngagementService', { getContentEngagementStats: async () => totals });
stub('../models/Comment', {
  countDocuments(filter) {
    filters.push(filter);
    return failComments ? Promise.reject(new Error('comment store offline')) : Promise.resolve(rows.filter(row =>
      Object.entries(filter).every(([key, value]) => value === null ? row[key] == null : row[key] === value)).length);
  },
});
const app = express();
app.use('/api/engagement', require('../routes/engagementRouter'));
before(async () => {
  server = await new Promise(resolve => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
  origin = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { await new Promise(resolve => server.close(resolve)); });
beforeEach(() => { filters = []; failComments = false; });
async function get(type, id = contentId) {
  const response = await fetch(`${origin}/api/engagement/stats/${type}/${id}`);
  return { status: response.status, data: await response.json() };
}
test('stats reuse the active top-level comment filter without exposing comments or authors', async () => {
  const result = await get('News');
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, { success: true, stats: { ...totals, totalComments: 2 } });
  assert.deepEqual(filters, [{ contentId, contentType: 'news', status: 'active', parentCommentId: null }]);
});
for (const [type, expected] of [['Event', 'event'], ['Resource', 'resource'], ['SocialPost', 'social']]) {
  test(`${type} uses the existing comment type and retains zero counts`, async () => {
    const result = await get(type);
    assert.equal(result.status, 200);
    assert.equal(filters[0].contentType, expected);
    assert.equal(result.data.stats.totalComments, type === 'Resource' ? 1 : 0);
  });
}
test('comment counting failure preserves engagement stats and allows the legacy fallback', async () => {
  failComments = true;
  assert.deepEqual((await get('News')).data.stats, totals);
});
test('Comment stats do not query content comments', async () => {
  assert.deepEqual((await get('Comment')).data.stats, totals);
  assert.equal(filters.length, 0);
});
test('invalid IDs are rejected before any count query', async () => {
  assert.equal((await get('News', 'invalid')).status, 400);
  assert.equal(filters.length, 0);
});
test('the authenticated user engagement endpoint still rejects anonymous requests', async () => {
  const response = await fetch(`${origin}/api/engagement/user/News/${contentId}`);
  assert.equal(response.status, 401);
});
