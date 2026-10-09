const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'isolated-daily-news-test-only';
const DailyNewsRepository = require('../services/DailyNewsRepository');
const SettingsSchema = require('../models/AiSettings').schema;
const NewsSchema = require('../models/News').schema;
const JobSchema = require('../models/DailyNewsJob').schema;
const UserModel = require('../models/User');
const { batchDate, dueDate, nextRun, settingsFrom, validateSettings } = require('../utils/dailyNewsSchedule');
const { publicNewsFilter, articleVisible } = require('../utils/dailyNewsVisibility');
const { migrateDailyAiNews } = require('../migrations/20261006_daily_ai_news');
const { createCronRouter } = require('../routes/cronRouter');
const { createDailyNewsRouter } = require('../routes/admin/dailyNews');

// Real standalone MongoDB on a separate temporary data directory and port. No
// provider requests or business database access; only this test's owned data is
// deleted. Atomic leases, unique indexes and visibility are genuinely exercised.
let directory, mongod, connection, Settings, News, Jobs, Users, repository, now;
const memberId = new mongoose.Types.ObjectId('111111111111111111111111');
const adminId = new mongoose.Types.ObjectId('222222222222222222222222');
const today = '2026-10-06', yesterday = '2026-10-05';
const payload = label => [0, 1].map(index => ({
  title: `${label}真实新闻${index}`, summary: '真实新闻摘要。', content: '真实新闻内容，测试数据库发布契约。',
  category: index ? 'science' : 'ai', sourceReferences: [{ title: '实际来源', publisher: '官方机构', url: `https://example.com/${index}`, publishedAt: '2026-10-06T09:00:00Z' }],
}));
const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
});
before(async () => {
  const binary = ['/opt/homebrew/opt/mongodb-community/bin/mongod', '/usr/local/opt/mongodb-community/bin/mongod'].find(file => fs.existsSync(file));
  assert.ok(binary, 'Standalone MongoDB binary is required for these repository integration tests.');
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'classhub-daily-news-tests-'));
  const port = await freePort();
  mongod = spawn(binary, ['--dbpath', directory, '--bind_ip', '127.0.0.1', '--port', String(port), '--noauth', '--quiet', '--logpath', path.join(directory, 'mongo.log'), '--wiredTigerCacheSizeGB', '0.25'], { stdio: 'ignore' });
  let failure;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { connection = await mongoose.createConnection(`mongodb://127.0.0.1:${port}/daily_news_tests`, { autoIndex: false, serverSelectionTimeoutMS: 300 }).asPromise(); failure = null; break; }
    catch (error) { failure = error; await new Promise(resolve => setTimeout(resolve, 150)); }
  }
  if (failure) throw failure;
  const hello = await connection.db.admin().command({ hello: 1 });
  assert.equal(hello.setName, undefined, 'Test must verify the standalone implementation, not replica-set transactions.');
  Settings = connection.model('AiSettings', SettingsSchema.clone());
  News = connection.model('News', NewsSchema.clone());
  Jobs = connection.model('DailyNewsJob', JobSchema.clone());
  Users = connection.model('User', UserModel.schema.clone());
  await News.createIndexes();
});
after(async () => {
  await connection?.close();
  if (mongod && mongod.exitCode == null) await new Promise(resolve => { mongod.once('exit', resolve); mongod.kill('SIGTERM'); });
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
});
beforeEach(async () => {
  await Promise.all([Settings.deleteMany({}), News.deleteMany({}), Jobs.deleteMany({}), Users.deleteMany({})]);
  now = new Date('2026-10-06T11:10:00Z');
  await Users.create([
    { _id: adminId, uniqueId: 'isolated-admin', name: '测试管理员', passwordHash: 'not-a-real-password', isAdmin: true },
    { _id: memberId, uniqueId: 'isolated-member', name: '测试成员', passwordHash: 'not-a-real-password', isAdmin: false },
  ]);
  repository = new DailyNewsRepository({ settingsModel: Settings, jobModel: Jobs, newsModel: News, userModel: Users, clock: () => now });
  await repository.initialize();
});
const claim = date => repository.claim({ date, requestedBy: adminId, trigger: 'manual' });
async function previousBatch() {
  const older = await claim(yesterday);
  await repository.phase(older, 'publishing', { searchPerformed: true, searchResultCount: 8, sourcesUsed: 2 });
  await repository.publish(older, payload('昨日'));
  await repository.release(older);
  return older;
}
async function manualArticle() {
  return News.create({ title: '人工新闻', excerpt: '人工摘要', content: '人工内容', source: '班级编辑', author: adminId,
    origin: 'manual', status: 'approved', publishedAt: now, sourceHash: 'manual-unique-hash' });
}

