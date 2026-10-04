const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

// Real router/JWT middleware and search service; only Mongo is replaced by
// isolated records. No live content is created or modified by these tests.
process.env.JWT_SECRET = 'isolated-search-tests-only';
const member = '111111111111111111111111';
const other = '222222222222222222222222';
const friend = '333333333333333333333333';
const now = new Date('2026-10-04T14:00:00Z');
const title = '班级材料统一整理通知：周三22:00前完成个人信息核对与材料提交';
let records, reads;
const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
function matches(record, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some(part => matches(record, part));
    const actual = get(record, key);
    if (value === null) return actual == null;
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      return Object.entries(value).every(([operator, target]) => {
        if (operator === '$in') return target.some(item => String(item) === String(actual));
        if (operator === '$lte') return actual != null && new Date(actual) <= target;
        if (operator === '$gt') return actual != null && new Date(actual) > target;
        throw new Error(`Unsupported fixture operator ${operator}`);
      });
    }
    return String(actual) === String(value);
  });
}
function project(record, fields) {
  if (!fields) return structuredClone(record);
  const output = { _id: record._id };
  for (const field of fields.split(' ')) {
    const value = get(record, field);
    if (value === undefined) continue;
    const keys = field.split('.');
    const last = keys.pop();
    const parent = keys.reduce((object, key) => object[key] ||= {}, output);
    parent[last] = structuredClone(value);
  }
  return output;
}
function query(values) {
  let selection;
  const result = () => values.map(record => project(record, selection));
  return {
    select(fields) { selection = fields; return this; },
    lean() { return Promise.resolve(result()); },
    then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
  };
}
const models = {};
for (const name of ['Announcement', 'News', 'Event', 'PastEvent', 'Resource', 'SocialPost', 'Follow']) {
  models[name] = { find(filter) {
    reads.push({ name, filter });
    return query(records[name].filter(record => matches(record, filter)));
  } };
}
models.User = { findById(id) {
  reads.push({ name: 'User' });
  const record = records.User.find(item => item._id === id);
  let fields;
  return { select(value) { fields = value; return this; },
    lean() { return Promise.resolve(record ? project(record, fields) : null); },
    then(resolve, reject) { return Promise.resolve(record ? project(record, fields) : null).then(resolve, reject); } };
} };
for (const [name, exports] of Object.entries(models)) {
  const id = require.resolve(`../models/${name}`);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
const { createSearchService, rankDocuments, adapters, normalizeSearchText } = require('../services/GlobalSearchService');
const search = createSearchService(models);
const context = { userId: member, now };
const row = (id, extra = {}) => ({ _id: id, createdAt: new Date('2026-10-01T00:00:00Z'), ...extra });
beforeEach(() => {
  reads = [];
  records = Object.fromEntries(Object.keys(models).map(name => [name, []]));
  records.User = [row(member, { isEnrolled: true, tokenVersion: 0 }), row(other, { isEnrolled: false, tokenVersion: 0 })];
  records.Announcement = [row('a', { title, body: '周五下午进行软件工程实验。', isPublished: true, publishedAt: new Date('2026-10-01'), expiresAt: null })];
});

test('announcement titles: Chinese substring, non-contiguous phrase, tokens, punctuation and whitespace', async () => {
  for (const q of ['材料', '材料整理', '统一整理', '周三', '22:00', '个人信息', '信息核对', '材料提交', '周三22：00', '周三 22:00', '  材料  ', '材料   周三', '个人 信息']) {
    assert.equal((await search(q, context)).results[0]?.id, 'a', q);
  }
});

test('body is searchable, and normalization handles full-width Latin/numbers', async () => {
  assert.equal((await search('软件工程实验', context)).results[0]?.id, 'a');
  records.News.push(row('n', { title: 'ＣｌａｓｓＨｕｂ ２０２６', excerpt: '新内容', content: '<p>学习 &amp; 交流</p>', status: 'approved', publishedAt: now }));
  for (const q of ['ClassHub', 'classhub', 'CLASSHUB', '２０２６', '2026', '学习 交流']) {
    assert.equal((await search(q, context)).results[0]?.id, 'n', q);
  }
  assert.equal(normalizeSearchText('　ClassHub：  ２０２６ '), 'classhub 2026');
});

test('all actual sources/fields map to real routes and canonical types', async () => {
  records.Event = [row('e', { title: '秋季班级团建活动', description: '报名参加', location: { room: '第三教室' }, status: 'published' })];
  records.Resource = [row('r', { title: '课程模板', file: { originalName: '软件工程实验报告模板.pdf', url: 'secret-storage-url' }, description: '资源说明', status: 'approved' })];
  records.SocialPost = [row('s', { content: '课程学习动态', author: other, status: 'active', visibility: 'club-members' })];
  records.PastEvent = [row('p', { title: '往期交流', subtitle: '回顾往事', body: '夏日分享', date: now })];
  const expectations = [['团建', 'event', '/event/e'], ['班级活动', 'event', '/event/e'], ['第三教室', 'event', '/event/e'],
    ['报告模板', 'resource', '/resource/r'], ['资源说明', 'resource', '/resource/r'],
    ['学习动态', 'social', '/social'], ['夏日分享', 'pastEvent', '/past-events/p'], ['材料', 'announcement', '/announcements']];
  for (const [q, type, url] of expectations) {
    const result = (await search(q, context)).results[0];
    assert.equal(result?.type, type, q); assert.equal(result.url, url);
  }
  assert.equal((await search('secret-storage-url', context)).count, 0);
});

test('exact > prefix > title substring > all tokens > partial > metadata > summary > content; newest breaks ties', () => {
  const docs = [
    adapters.news(row('body', { title: '其他新闻', content: '材料整理', publishedAt: now })),
    adapters.resource(row('meta', { title: '课程模板', file: { originalName: '材料整理.pdf' } })),
    adapters.news(row('summary', { title: '课程新闻', excerpt: '材料整理' })),
    adapters.announcement(row('partial', { title: '班级材料统一整理通知' })),
    adapters.announcement(row('contains', { title: '班级材料整理通知' })),
    adapters.news(row('prefix', { title: '材料整理通知' })),
    adapters.announcement(row('exact-old', { title: '材料整理' })),
    adapters.news(row('exact-new', { title: '材料整理', createdAt: now })),
  ];
  assert.deepEqual(rankDocuments(docs, '材料整理').results.map(result => result.id),
    ['exact-new', 'exact-old', 'prefix', 'contains', 'partial', 'meta', 'summary', 'body']);
  const all = adapters.announcement(row('all', { title: '材料将在周三整理' }));
  const partial = adapters.news(row('one', { title: '材料说明' }));
  assert.equal(rankDocuments([partial, all], '材料 周三').results[0].id, 'all');
});

test('dedupe uses type+id and applies the limit after global ranking', () => {
  const docs = Array.from({ length: 25 }, (_, i) => adapters.news(row(String(i), { title: 'ClassHub 新闻' })));
  const a = adapters.announcement(row('a', { title: 'ClassHub' }));
  const sameIdOtherType = adapters.resource(row('a', { title: 'ClassHub' }));
  const result = rankDocuments([...docs, a, a, sameIdOtherType], 'ClassHub', 999);
  assert.equal(result.count, 12); assert.equal(result.total, 27);
  assert.equal(result.results[0].title, 'ClassHub');
  assert.equal(result.results.filter(item => item.id === 'a').length, 2);
  assert.ok(!JSON.stringify(result).includes('"search"'));
});

test('empty/no-result/regex-like input is safe; empty performs no source reads', async () => {
  for (const q of ['', '   ', '：']) assert.equal((await search(q, context)).count, 0);
  assert.equal(reads.length, 0);
  assert.equal((await search('zzzzzzzz', context)).count, 0);
  assert.equal((await search('[.*$', context)).count, 0);
});

test('unpublished/future/expired notices and draft/unapproved content are excluded', async () => {
  records.Announcement.push(row('hidden', { title: '材料', isPublished: false, publishedAt: now }),
    row('future', { title: '材料', isPublished: true, publishedAt: new Date('2027-01-01') }),
    row('expired', { title: '材料', isPublished: true, publishedAt: new Date('2026-01-01'), expiresAt: new Date('2026-10-03') }));
  records.News = [row('draft', { title: '材料', status: 'draft', publishedAt: now }), row('scheduled', { title: '材料', status: 'approved', publishedAt: new Date('2027-01-01') })];
  records.Event = [row('draft-event', { title: '材料', status: 'draft' })];
  records.Resource = [row('pending', { title: '材料', status: 'pending' })];
  assert.deepEqual((await search('材料', context)).results.map(item => item.id), ['a']);
});

test('social visibility respects enrollment, authorship and accepted follows, never deleted/flagged posts', async () => {
  records.Announcement = [];
  records.Follow = [row('follow', { followerId: member, followingId: friend, status: 'accepted' })];
  records.SocialPost = [
    row('public', { content: '动态', author: friend, status: 'active', visibility: 'public' }),
    row('club', { content: '动态', author: friend, status: 'active', visibility: 'club-members' }),
    row('friend', { content: '动态', author: friend, status: 'active', visibility: 'friends' }),
    row('stranger', { content: '动态', author: other, status: 'active', visibility: 'friends' }),
    row('private', { content: '动态', author: friend, status: 'active', visibility: 'private' }),
    row('own', { content: '动态', author: member, status: 'active', visibility: 'private' }),
    ...['deleted', 'flagged', 'pending', 'archived'].map(status => row(status, { content: '动态', author: member, visibility: 'public', status })),
  ];
  assert.deepEqual(new Set((await search('动态', context)).results.map(item => item.id)), new Set(['public', 'club', 'friend', 'own']));
  assert.deepEqual((await search('动态', { userId: other, now })).results.map(item => item.id).sort(), ['public', 'stranger']);
  await assert.rejects(search('动态', {}), /Authentication required/);
});

const app = express();
app.use('/api/search', require('../routes/searchRouter'));
let server, origin;
before(async () => {
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); });
const token = extra => jwt.sign({ userId: member, tokenVersion: 0, ...extra }, process.env.JWT_SECRET);
const request = (suffix, auth) => fetch(`${origin}/api/search${suffix}`, { headers: auth ? { Authorization: `Bearer ${auth}` } : {} });

test('actual route rejects guests/invalid/revoked tokens before querying content', async () => {
  for (const auth of [undefined, 'invalid', token({ tokenVersion: 1 })]) {
    const response = await request('?q=材料', auth);
    assert.equal(response.status, 401);
    assert.ok(!await response.text().then(text => text.includes(title)));
  }
  assert.ok(reads.every(read => read.name === 'User'));
});

test('authenticated route returns typed, minimal results; query validation and empty query', async () => {
  const response = await request('?q=材料', token());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const body = await response.json();
  assert.equal(body.results[0].title, title);
  assert.deepEqual(Object.keys(body.results[0]).sort(), ['date', 'description', 'id', 'title', 'type', 'url']);
  assert.equal((await request(`?q=${'a'.repeat(201)}`, token())).status, 400);
  assert.equal((await request('?q=x&q=y', token())).status, 400);
  reads = [];
  assert.equal((await (await request('', token())).json()).count, 0);
  assert.ok(reads.every(read => read.name === 'User'));
});
