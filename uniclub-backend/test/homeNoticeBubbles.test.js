const { test } = require('node:test');
const assert = require('node:assert/strict');
const now = Date.now();
const id = n => n.toString(16).padStart(24, '0');
const notice = (n, offset, fields = {}) => ({
  _id: id(n), title: `Notice ${n}`, body: 'Full announcement body', level: 'info',
  pinned: false, isPublished: true, publishedAt: new Date(now + offset), expiresAt: null, ...fields,
});
let rows = [];
function matches(row, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(part => matches(row, part));
    if (key === '$and') return value.every(part => matches(row, part));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      return Object.entries(value).every(([op, expected]) => {
        if (op === '$in') return expected.includes(row[key]);
        if (op === '$ne') return row[key] !== expected;
        if (op === '$lte') return row[key] <= expected;
        if (op === '$gt') return row[key] > expected;
        throw new Error(`Unknown operator ${op}`);
      });
    }
    return row[key] === value;
  });
}
const model = {
  findOne(filter) {
    const result = rows.filter(row => matches(row, filter));
    return {
      sort(fields) {
        result.sort((a, b) => {
          for (const [key, direction] of Object.entries(fields)) {
            if (a[key] > b[key]) return direction;
            if (a[key] < b[key]) return -direction;
          }
          return 0;
        });
        return this;
      },
      lean: async () => result[0] || null,
    };
  },
};
const filename = require.resolve('../models/Announcement');
require.cache[filename] = { id: filename, filename, loaded: true, exports: model };
const router = require('../routes/announcementRouter');
async function request(path = '/', params = {}) {
  const handler = router.stack.find(layer => layer.route?.path === path && layer.route.methods.get).route.stack.at(-1).handle;
  let body, status = 200;
  const response = { json(value) { body = value; return this; }, status(value) { status = value; return this; } };
  await handler({ query: { view: 'home-bubbles' }, params }, response);
  return { body, status };
}
test('homepage chooses the latest priority and ordinary notices independently, beyond the list limit', async () => {
  rows = [notice(1, -100000, { pinned: true }), notice(2, -90000, { level: 'urgent' }),
    ...Array.from({ length: 80 }, (_, n) => notice(n + 10, -80000 + n * 100))];
  const { body, status } = await request();
  assert.equal(status, 200);
  assert.deepEqual(body.map(row => row._id), [id(2), id(89)]);
  assert.equal(body[0].body, 'Full announcement body');
  assert.equal('isPublished' in body[0], false);
});
test('drafts, future notices and expired notices never enter either homepage bubble', async () => {
  rows = [notice(1, -30000), notice(2, -5000, { isPublished: false, pinned: true }),
    notice(3, 100000, { level: 'urgent' }), notice(4, -1000, { expiresAt: new Date(now - 1000) }),
    notice(5, -1000, { level: 'urgent', expiresAt: new Date(now - 1000) })];
  assert.deepEqual((await request()).body.map(row => row._id), [id(1)]);
});
test('one priority notice is shown once, and no notices yields an empty response', async () => {
  rows = [notice(1, -1000, { pinned: true, level: 'urgent' })];
  assert.deepEqual((await request()).body.map(row => row._id), [id(1)]);
  rows = [];
  assert.deepEqual((await request()).body, []);
});
test('a detail permalink resolves the exact notice, including an older pinned announcement', async () => {
  rows = [notice(1, -100000, { pinned: true }), notice(2, -1000)];
  const { body, status } = await request('/:id', { id: id(1) });
  assert.equal(status, 200);
  assert.equal(body._id, id(1));
  assert.equal(body.body, 'Full announcement body');
});
test('detail access rejects invalid, removed, draft, future and expired announcements', async () => {
  rows = [notice(1, -1000, { isPublished: false }), notice(2, 100000), notice(3, -1000, { expiresAt: new Date(now - 1000) })];
  for (const value of ['not-an-id', id(1), id(2), id(3), id(4)]) {
    assert.equal((await request('/:id', { id: value })).status, 404);
  }
});