test('Asia/Shanghai scheduling does not depend on local server timezone', () => {
  assert.equal(batchDate(new Date('2026-10-05T16:01:00Z')), today);
  assert.equal(dueDate(settingsFrom(), new Date('2026-10-06T10:59:00Z')), null);
  assert.equal(dueDate(settingsFrom(), new Date('2026-10-06T11:00:00Z')), today);
  assert.equal(nextRun(settingsFrom(), new Date('2026-10-06T10:00:00Z')).toISOString(), '2026-10-06T11:00:00.000Z');
  assert.equal(nextRun(settingsFrom(), now, today).toISOString(), '2026-10-07T11:00:00.000Z');
});

test('settings follow one provider and reject disabling real search or injecting secrets', async () => {
  const defaults = await repository.getSettings();
  assert.equal(defaults.articleCount, 2); assert.equal(defaults.timezone, 'Asia/Shanghai');
  for (const value of [{ apiKey: 'secret' }, { webSearch: false }, { time: '25:00' }, { articleCount: 6 }, { categories: [] }]) {
    assert.throws(() => validateSettings(value), error => error.code === 'INVALID_SETTINGS');
  }
  await Settings.updateOne({ _id: 'deepseek' }, { $set: { configured: true, last4: '1234', secret: { version: 1, ciphertext: 'encrypted', iv: 'iv', authTag: 'tag' } } });
  await repository.saveSettings({ time: '18:45', reasoning: 'high' });
  const stored = await Settings.findById('deepseek').select('+secret').lean();
  assert.equal(stored.secret.ciphertext, 'encrypted'); assert.equal(stored.last4, '1234'); assert.equal(stored.configured, true);
  assert.equal(stored.dailyAiNews.time, '18:45');
});

test('idempotent migration treats legacy news as manual and does not change credentials', async () => {
  await News.collection.insertOne({ title: '旧人工新闻', excerpt: '摘要', content: '正文', source: '人工', author: adminId, sourceHash: 'legacy', status: 'approved', publishedAt: now });
  const first = await migrateDailyAiNews({ news: News.collection, settings: Settings.collection, jobs: Jobs.collection });
  const second = await migrateDailyAiNews({ news: News.collection, settings: Settings.collection, jobs: Jobs.collection });
  assert.equal(first.modified, 1); assert.equal(second.modified, 0);
  assert.equal((await News.findOne({ sourceHash: 'legacy' }).lean()).origin, 'manual');
});

test('concurrent deliveries acquire exactly one real database lease', async () => {
  const results = await Promise.allSettled(Array.from({ length: 12 }, () => claim(today)));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected' && result.reason.code === 'ALREADY_RUNNING').length, 11);
  assert.equal(await Jobs.countDocuments(), 1);
});

test('search failure preserves yesterday and every manual article', async () => {
  const older = await previousBatch(), manual = await manualArticle();
  const before = JSON.stringify(await News.findById(manual._id).lean());
  const current = await claim(today);
  await repository.phase(current, 'searching', { searchPerformed: true });
  await repository.fail(current, { code: 'SEARCH_UNAVAILABLE', message: 'provider secret must not leak' });
  await repository.release(current);
  const status = await repository.getStatus();
  assert.equal(status.activeBatchId, older.batchId); assert.equal(status.lastRun.errorCode, 'SEARCH_UNAVAILABLE');
  assert.ok(!status.lastRun.errorMessage.includes('secret'));
  assert.equal(await News.countDocuments(publicNewsFilter(status.activeBatchId, now)), 3);
  assert.equal(JSON.stringify(await News.findById(manual._id).lean()), before);
});

