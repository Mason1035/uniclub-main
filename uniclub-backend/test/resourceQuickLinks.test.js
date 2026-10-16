const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const ResourceQuickLink = require('../models/ResourceQuickLink');
const ResourceQuickLinkService = require('../services/ResourceQuickLinkService');
const { DEFAULT_RESOURCE_QUICK_LINKS, normalizeResourceQuickLinkUrl, parseResourceQuickLink } = require('../utils/resourceQuickLinks');

process.env.JWT_SECRET = 'resource-quick-link-tests-only';
const admin = '111111111111111111111111';
const member = '222222222222222222222222';
const missing = '333333333333333333333333';
const accounts = new Map([
  [admin, { _id: admin, isAdmin: true, tokenVersion: 0 }],
  [member, { _id: member, isAdmin: false, tokenVersion: 0 }],
]);
const userPath = require.resolve('../models/User');
require.cache[userPath] = { id: userPath, filename: userPath, loaded: true, exports: {
  findById(id) { return { select: async () => accounts.get(String(id)) || null }; },
} };
const { createResourceQuickLinksRouters } = require('../routes/resourceQuickLinksRouter');

class MemoryRepository {
  constructor() { this.rows = new Map(); this.sequence = 10; this.writes = 0; this.deletes = 0; }
  async list() { return [...this.rows.values()]; }
  async findByUrl(url) { return [...this.rows.values()].find(row => row.url === url) || null; }
  async create(fields) {
    if (await this.findByUrl(fields.url)) throw Object.assign(new Error('duplicate'), { code: 11000 });
    const row = { _id: (++this.sequence).toString(16).padStart(24, '0'), ...fields, createdAt: new Date() };
    this.rows.set(row._id, row); this.writes++;
    return row;
  }
  async delete(id) {
    this.deletes++;
    const row = this.rows.get(id) || null;
    this.rows.delete(id);
    return row;
  }
}

let repository, service, server, origin;
const app = express();
app.use(express.json());
const delegated = new Proxy({}, { get: (_, key) => (...args) => service[key](...args) });
const routers = createResourceQuickLinksRouters(delegated);
app.use('/api/resource-quick-links', routers.userRouter);
app.use('/api/admin/resource-quick-links', routers.adminRouter);
before(async () => {
  server = await new Promise((resolve, reject) => {
    const started = app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve(started));
    started.once('error', reject);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); });
beforeEach(() => { repository = new MemoryRepository(); service = new ResourceQuickLinkService(repository); });

async function request(method, path, user = member, body, claims = {}) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user, tokenVersion: 0, ...claims }, process.env.JWT_SECRET)}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, headers: response.headers, body: response.status === 204 ? null :
    response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text() };
}
const memberPath = '/api/resource-quick-links';
const adminPath = '/api/admin/resource-quick-links';
const custom = { name: '课程工具', url: 'https://example.com/tools', description: '常用课程入口' };

test('read requires a live JWT; missing, revoked and nonexistent accounts are rejected', async () => {
  assert.equal((await request('GET', memberPath, null)).status, 401);
  assert.equal((await request('GET', memberPath, member, undefined, { tokenVersion: 4 })).status, 401);
  assert.equal((await request('GET', memberPath, missing)).status, 401);
  assert.equal((await request('GET', memberPath)).status, 200);
});

test('server-owned defaults have the exact order and links, with no seeding or private metadata', async () => {
  const response = await request('GET', memberPath);
  assert.deepEqual(response.body.links, DEFAULT_RESOURCE_QUICK_LINKS);
  assert.deepEqual(response.body.links.map(link => link.url), [
    'https://authserver.sicnu.edu.cn/', 'https://github.com/', 'https://www.educoder.net/', 'https://passport2.chaoxing.com/',
  ]);
  assert.equal(repository.writes, 0);
  assert.equal(repository.deletes, 0);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.match(response.headers.get('vary'), /Authorization/);
});

test('existing database admin privilege is required even with forged JWT claims', async () => {
  assert.equal((await request('POST', adminPath, null, custom)).status, 401);
  assert.equal((await request('DELETE', `${adminPath}/default-sicnu`, null)).status, 401);
  for (const [method, path, body] of [
    ['POST', adminPath, custom], ['DELETE', `${adminPath}/default-sicnu`],
  ]) assert.equal((await request(method, path, member, body, { isAdmin: true, role: 'admin' })).status, 403);
  assert.equal(repository.writes, 0);
  assert.equal(repository.deletes, 0);
});

test('admin creates normalized links; members see defaults first and only safe metadata', async () => {
  const response = await request('POST', adminPath, admin, { name: '  课程工具  ', url: '  HTTPS://EXAMPLE.COM:443/tools  ', description: ' 常用课程入口 ' });
  assert.equal(response.status, 201);
  assert.deepEqual(response.body.link, { id: '00000000000000000000000b', ...custom, isDefault: false });
  assert.equal(repository.rows.get(response.body.link.id).createdBy, admin);
  await request('POST', adminPath, admin, { name: '文档', url: 'http://example.org' });
  const rows = (await request('GET', memberPath)).body.links;
  assert.deepEqual(rows.slice(0, 4), DEFAULT_RESOURCE_QUICK_LINKS);
  assert.equal(rows[4].name, custom.name);
  assert.equal(rows[5].url, 'http://example.org/');
  assert.equal(rows[5].description, '');
  assert.equal(rows[5].isDefault, false);
  assert.doesNotMatch(JSON.stringify(rows), /createdBy|createdAt|_id/);
});

