const { test } = require('node:test');
const assert = require('node:assert/strict');

// Exercise the real list handlers with memory data, without database writes or
// an HTTP server. Older priority items must not replace the latest homepage item.
process.env.JWT_SECRET = 'home-preview-test-only';
const older = '2026-10-01T12:00:00Z';
const newer = '2026-10-02T12:00:00Z';
const rows = [
  { _id: 'old', title: 'Older priority item', publishedAt: older, createdAt: older,
    startDate: '2099-10-01T12:00:00Z', categories: ['General'], status: 'approved',
    pinned: true, isTrending: true, isFeatured: true, isPublished: true, expiresAt: null, downloadCount: 100 },
  { _id: 'new', title: 'Latest item', publishedAt: newer, createdAt: newer,
    startDate: '2099-10-02T12:00:00Z', categories: ['General'], status: 'approved',
    pinned: false, isTrending: false, isFeatured: false, isPublished: true, expiresAt: null, downloadCount: 0 },
];

function stub(name, exports) {
  const id = require.resolve(name);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(part => matches(row, part));
    if (key === '$and') return value.every(part => matches(row, part));
    if (value === null) return row[key] == null;
    if (value?.$in) return value.$in.includes(row[key]);
    if (value && typeof value === 'object') {
      return Object.entries(value).every(([operator, boundary]) => {
        const actual = new Date(row[key]).getTime(), expected = new Date(boundary).getTime();
        return operator === '$gte' ? actual >= expected : operator === '$lte' ? actual <= expected : actual > expected;
      });
    }
    return row[key] === value;
  });
}
function query(items) {
  let result = [...items];
  return {
    select() { return this; }, populate() { return this; }, lean() { return this; },
    sort(fields) {
      result.sort((a, b) => {
        for (const [field, direction] of Object.entries(fields)) {
          if (a[field] !== b[field]) return (a[field] > b[field] ? 1 : -1) * direction;
        }
        return 0;
      });
      return this;
    },
    skip(count) { result = result.slice(count); return this; },
    limit(count) { result = result.slice(0, count); return this; },
    then(resolve, reject) { return Promise.resolve(result.map(row => ({ ...row, toObject: () => ({ ...row }) }))).then(resolve, reject); },
  };
}
function model(items) {
  return {
    find: filter => query(items.filter(row => matches(row, filter))),
    countDocuments: async filter => items.filter(row => matches(row, filter)).length,
    aggregate: async () => [{ years: [2099], types: [] }],
  };
}
stub('../models/Announcement', model(rows));
stub('../models/News', model(rows));
stub('../models/Event', model([
  ...rows.map(row => ({ ...row, status: 'published' })),
  { ...rows[1], _id: 'past', createdAt: '2026-10-03T12:00:00Z', startDate: older, status: 'published' },
  { ...rows[1], _id: 'draft', createdAt: '2026-10-04T12:00:00Z', status: 'draft' },
]));
stub('../models/Resource', model(rows));
stub('../models/Comment', { aggregate: async () => [] });
stub('../services/NewsCurationService', {});
stub('../services/EventService', {});
stub('../services/EngagementService', {});

async function get(routerName, params) {
  let router = require('../routes/' + routerName);
  if (routerName === 'eventRouter') {
    const { ActivityService } = require('../services/ActivityService');
    const userQuery = { select() { return this; }, lean: async () => ({ _id: '111111111111111111111111', name: 'Test member', isEnrolled: true, uniqueId: 'TEST-member' }) };
    const service = new ActivityService({ EventModel: require('../models/Event'), UserModel: { findById: () => userQuery }, RosterModel: { exists: async () => true } });
    router = router.createEventRouter({ service, mediaService: null, mediaRouter: require('express').Router() });
  }
  const route = router.stack.find(layer => layer.route?.path === '/' && layer.route.methods.get).route;
  let body, status = 200;
  const response = { json(value) { body = value; }, status(value) { status = value; return this; } };
  await route.stack.at(-1).handle({ query: params, user: { userId: '111111111111111111111111' } }, response);
  assert.equal(status, 200);
  return Array.isArray(body) ? body : body.events || body.resources;
}

for (const router of ['announcementRouter', 'newsRouter', 'eventRouter']) {
  test(`${router}: homepage selects one latest item instead of an older priority item`, async () => {
    const data = await get(router, { sort: 'latest', limit: '1' });
    assert.deepEqual(data.map(row => row._id), ['new']);
  });
  test(`${router}: regular listing retains its existing default order`, async () => {
    const data = await get(router, { limit: '1' });
    assert.deepEqual(data.map(row => row._id), ['old']);
  });
}
test('resources: homepage newest sort differs from default download ranking', async () => {
  assert.deepEqual((await get('resourceRouter', { sortBy: 'newest', limit: '1' })).map(row => row._id), ['new']);
  assert.deepEqual((await get('resourceRouter', { limit: '1' })).map(row => row._id), ['old']);
});
