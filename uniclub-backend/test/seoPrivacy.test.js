const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

// Exercise existing JWT/privacy middleware with memory-only database records.
// No production data, AI provider or uploaded file is read or modified.
process.env.JWT_SECRET = 'seo-privacy-tests-only';
const authorId = '111111111111111111111111';
const memberId = '222222222222222222222222';
const postId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
let visibility, population, follows;
const author = {
  _id: authorId, name: '班级成员', uniqueId: '2026000001',
  profile: { avatar: { data: 'data:image/webp;base64,AA==' }, bio: 'private bio' },
  email: 'private@example.com', passwordHash: 'private-password-hash',
  tokenVersion: 7, settings: { private: true },
};
function stub(name, exports) {
  const id = require.resolve(name);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub('../models/User', { findById() {
  return { select() { return this; },
    then(resolve, reject) { return Promise.resolve({ tokenVersion: 0, isEnrolled: true }).then(resolve, reject); } };
} });
stub('../models/Follow', { findOne: async () => follows ? { status: 'accepted' } : null });
stub('../models/SocialPost', { findById() { return { populate(_path, fields) {
  population = fields;
  const publicAuthor = { _id: author._id };
  for (const field of fields.split(' ')) {
    if (field === 'profile.avatar') publicAuthor.profile = { avatar: author.profile.avatar };
    else publicAuthor[field] = author[field];
  }
  return Promise.resolve({ _id: postId, author: publicAuthor, visibility, content: '班级动态' });
} }; } });
const headers = require('../middleware/privateResponseHeaders');
const auth = require('../middleware/auth');
const { checkPostPrivacy } = require('../middleware/privacy');
const app = express();
app.use('/api', headers);
app.use('/uploads', headers);
app.use(express.json());
app.get('/api/protected', auth, (_req, res) => res.json({ success: true }));
app.get('/api/social/posts/:id', auth, checkPostPrivacy, (req, res) => res.json({ post: req.post }));
app.post('/api/body', (_req, res) => res.json({ success: true }));
app.get('/uploads/missing', (_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: 'Invalid request' }));
let server, origin;
before(async () => {
  server = await new Promise((resolve, reject) => {
    const started = app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve(started));
    started.on('error', reject);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); });
beforeEach(() => { visibility = 'club-members'; population = undefined; follows = false; });
const request = (path, id, options = {}) => fetch(origin + path, {
  ...options, headers: { ...(id ? { Authorization: `Bearer ${jwt.sign({ userId: id, tokenVersion: 0 }, process.env.JWT_SECRET)}` } : {}), ...options.headers },
});
function assertPrivacy(response) {
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, nosnippet');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match(response.headers.get('vary'), /Authorization/);
}

for (const [id, status] of [[undefined, 401], [memberId, 200]]) test(`API privacy headers precede auth (${status})`, async () => {
  const response = await request('/api/protected', id);
  assert.equal(response.status, status);
  assertPrivacy(response);
});
test('parser failures and missing uploaded files also carry noindex headers', async () => {
  const broken = await request('/api/body', undefined, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid' });
  assert.equal(broken.status, 400); assertPrivacy(broken);
  const missing = await request('/uploads/missing');
  assert.equal(missing.status, 404); assertPrivacy(missing);
});
test('social detail retains visible author fields without returning author credentials or settings', async () => {
  const response = await request('/api/social/posts/' + postId, memberId);
  assert.equal(response.status, 200); assertPrivacy(response);
  const body = await response.json();
  assert.equal(population, 'name uniqueId profile.avatar');
  assert.equal(body.post.author.name, author.name);
  assert.equal(body.post.author.uniqueId, author.uniqueId);
  assert.deepEqual(body.post.author.profile, { avatar: author.profile.avatar });
  for (const field of ['email', 'passwordHash', 'tokenVersion', 'settings']) assert.equal(body.post.author[field], undefined);
});
test('existing private/friends/own post access rules still work after projection', async () => {
  visibility = 'private';
  assert.equal((await request('/api/social/posts/' + postId, memberId)).status, 403);
  assert.equal((await request('/api/social/posts/' + postId, authorId)).status, 200);
  visibility = 'friends';
  assert.equal((await request('/api/social/posts/' + postId, memberId)).status, 403);
  follows = true;
  assert.equal((await request('/api/social/posts/' + postId, memberId)).status, 200);
});