test('partial insert failure keeps staging hidden and prior batch active', async () => {
  const older = await previousBatch(), current = await claim(today), original = News.insertMany;
  News.insertMany = async rows => { await original.call(News, rows.slice(0, 1)); throw new Error('simulated connection interruption'); };
  try { await assert.rejects(repository.publish(current, payload('今天')), error => error.code === 'DATABASE_ERROR'); }
  finally { News.insertMany = original; }
  await repository.fail(current, new Error('insert failure')); await repository.release(current);
  const status = await repository.getStatus();
  assert.equal(status.activeBatchId, older.batchId);
  assert.equal(await News.countDocuments(publicNewsFilter(status.activeBatchId, now)), 2);
  const staging = await News.findOne({ generationBatchId: current.batchId }).lean();
  assert.equal(await articleVisible(staging, now, Settings), false);
});

test('successful full batch atomically replaces prior AI news, never modifies manual', async () => {
  const older = await previousBatch(), manual = await manualArticle();
  const before = JSON.stringify(await News.findById(manual._id).lean());
  const current = await claim(today);
  await repository.phase(current, 'publishing', { searchPerformed: true, searchResultCount: 12, sourcesUsed: 3 });
  const result = await repository.publish(current, payload('今天')); await repository.release(current);
  assert.equal(result.articleCount, 2);
  const status = await repository.getStatus();
  const visible = await News.find(publicNewsFilter(status.activeBatchId, now)).lean();
  assert.equal(visible.length, 3); assert.equal(visible.filter(article => article.origin === 'ai_daily').length, 2);
  const archived = await News.find({ generationBatchId: older.batchId }).lean();
  assert.ok(archived.every(article => article.automationArchivedAt && article.status === 'approved'));
  // A request that read the old pointer immediately before publication remains
  // complete, even after logical archiving. This is why status is not changed.
  assert.equal(await News.countDocuments(publicNewsFilter(older.batchId, now)), 3);
  assert.equal(await articleVisible(archived[0], now, Settings), true);
  assert.equal(JSON.stringify(await News.findById(manual._id).lean()), before);
});

test('same-day retries skip, explicit force creates one replacement batch only', async () => {
  const first = await claim(today); await repository.publish(first, payload('首次')); await repository.release(first);
  assert.equal(await repository.claim({ date: today, trigger: 'scheduler' }), null);
  const replacement = await repository.claim({ date: today, force: true, trigger: 'manual', requestedBy: adminId });
  await repository.publish(replacement, payload('重新生成')); await repository.release(replacement);
  const state = (await Settings.findById('deepseek').lean()).dailyNewsRuntime;
  assert.deepEqual(state.successfulDates, [today]);
  assert.equal(await News.countDocuments(publicNewsFilter(state.activeBatchId, now)), 2);
  assert.equal(await Jobs.countDocuments(), 2);
  assert.equal(await repository.claim({ date: today, trigger: 'scheduler' }), null);
});

test('expired owner is fenced from publishing or releasing the replacement lease', async () => {
  const stale = await claim(today);
  now = new Date(now.getTime() + 11 * 60 * 1000);
  const active = await claim(today);
  assert.equal(await repository.heartbeat(stale), false);
  await assert.rejects(repository.publish(stale, payload('失效')), error => error.code === 'ALREADY_RUNNING');
  await repository.release(stale);
  assert.equal(await repository.heartbeat(active), true);
  await repository.publish(active, payload('有效')); await repository.release(active);
});

test('crash after pointer commit cannot allow duplicate expense or hide published data', async () => {
  const current = await claim(today), original = News.updateMany;
  await repository.phase(current, 'publishing', { articleCount: 2 });
  News.updateMany = async () => { throw new Error('post-commit metadata failure'); };
  try { assert.equal((await repository.publish(current, payload('已提交'))).articleCount, 2); }
  finally { News.updateMany = original; }
  await repository.release(current);
  const status = await repository.getStatus();
  assert.equal(status.lastRun.status, 'success');
  assert.equal(await repository.claim({ date: today, trigger: 'scheduler' }), null);
  const article = await News.findOne({ generationBatchId: current.batchId }).lean();
  assert.equal(article.automationCommittedAt, undefined);
  assert.equal(await articleVisible(article, now, Settings), true);
});

