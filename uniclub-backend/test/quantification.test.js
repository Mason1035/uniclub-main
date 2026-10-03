const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const { ids, emptyZip, MemoryRepository, MemoryStorage } = require('./fixtures/quantificationMemory');
const { MAX_FILE_BYTES, PART_BYTES, verifyZip } = require('../utils/quantificationPolicy');
process.env.JWT_SECRET = randomBytes(32).toString('hex');
let time = new Date('2026-09-30T03:00:00Z');
const now = () => new Date(time);
const repo = new MemoryRepository(now);
const storage = new MemoryStorage(now);
const userPath = require.resolve('../models/User');
const query = value => ({ select() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
require.cache[userPath] = { id: userPath, filename: userPath, loaded: true, exports: { findById: id => query(repo.users.get(String(id))) } };
const Service = require('../services/QuantificationService');
const service = new Service({ repository: repo, storage, now });
const { createRouters } = require('../routes/quantificationRouter');
const routers = createRouters(service);
const app = express(); app.use(express.json());
app.use('/api/quantification', routers.router); app.use('/api/admin/quantification', routers.adminRouter);
let server, origin;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); origin = `http://127.0.0.1:${server.address().port}`; });
after(async () => { await new Promise(resolve => server.close(resolve)); });
beforeEach(() => { time = new Date('2026-09-30T03:00:00Z'); repo.reset(); storage.reset(); for (const id of [ids.member, ids.admin, ids.other]) routers.uploadLimit.resetKey(id); });
async function request(method, path, user = ids.member, body, claims = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (user) headers.Authorization = `Bearer ${jwt.sign({ userId: user, tokenVersion: 0, ...claims }, process.env.JWT_SECRET)}`;
  const r = await fetch(`${origin}/api/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
}
const metadata = { originalFilename: '测试学号_测试姓名.zip', fileSize: 22, mimeType: 'application/zip' };
const init = async (user = ids.member, body = metadata) => service.initUpload(ids.collection, user, body);
async function submit(user = ids.member) { const s = await init(user); storage.put(s.target.key); return (await service.confirm(s.upload.id, user)).submission; }

test('anonymous cannot initialize an upload or list collections', async () => {
  assert.equal((await request('POST', `quantification/collections/${ids.collection}/uploads`, null, metadata)).status, 401);
  assert.equal((await request('GET', 'quantification/collections', null)).status, 401);
  assert.equal(storage.calls.length, 0);
});
test('member upload identity and object keys come from verified JWT', async () => {
  const r = await request('POST', `quantification/collections/${ids.collection}/uploads`, ids.member, metadata);
  assert.equal(r.status, 201); assert.match(r.body.target.key, new RegExp(`^quantification/${ids.collection}/${ids.member}/staging/[a-f0-9]{24}\\.zip$`));
  assert.equal(repo.uploads.get(r.body.upload.id).user, ids.member);
});
test('member cannot impersonate another user or choose storageKey', async () => {
  for (const extra of [{ userId: ids.other }, { user: ids.other }, { storageKey: '../other.zip' }, { '$set': { user: ids.other } }]) {
    assert.equal((await request('POST', `quantification/collections/${ids.collection}/uploads`, ids.member, { ...metadata, ...extra })).status, 400);
  }
  assert.equal(repo.uploads.size, 0);
});
test('admin permission is sourced from database, not token role claims', async () => {
  assert.equal((await request('GET', 'admin/quantification/collections', ids.member, undefined, { isAdmin: true })).status, 403);
  assert.equal((await request('GET', 'admin/quantification/collections', ids.admin)).status, 200);
  assert.equal((await request('GET', 'quantification/access', ids.member, undefined, { isAdmin: true })).body.canManage, false);
});
test('only administrator can create or edit a collection', async () => {
  const body = { title: '隔离测试收集期', description: '', status: 'draft' };
  assert.equal((await request('POST', 'admin/quantification/collections', ids.member, body)).status, 403);
  const r = await request('POST', 'admin/quantification/collections', ids.admin, body); assert.equal(r.status, 201);
  assert.equal((await request('PATCH', `admin/quantification/collections/${r.body.collection.id}`, ids.admin, { status: 'open' })).status, 200);
  assert.equal((await request('PATCH', `admin/quantification/collections/${r.body.collection.id}`, ids.admin, { createdBy: ids.other })).status, 400);
});
test('drafts are not visible to members; scheduled and closed periods reject uploads', async () => {
  const c = repo.collections.get(ids.collection); c.status = 'draft';
  assert.equal((await service.collections()).collections.length, 0);
  await assert.rejects(() => init(), e => e.status === 404);
  c.status = 'open'; c.startAt = new Date(time.getTime() + 3600000);
  await assert.rejects(() => init(), e => e.code === 'COLLECTION_CLOSED');
  c.startAt = null; c.deadline = time;
  await assert.rejects(() => init(), e => e.code === 'COLLECTION_CLOSED');
});
test('reject non-ZIP, unsupported MIME, oversize, malformed size and filename paths', async () => {
  for (const body of [{ ...metadata, originalFilename: 'bad.png' }, { ...metadata, mimeType: 'image/png' }, { ...metadata, fileSize: MAX_FILE_BYTES + 1 }, { ...metadata, fileSize: '22' }, { ...metadata, originalFilename: '../bad.zip' }, { ...metadata, originalFilename: 'bad\\name.zip' }, { ...metadata, originalFilename: 'bad\nname.zip' }]) {
    await assert.rejects(() => init(ids.member, body), e => e.status === 400);
  }
});
test('missing storage is explicit and creates no mock successful submission', async () => {
  storage.configured = false;
  assert.equal((await service.collections()).storage.configured, false);
  await assert.rejects(() => init(), e => e.code === 'STORAGE_UNCONFIGURED'); assert.equal(repo.uploads.size, 0);
});
test('owner-only upload credentials, parts and completion reject other accounts', async () => {
  const session = await init();
  for (const [method, suffix] of [['POST', 'credentials'], ['POST', 'complete'], ['POST', 'abort'], ['GET', 'parts']]) {
    assert.equal((await request(method, `quantification/uploads/${session.upload.id}/${suffix}`, ids.other, method === 'POST' ? {} : undefined)).status, 404);
  }
});
test('fake client completion and object absence cannot create a submission', async () => {
  const s = await init();
  assert.equal((await request('POST', `quantification/uploads/${s.upload.id}/complete`, ids.member, { storageKey: s.target.key, uploaded: true })).status, 400);
  await assert.rejects(() => service.confirm(s.upload.id, ids.member), e => e.status === 404);
  assert.equal(repo.submissions.size, 0);
});
test('actual cloud length and MIME are verified before committing', async () => {
  const s = await init(); storage.put(s.target.key, emptyZip(), { fileSize: 23 });
  await assert.rejects(() => service.confirm(s.upload.id, ids.member), e => e.code === 'OBJECT_MISMATCH');
  storage.put(s.target.key, emptyZip(), { mimeType: 'text/plain' });
  await assert.rejects(() => service.confirm(s.upload.id, ids.member), e => e.code === 'OBJECT_MISMATCH');
  assert.equal(repo.submissions.size, 0);
});
test('four-byte ZIP prefix alone is insufficient; broken directory is rejected', async () => {
  const s = await init(); const invalid = Buffer.alloc(22); invalid.writeUInt32LE(0x04034b50); storage.put(s.target.key, invalid);
  await assert.rejects(() => service.confirm(s.upload.id, ids.member), e => e.code === 'INVALID_ZIP'); assert.equal(repo.submissions.size, 0);
});
test('valid ZIP is sealed before metadata commit and returns no storageKey', async () => {
  const submission = await submit(); assert.equal(submission.version, 1); assert.equal(submission.storageKey, undefined);
  const stored = repo.submissions.get(submission.id); assert.match(stored.storageKey, /\/submitted\//);
  assert.equal(stored.user, ids.member); assert.ok(storage.objects.has(stored.storageKey));
});
test('members cannot read or download another member submission', async () => {
  const submission = await submit(ids.other);
  const mine = await service.mine(ids.collection, ids.member); assert.equal(mine.submission, null);
  assert.equal((await request('GET', `quantification/submissions/${submission.id}/download`, ids.member)).status, 404);
  assert.equal(storage.calls.filter(c => c[0] === 'download').length, 0);
});
test('administrator downloads by submissionId, member management list is forbidden', async () => {
  const s = await submit();
  assert.equal((await request('GET', `admin/quantification/submissions/${s.id}/download`, ids.admin)).status, 200);
  assert.equal((await request('GET', `admin/quantification/collections/${ids.collection}/submissions`, ids.member)).status, 403);
  assert.equal((await request('GET', 'quantification/download?key=arbitrary', ids.member)).status, 404);
});
test('signed download has five-minute expiry and actual object consistency check', async () => {
  const s = await submit(); const link = await service.download(s.id, ids.member);
  assert.equal(new Date(link.expiresAt).getTime() - now().getTime(), 300000);
  const object = storage.objects.get(repo.submissions.get(s.id).storageKey); object.etag = 'changed';
  await assert.rejects(() => service.download(s.id, ids.member), e => e.code === 'OBJECT_CHANGED');
});
test('failed replacement preserves old submission and file', async () => {
  const old = await submit(); const key = repo.submissions.get(old.id).storageKey; const next = await init();
  await assert.rejects(() => service.confirm(next.upload.id, ids.member));
  assert.equal(repo.submissions.get(old.id).storageKey, key); assert.ok(storage.objects.has(key));
});
test('successful replacement increments version and defers deletion', async () => {
  const old = await submit(); const key = repo.submissions.get(old.id).storageKey;
  const s = await init(); storage.put(s.target.key); const next = await service.confirm(s.upload.id, ids.member);
  assert.equal(next.submission.version, 2); assert.equal(repo.submissions.size, 1); assert.ok(storage.objects.has(key));
  assert.ok(repo.uploads.get(s.upload.id).cleanupKeys.includes(key));
});
test('concurrent replacements cannot overwrite the winning version', async () => {
  await submit(); const [a, b] = await Promise.all([init(), init()]); storage.put(a.target.key); storage.put(b.target.key);
  await service.confirm(a.upload.id, ids.member);
  await assert.rejects(() => service.confirm(b.upload.id, ids.member), e => e.code === 'VERSION_CONFLICT');
  assert.equal((await repo.getSubmission(ids.member, ids.collection)).storageKey, repo.uploads.get(a.upload.id).finalKey);
});
test('repeated confirmation recovers after response loss, including after deadline', async () => {
  const s = await init(); storage.put(s.target.key); const first = await service.confirm(s.upload.id, ids.member);
  time = new Date(time.getTime() + 4 * 3600000);
  assert.equal((await service.confirm(s.upload.id, ids.member)).submission.id, first.submission.id);
  assert.equal(repo.submissions.size, 1);
});
test('deadline is checked again after cloud copy and before commit', async () => {
  const old = await submit(); const s = await init(); storage.put(s.target.key);
  storage.beforeSeal = () => { time = new Date(time.getTime() + 2 * 3600000); };
  await assert.rejects(() => service.confirm(s.upload.id, ids.member), e => e.code === 'COLLECTION_CLOSED');
  assert.equal((await repo.getSubmission(ids.member, ids.collection)).version, old.version);
});
test('unfinished multipart upload cannot be confirmed from client metadata', async () => {
  const s = await init(ids.member, { ...metadata, fileSize: PART_BYTES + 22 });
  assert.ok(s.target.multipartId); assert.equal(s.target.partBytes, 20 * 1024 * 1024);
  await assert.rejects(() => service.confirm(s.upload.id, ids.member), e => e.code === 'PARTS_INCOMPLETE');
  assert.equal(repo.submissions.size, 0);
});
test('expired upload cannot issue new credentials or confirm', async () => {
  const s = await init(); time = new Date(time.getTime() + 3 * 3600000); repo.collections.get(ids.collection).deadline = null;
  await assert.rejects(() => service.credentials(s.upload.id, ids.member), e => e.status === 409);
  await assert.rejects(() => service.confirm(s.upload.id, ids.member), e => e.code === 'UPLOAD_EXPIRED');
});
test('cancel leaves the existing submission untouched and stops multipart', async () => {
  const old = await submit(); const s = await init(ids.member, { ...metadata, fileSize: PART_BYTES + 22 });
  assert.equal((await service.abort(s.upload.id, ids.member)).cancelled, true);
  assert.equal(storage.multipart.size, 0); assert.equal((await repo.getSubmission(ids.member, ids.collection)).version, old.version);
});
test('roster-based missing count includes unregistered students, extras are separate', async () => {
  await submit(); await submit(ids.admin); const result = await service.overview(ids.collection);
  assert.deepEqual(result.summary, { total: 2, submitted: 1, missing: 1, outsideRoster: 1 });
  assert.equal(result.rows.find(r => r.studentId === 'TEST-unregistered').registered, false);
  assert.equal((await service.overview(ids.collection, { status: 'missing' })).rows.length, 1);
  assert.equal((await service.overview(ids.collection, { search: 'TEST-member' })).pagination.total, 1);
});
test('bulk download enforces admin and returns real per-file failures', async () => {
  const s = await submit();
  assert.equal((await request('POST', 'admin/quantification/downloads', ids.member, { submissionIds: [s.id] })).status, 403);
  const r = await request('POST', 'admin/quantification/downloads', ids.admin, { submissionIds: [s.id, ids.other] });
  assert.equal(r.body.links.length, 1); assert.equal(r.body.errors.length, 1);
  await assert.rejects(() => service.bulkDownload(new Array(51).fill(s.id), ids.admin), e => e.status === 400);
});
test('durable cleanup removes orphan objects but never current submissions', async () => {
  const old = await submit(); const s = await init(); storage.put(s.target.key); repo.failSave = true;
  await assert.rejects(() => service.confirm(s.upload.id, ids.member)); repo.failSave = false;
  const final = repo.uploads.get(s.upload.id).finalKey; assert.ok(storage.objects.has(final));
  time = new Date(time.getTime() + 4 * 3600000); const result = await service.cleanup(); assert.ok(result.processed >= 1);
  assert.ok(storage.objects.has(repo.submissions.get(old.id).storageKey)); assert.ok(!storage.objects.has(final)); assert.ok(!storage.objects.has(s.target.key));
});
test('cleanup failures remain retryable rather than dropping their records', async () => {
  const s = await init(); storage.put(s.target.key); time = new Date(time.getTime() + 4 * 3600000); storage.failDelete = true;
  assert.equal((await service.cleanup()).failed, 1); assert.equal(repo.uploads.get(s.upload.id).cleanedAt, null);
  storage.failDelete = false; time = new Date(time.getTime() + 3600000); assert.equal((await service.cleanup()).processed, 1);
});
test('lost cleanup-state write is recoverable and retains previous key', async () => {
  const old = await submit(); const oldKey = repo.submissions.get(old.id).storageKey;
  const s = await init(); storage.put(s.target.key); repo.failFinish = true;
  await service.confirm(s.upload.id, ids.member); assert.equal(repo.uploads.get(s.upload.id).previousKey, oldKey);
  repo.failFinish = false; await service.confirm(s.upload.id, ids.member); assert.ok(repo.uploads.get(s.upload.id).cleanupKeys.includes(oldKey));
});
test('COS upload policy grants only an exact staging key, no read or listing', () => {
  const { uploadPolicy } = require('../services/storage/CosStorageAdapter');
  const key = `quantification/${ids.collection}/${ids.member}/staging/${ids.other}.zip`;
  const p = uploadPolicy('example-1234567890', 'ap-guangzhou', key);
  assert.equal(p.statement[0].resource.length, 1); assert.ok(!p.statement[0].resource[0].includes('*'));
  assert.deepEqual(p.statement[0].action, ['name/cos:PutObject', 'name/cos:UploadPart']);
  assert.throws(() => uploadPolicy('example-1234567890', 'ap-guangzhou', key.replace('/staging/', '/submitted/')));
});
test('responses containing credentials/downloads are not cacheable', async () => {
  const response = await fetch(`${origin}/api/quantification/collections`, { headers: { Authorization: `Bearer ${jwt.sign({ userId: ids.member }, process.env.JWT_SECRET)}` } });
  assert.match(response.headers.get('cache-control'), /no-store/);
});

// Assert the cloud boundary without network calls or real credentials.
test('COS confirmation binds range reads and private copy to the inspected ETag', async () => {
  const Adapter = require('../services/storage/CosStorageAdapter');
  const calls = [];
  class FakeCOS {
    getObject(params, callback) { calls.push(['read', params]); callback(null, { Body: Buffer.from('PK') }); }
    putObjectCopy(params, callback) { calls.push(['copy', params]); callback(null, {}); }
    headObject(params, callback) { callback(null, { headers: { 'content-length': '22', 'content-type': 'application/zip', etag: 'sealed-etag' } }); }
  }
  const adapter = new Adapter({ COS_BUCKET: 'verification-1234567890', COS_REGION: 'ap-guangzhou', COS_SECRET_ID: 'test-only', COS_SECRET_KEY: 'test-only' }, { COS: FakeCOS });
  const source = `quantification/${ids.collection}/${ids.member}/staging/${ids.other}.zip`;
  const target = source.replace('/staging/', '/submitted/');
  await adapter.readRange(source, 0, 3, 'inspected-etag');
  assert.equal(calls[0][1].IfMatch, 'inspected-etag');
  assert.equal(calls[0][1].Range, 'bytes=0-3');
  assert.equal((await adapter.sealObject(source, target, 'inspected-etag')).etag, 'sealed-etag');
  assert.equal(calls[1][1].CopySourceIfMatch, 'inspected-etag');
  assert.equal(calls[1][1].ACL, 'private');
  assert.equal(calls[1][1].Key, target);
});
test('COS multipart confirmation rejects missing or wrong-sized cloud parts before completion', async () => {
  const Adapter = require('../services/storage/CosStorageAdapter');
  let listed = [{ PartNumber: 1, Size: PART_BYTES, ETag: 'one' }], completed;
  class FakeCOS {
    multipartListPart(params, callback) { callback(null, { Part: listed, IsTruncated: false }); }
    multipartComplete(params, callback) { completed = params; callback(null, {}); }
  }
  const adapter = new Adapter({ COS_BUCKET: 'verification-1234567890', COS_REGION: 'ap-guangzhou', COS_SECRET_ID: 'test-only', COS_SECRET_KEY: 'test-only' }, { COS: FakeCOS });
  const key = `quantification/${ids.collection}/${ids.member}/staging/${ids.other}.zip`;
  await assert.rejects(() => adapter.completeMultipart(key, 'test-upload', PART_BYTES + 22, PART_BYTES), e => e.code === 'PARTS_INCOMPLETE');
  assert.equal(completed, undefined);
  listed.push({ PartNumber: 2, Size: 21, ETag: 'two' });
  await assert.rejects(() => adapter.completeMultipart(key, 'test-upload', PART_BYTES + 22, PART_BYTES), e => e.code === 'PARTS_INCOMPLETE');
  listed[1].Size = 22;
  await adapter.completeMultipart(key, 'test-upload', PART_BYTES + 22, PART_BYTES);
  assert.deepEqual(completed.Parts, [{ PartNumber: 1, ETag: 'one' }, { PartNumber: 2, ETag: 'two' }]);
});
test('COS download signs an attachment for five minutes and suppresses SDK error details', async () => {
  const Adapter = require('../services/storage/CosStorageAdapter');
  let signed;
  class FakeCOS {
    getObjectUrl(params, callback) { signed = params; callback(null, { Url: 'https://storage.example.test/download' }); }
    headObject(params, callback) { callback({ statusCode: 403, message: 'SDK internal authorization details' }); }
  }
  const adapter = new Adapter({ COS_BUCKET: 'verification-1234567890', COS_REGION: 'ap-guangzhou', COS_SECRET_ID: 'test-only', COS_SECRET_KEY: 'test-only' }, { COS: FakeCOS });
  const key = `quantification/${ids.collection}/${ids.member}/submitted/${ids.other}.zip`;
  await adapter.downloadUrl(key, '中文材料.zip');
  assert.equal(signed.Expires, 300);
  assert.equal(signed.Sign, true);
  assert.match(signed.Query['response-content-disposition'], /^attachment;/);
  assert.ok(signed.Query['response-content-disposition'].includes(encodeURIComponent('中文材料.zip')));
  await assert.rejects(() => adapter.headObject(key), e => e.code === 'STORAGE_FAILED' && !e.message.includes('SDK internal'));
});
test('a confirmation whose lease expired during cloud copy cannot replace a submission', async () => {
  const old = await submit(), next = await init(); storage.put(next.target.key);
  storage.beforeSeal = () => { time = new Date(time.getTime() + 6 * 60000); };
  await assert.rejects(() => service.confirm(next.upload.id, ids.member), e => e.code === 'CONFIRMATION_EXPIRED');
  assert.equal((await repo.getSubmission(ids.member, ids.collection)).version, old.version);
  storage.beforeSeal = null;
  assert.equal((await service.confirm(next.upload.id, ids.member)).submission.version, old.version + 1);
});
test('a slow old lease cannot overwrite the file or metadata committed by a new lease', async () => {
  await submit(); const next = await init(); storage.put(next.target.key);
  let reach, release, paused = false;
  const reachedCopy = new Promise(resolve => { reach = resolve; });
  storage.beforeSeal = async () => { if (!paused) { paused = true; reach(); await new Promise(resolve => { release = resolve; }); } };
  const first = service.confirm(next.upload.id, ids.member);
  const rejectedFirst = assert.rejects(first, e => e.code === 'CONFIRMATION_EXPIRED');
  await reachedCopy; time = new Date(time.getTime() + 6 * 60000);
  const winner = await service.confirm(next.upload.id, ids.member);
  const winningKey = (await repo.getSubmission(ids.member, ids.collection)).storageKey;
  release(); await rejectedFirst;
  assert.equal((await repo.getSubmission(ids.member, ids.collection)).storageKey, winningKey);
  assert.equal(winner.submission.version, 2);
  assert.ok(storage.objects.has(winningKey));
  assert.equal(new Set(repo.uploads.get(next.upload.id).sealedKeys).size, 2);
});
test('late copy after expired-session cleanup is never committed and remains cleanable', async () => {
  const old = await submit(), next = await init(); storage.put(next.target.key);
  repo.collections.get(ids.collection).deadline = null;
  const sealObject = storage.sealObject.bind(storage);
  let lateKey;
  storage.sealObject = async (source, target) => {
    const acceptedBytes = Buffer.from(storage.objects.get(source).body);
    time = new Date(time.getTime() + 3 * 3600000);
    await service.cleanup();
    storage.put(target, acceptedBytes); lateKey = target;
    return storage.headObject(target);
  };
  try { await assert.rejects(() => service.confirm(next.upload.id, ids.member), e => e.code === 'UPLOAD_EXPIRED'); }
  finally { storage.sealObject = sealObject; }
  assert.equal((await repo.getSubmission(ids.member, ids.collection)).version, old.version);
  assert.equal(repo.uploads.get(next.upload.id).cleanedAt, null);
  assert.ok(storage.objects.has(lateKey));
  time = new Date(time.getTime() + 16 * 60000);
  await service.cleanup();
  assert.equal(storage.objects.has(lateKey), false);
  assert.ok(storage.objects.has((await repo.getSubmission(ids.member, ids.collection)).storageKey));
});