test('all default IDs are protected from direct forged deletion requests', async () => {
  for (const link of DEFAULT_RESOURCE_QUICK_LINKS) {
    const response = await request('DELETE', `${adminPath}/${link.id}`, admin);
    assert.equal(response.status, 403);
    assert.match(response.body.error, /默认链接不能删除/);
  }
  assert.equal(repository.deletes, 0);
  assert.deepEqual((await service.list()).slice(0, 4), DEFAULT_RESOURCE_QUICK_LINKS);
});

test('admin deletes custom links, with 204, invalid ID 400 and missing ID 404', async () => {
  const { id } = (await request('POST', adminPath, admin, custom)).body.link;
  assert.equal((await request('DELETE', `${adminPath}/${id}`, admin)).status, 204);
  assert.equal((await request('DELETE', `${adminPath}/${id}`, admin)).status, 404);
  assert.equal((await request('DELETE', `${adminPath}/not-an-id`, admin)).status, 400);
  assert.equal((await request('DELETE', `${adminPath}/abcdefabcdefabcdefabcdef`, admin)).status, 404);
  assert.equal((await service.list()).length, 4);
});

test('unsafe, relative, malformed, credentialed and control-character URLs cannot be stored', async () => {
  for (const url of [
    'javascript:alert(1)', 'data:text/html,x', '//example.com', '/relative', 'ftp://example.com',
    'https:example.com', 'https://', 'https://u:p@example.com', 'https://u@example.com',
    'https://example.com/\nunsafe', 'https://example.com/\tunsafe', 'https://example.com/\\unsafe', '', 'https://example.com/' + 'x'.repeat(2048),
  ]) {
    const response = await request('POST', adminPath, admin, { ...custom, url });
    assert.equal(response.status, 400, url);
  }
  assert.equal(repository.writes, 0);
});

test('field bounds and allowlist reject protected fields, arrays and invalid input', async () => {
  for (const body of [
    [], {}, { ...custom, name: '' }, { ...custom, name: 'x'.repeat(61) }, { ...custom, name: ['name'] },
    { ...custom, description: 'x'.repeat(161) }, { ...custom, description: null },
    { ...custom, isDefault: true }, { ...custom, id: 'default-sicnu' }, { ...custom, createdBy: member },
  ]) assert.equal((await request('POST', adminPath, admin, body)).status, 400);
  assert.equal(repository.writes, 0);
  assert.throws(() => parseResourceQuickLink(null), error => error.status === 400);
});

test('canonical duplicates of defaults and custom links return 409', async () => {
  for (const url of ['https://github.com', 'HTTPS://GITHUB.COM:443/', ' https://www.educoder.net/ ']) {
    assert.equal((await request('POST', adminPath, admin, { ...custom, url })).status, 409);
  }
  assert.equal((await request('POST', adminPath, admin, custom)).status, 201);
  assert.equal((await request('POST', adminPath, admin, { ...custom, name: '重复', url: 'https://EXAMPLE.COM:443/tools' })).status, 409);
  assert.equal(repository.writes, 1);
});

test('duplicate-key races also return conflict without leaking database errors', async () => {
  repository.create = async () => { throw Object.assign(new Error('private DB details'), { code: 11000 }); };
  const response = await request('POST', adminPath, admin, custom);
  assert.equal(response.status, 409);
  assert.equal(response.body.error, '这个链接已经存在。');
});

test('database failures return a bounded message without request or database details', async () => {
  repository.list = async () => { throw new Error('private DB details'); };
  const response = await request('GET', memberPath);
  assert.equal(response.status, 500);
  assert.equal(response.body.error, '快捷访问暂时无法响应，请稍后重试。');
});

test('model enforces canonical unique URL, length limits and server actor without a live database', async () => {
  assert.equal(ResourceQuickLink.schema.indexes().find(([, opts]) => opts.name === 'resource_quick_link_url_unique')[1].unique, true);
  assert.equal(ResourceQuickLink.schema.path('createdBy').options.ref, 'User');
  const row = new ResourceQuickLink({ ...custom, url: 'HTTPS://EXAMPLE.COM:443/tools', createdBy: admin });
  await row.validate();
  assert.equal(row.url, custom.url);
  assert.equal(normalizeResourceQuickLinkUrl('https://github.com'), 'https://github.com/');
  for (const fields of [
    { name: 'x'.repeat(61) }, { url: 'javascript:alert(1)' }, { description: 'x'.repeat(161) }, { createdBy: undefined },
  ]) await assert.rejects(new ResourceQuickLink({ ...custom, createdBy: admin, ...fields }).validate());
});