test('automatic failures back off and stop after three attempts, manual retries remain explicit', async () => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const current = await repository.claim({ date: today, trigger: 'scheduler' });
    assert.equal(current.attempts, attempt);
    await repository.fail(current, { code: 'SEARCH_NO_RESULTS' }); await repository.release(current);
    assert.equal(await repository.claim({ date: today, trigger: 'scheduler' }), null);
    now = new Date(now.getTime() + 65 * 60 * 1000);
  }
  assert.equal(await repository.claim({ date: today, trigger: 'scheduler' }), null);
  const explicit = await claim(today); assert.equal(explicit.attempts, 4);
});

test('admin and authenticated Cron call the same injected service; confirmation and role are enforced', async () => {
  process.env.JWT_SECRET = 'isolated-daily-news-test-only';
  const originalFind = UserModel.findById;
  UserModel.findById = id => Users.findById(id);
  const calls = [], service = {
    async status() { return { activeDate: null, history: [], settings: settingsFrom() }; },
    async saveSettings(body) { calls.push({ kind: 'settings', body }); return {}; },
    async requestRun(options) { calls.push({ kind: 'run', options }); return { started: true, job: { status: 'pending' } }; },
    async tick(options) { calls.push({ kind: 'tick', options }); return { started: false }; },
    async dryRun() { calls.push({ kind: 'dry-run' }); return { persist: false }; },
  };
  const app = express(); app.use(express.json());
  app.use('/api/admin/ai/daily-news', createDailyNewsRouter({ service }));
  app.use('/api/cron', createCronRouter({ service }));
  const server = await new Promise(resolve => { const value = app.listen(0, '127.0.0.1', () => resolve(value)); });
  const url = `http://127.0.0.1:${server.address().port}`;
  const request = async (pathname, { user, method = 'GET', body, authorization } = {}) => {
    const token = user && jwt.sign({ userId: String(user), tokenVersion: 0 }, process.env.JWT_SECRET);
    const response = await fetch(url + pathname, { method, headers: {
      ...(token || authorization ? { Authorization: authorization || `Bearer ${token}` } : {}),
      ...(body && { 'Content-Type': 'application/json' }),
    }, ...(body && { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  try {
    assert.equal((await request('/api/admin/ai/daily-news')).status, 401);
    assert.equal((await request('/api/admin/ai/daily-news', { user: memberId })).status, 403);
    assert.equal((await request('/api/admin/ai/daily-news', { user: adminId })).status, 200);
    assert.equal((await request('/api/admin/ai/daily-news/run', { user: adminId, method: 'POST', body: {} })).status, 400);
    assert.equal((await request('/api/admin/ai/daily-news/run', { user: adminId, method: 'POST', body: { confirm: true } })).status, 202);
    delete process.env.CRON_SECRET;
    assert.equal((await request('/api/cron/daily-news')).status, 503);
    process.env.CRON_SECRET = 'isolated-cron-secret';
    assert.equal((await request('/api/cron/daily-news')).status, 401);
    assert.equal((await request('/api/cron/daily-news', { authorization: 'Bearer wrong' })).status, 401);
    assert.equal((await request('/api/cron/daily-news', { authorization: 'Bearer isolated-cron-secret' })).status, 200);
    assert.equal((await request('/api/cron/news-curation', { authorization: 'Bearer isolated-cron-secret' })).status, 200);
    assert.deepEqual(calls.map(call => call.kind), ['run', 'tick', 'tick']);
    assert.equal(calls[0].options.wait, false); assert.equal(calls[1].options.wait, true);
    service.tick = async () => ({ started: true, job: { status: 'failed', errorCode: 'SEARCH_UNAVAILABLE', errorMessage: '联网搜索失败' } });
    const failed = await request('/api/cron/daily-news', { authorization: 'Bearer isolated-cron-secret' });
    assert.equal(failed.body.success, false); assert.equal(failed.body.code, 'SEARCH_UNAVAILABLE');
  } finally {
    await new Promise(resolve => server.close(resolve)); UserModel.findById = originalFind;
    delete process.env.CRON_SECRET;
  }
});
