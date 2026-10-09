const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomBytes } = require('node:crypto');
const express = require('express');
const { Readable } = require('node:stream');
const jwt = require('jsonwebtoken');
const COS = require('cos-nodejs-sdk-v5');
const Settings = require('../services/QuantificationStorageSettings');
const ScfAdapter = require('../services/storage/ScfStorageAdapter');
const { ids, MemoryRepository, MemoryStorage } = require('./fixtures/quantificationMemory');
const { PART_BYTES } = require('../utils/quantificationPolicy');
const { createApp } = require('../cloud-functions/quantification/download/src/app');

process.env.JWT_SECRET = randomBytes(32).toString('hex');
const now = () => new Date();
const repo = new MemoryRepository(now);
repo.hasStorageRecords = async () => repo.submissions.size > 0 || [...repo.uploads.values()].some(u => !u.cleanedAt);
const objects = new MemoryStorage(now);
const userPath = require.resolve('../models/User');
const query = value => ({ select() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
require.cache[userPath] = { id: userPath, filename: userPath, loaded: true, exports: { findById: id => query(repo.users.get(String(id))) } };
const Service = require('../services/QuantificationService');
const { createRouters } = require('../routes/quantificationRouter');
const cloudCalls = [];
let root, settings, server, origin, cloudServer, cloudOrigin;
const baseEnv = { COS_BUCKET: 'isolated-classhub-1234567890', COS_REGION: 'ap-guangzhou' };
const metadata = { originalFilename: '隔离测试.zip', fileSize: 22, mimeType: 'application/zip' };
const input = () => ({ revision: settings.view().revision, bucket: baseEnv.COS_BUCKET, region: baseEnv.COS_REGION, endpoint: `https://${baseEnv.COS_BUCKET}.cos.${baseEnv.COS_REGION}.myqcloud.com`, directoryPrefix: 'quantification/', tokenEndpoint: 'https://isolated-token.ap-guangzhou.tencentscf.com', functionUrl: 'https://isolated-download.ap-guangzhou.tencentscf.com' });
class FakeCos extends COS {
  constructor(options) { super(options); this.testRole = options.SecretId; }
  rejectReader(callback) { if (this.testRole === 'test-temp-id') { callback({ statusCode: 403 }); return true; } return false; }
  headObject(p, callback) { if (this.rejectReader(callback)) return; objects.headObject(p.Key).then(data => callback(null, { headers: { 'content-length': data.fileSize, 'content-type': data.mimeType, etag: data.etag } }), callback); }
  getObject(p, callback) { if (this.rejectReader(callback)) return; const [start, end] = p.Range.slice(6).split('-').map(Number); objects.readRange(p.Key, start, end, p.IfMatch).then(Body => callback(null, { Body }), callback); }
  putObjectCopy(p, callback) { if (this.rejectReader(callback)) return; const source = decodeURIComponent(p.CopySource.split('/').slice(1).join('/')); objects.sealObject(source, p.Key, p.CopySourceIfMatch).then(() => callback(null, {}), callback); }
  deleteObject(p, callback) { objects.deleteObject(p.Key).then(() => callback(null, {}), callback); }
  multipartInit(p, callback) { objects.initiateUpload(p.Key).then(UploadId => { objects.multipart.get(UploadId).uploadId = p.Headers['x-cos-meta-classhub-upload']; callback(null, { UploadId }); }, callback); }
  multipartListPart(p, callback) { objects.listParts(p.Key, p.UploadId).then(parts => callback(null, { Part: parts.map(part => ({ PartNumber: part.partNumber, Size: part.size, ETag: part.etag })), IsTruncated: false }), callback); }
  multipartComplete(p, callback) { assert.equal(p.Headers['x-cos-forbid-overwrite'], 'true'); const upload = objects.multipart.get(p.UploadId); const parts = [...upload.parts.values()]; objects.completeMultipart(p.Key, p.UploadId, parts.reduce((n, b) => n + b.length, 0)).then(() => { objects.objects.get(p.Key).uploadId = upload.uploadId; callback(null, {}); }, callback); }
  multipartAbort(p, callback) { objects.abortMultipart(p.Key, p.UploadId).then(() => callback(null, {}), callback); }
  getBucket(p, callback) { callback(null, { Contents: [...objects.objects].filter(([key]) => key.startsWith(p.Prefix)).map(([Key, o]) => ({ Key, Size: o.fileSize })), IsTruncated: false }); }
}
const http = { async get(url, options) {
  if (new URL(url).hostname.endsWith('.myqcloud.com')) {
    const key = decodeURIComponent(new URL(url).pathname.slice(1)); const object = objects.objects.get(key);
    if (!object) throw { response: { status: 404 } };
    if (options.headers['If-Match'] && options.headers['If-Match'] !== object.etag) throw { response: { status: 412 } };
    assert.equal(options.headers.Authorization, undefined);
    if (options.responseType === 'stream') return { status: 200, data: Readable.from(object.body) };
    const [start, end] = options.headers.Range.slice(6).split('-').map(Number);
    const data = object.body.subarray(start, end + 1);
    return { status: 206, data, headers: { 'content-range': `bytes ${start}-${end}/${object.fileSize}`, 'content-type': object.mimeType, etag: object.etag, 'x-cos-meta-classhub-upload': object.uploadId || '' } };
  }
  cloudCalls.push({ url, options });
  assert.equal(options.headers, undefined); assert.equal(options.auth, undefined); assert.equal(options.data, undefined); assert.equal(options.maxRedirects, 0);
  const p = options.params;
  assert.deepEqual(Object.keys(p).sort(), (url.endsWith('/download') ? ['bucket', 'region', 'prefix', 'key', 'filename'] : url.endsWith('/list') ? ['bucket', 'region', 'prefix', 'limit', ...(p.marker ? ['marker'] : [])] : ['bucket', 'region', 'prefix']).sort());
  if (url.endsWith('/download')) {
    if (!objects.objects.has(p.key)) throw { response: { status: 404 } };
    const cos = new FakeCos({ SecretId: 'test-read-id', SecretKey: 'test-read-key', SecurityToken: 'test-session-token', Protocol: 'https:' });
    const data = await new Promise((resolve, reject) => cos.getObjectUrl({ Bucket: p.bucket, Region: p.region, Key: p.key, Sign: true, Expires: 300 }, (e, d) => e ? reject(e) : resolve(d)));
    return { data: { success: true, url: data.Url } };
  }
  if (url.endsWith('/list')) return { data: { success: true, prefix: p.prefix, files: [...objects.objects].filter(([key]) => key.startsWith(p.prefix)).map(([key, object]) => ({ key, name: key.slice(p.prefix.length), size: object.fileSize, lastModified: new Date().toISOString() })) } };
  return { data: { success: true, bucket: p.bucket, region: p.region, credentials: { TmpSecretId: 'test-temp-id', TmpSecretKey: 'test-temp-key', Token: 'test-session-token' } } };
}, async put(url, stream, options) {
  const key = decodeURIComponent(new URL(url).pathname.slice(1));
  assert.equal(options.headers['x-cos-forbid-overwrite'], 'true');
  if (objects.objects.has(key)) throw { response: { status: 409 } };
  const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  objects.put(key, Buffer.concat(chunks), { uploadId: options.headers['x-cos-meta-classhub-upload'] });
  return { status: 200 };
} };
const storageFactory = env => new ScfAdapter(env, { COS: FakeCos, http });
let service, routers;
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'classhub-config-test-'));
  settings = new Settings({ filename: path.join(root, '.quantification-storage.json'), env: baseEnv });
  service = new Service({ repository: repo, settings, storageFactory, now });
  routers = createRouters(service);
  const app = express(); app.use(express.json()); app.use('/api/quantification', routers.router); app.use('/api/admin/quantification', routers.adminRouter);
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  cloudServer = createApp({ env: { TENCENTCLOUD_SECRETID: 'test-id', TENCENTCLOUD_SECRETKEY: 'test-key', TENCENTCLOUD_SESSIONTOKEN: 'test-session' }, Cos: FakeCos }).listen(0, '127.0.0.1');
  await new Promise(resolve => cloudServer.once('listening', resolve)); cloudOrigin = `http://127.0.0.1:${cloudServer.address().port}`;
});
after(async () => { await Promise.all([new Promise(resolve => server.close(resolve)), new Promise(resolve => cloudServer.close(resolve))]); await fs.rm(root, { recursive: true, force: true }); });
beforeEach(async () => { repo.reset(); objects.reset(); cloudCalls.length = 0; await fs.unlink(settings.filename).catch(() => {}); for (const id of [ids.member, ids.admin, ids.other]) routers.uploadLimit.resetKey(id); });
async function request(method, suffix, user = ids.admin, body, claims = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (user) headers.Authorization = `Bearer ${jwt.sign({ userId: user, tokenVersion: 0, ...claims }, process.env.JWT_SECRET)}`;
  const r = await fetch(`${origin}/api/${suffix}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json(), headers: r.headers };
}
const save = body => settings.save(body || input(), ids.admin, repo.hasStorageRecords);

test('configuration is admin-only, including forged role claims and connection tests', async () => {
  for (const [method, suffix, body] of [['GET', 'storage'], ['PUT', 'storage', input()], ['POST', 'storage/test', {}]]) {
    assert.equal((await request(method, `admin/quantification/${suffix}`, null, body)).status, 401);
    assert.equal((await request(method, `admin/quantification/${suffix}`, ids.member, body, { isAdmin: true })).status, 403);
  }
  assert.equal(cloudCalls.length, 0);
});
test('six-field configuration survives restart and creates a private 0600 file', async () => {
  const r = await request('PUT', 'admin/quantification/storage', ids.admin, input());
  assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store, private');
  assert.deepEqual(Object.keys(r.body).sort(), ['revision', 'mode', 'bucket', 'region', 'endpoint', 'directoryPrefix', 'tokenEndpoint', 'functionUrl', 'updatedAt'].sort());
  assert.equal((await fs.stat(settings.filename)).mode & 0o777, 0o600);
  const fresh = new Settings({ filename: settings.filename, env: {} });
  assert.equal(fresh.view().bucket, baseEnv.COS_BUCKET); assert.equal(storageFactory(fresh.environment()).describe().configured, true);
  assert.deepEqual(Object.keys(fresh.read().values).sort(), ['OBJECT_STORAGE_PROVIDER', 'COS_BUCKET', 'COS_REGION', 'COS_ENDPOINT', 'COS_UPLOAD_DIRECTORY', 'SCF_TOKEN_ENDPOINT', 'SCF_FUNCTION_URL'].sort());
});
test('retired cloud access fields in saved data, env and older clients are ignored without a migration', async () => {
  await save();
  const retired = { SCF_AUTH_TOKEN: 'unused-value', SCF_SHARED_TOKEN: null, scfSharedToken: { obsolete: true }, sharedToken: 10, shared_token: false, scfToken: 'unused', scf_token: 'unused', functionToken: 'unused', function_token: 'unused', authToken: 'short', authTokenConfigured: true };
  const old = settings.read(); Object.assign(old.values, retired);
  const bytes = JSON.stringify(old); await fs.writeFile(settings.filename, bytes);
  const fresh = new Settings({ filename: settings.filename, env: { ...baseEnv, SCF_AUTH_TOKEN: 'unused-env', SCF_SHARED_TOKEN: 'unused-env' } });
  assert.equal(fresh.view().bucket, baseEnv.COS_BUCKET);
  for (const key of Object.keys(retired)) assert.equal(Object.hasOwn(fresh.environment(), key), false);
  assert.equal(storageFactory(fresh.environment()).describe().configured, true);
  assert.equal(await fs.readFile(settings.filename, 'utf8'), bytes);
  const r = await request('PUT', 'admin/quantification/storage', ids.admin, { ...input(), ...retired });
  assert.equal(r.status, 200);
  for (const key of Object.keys(retired)) {
    assert.equal(Object.hasOwn(settings.read().values, key), false);
    assert.equal(Object.hasOwn(r.body, key), false);
  }
});
test('reject stale writes, arbitrary env changes, unsafe prefixes and SSRF URLs', async () => {
  const stale = input(); await save();
  await assert.rejects(() => save(stale), error => error.code === 'CONFIG_CONFLICT');
  for (const extra of [{ JWT_SECRET: 'bad' }, { directoryPrefix: '../outside/' }, { directoryPrefix: 'a//b' }, { tokenEndpoint: 'http://127.0.0.1:5050/' }, { tokenEndpoint: 'https://a.ap-guangzhou.tencentscf.com@127.0.0.1/' }, { functionUrl: 'https://a.ap-guangzhou.tencentscf.com/download' }, { endpoint: 'https://attacker.example' }]) {
    await assert.rejects(() => save({ ...input(), ...extra }), error => error.status === 400);
  }
  assert.equal(settings.environment().COS_BUCKET, baseEnv.COS_BUCKET);
});
test('quantification storage rejects the activity namespace without replacing saved settings', async () => {
  await save(); const bytes = await fs.readFile(settings.filename);
  for (const directoryPrefix of ['activity', 'activity/', ' activity/photos ', 'activity/photos/']) {
    const result = await request('PUT', 'admin/quantification/storage', ids.admin, { ...input(), directoryPrefix });
    assert.equal(result.status, 400);
    assert.deepEqual(await fs.readFile(settings.filename), bytes);
  }
  assert.equal(settings.environment().COS_UPLOAD_DIRECTORY, 'quantification/');
  assert.equal(cloudCalls.length, 0);
  assert.equal(settings.validate({ ...input(), directoryPrefix: 'activity-archive/' }, settings.view()).COS_UPLOAD_DIRECTORY, 'activity-archive/');
});
test('configuration failures do not destroy the last saved file', async () => {
  await save(); const bytes = await fs.readFile(settings.filename);
  await fs.writeFile(`${settings.filename}.lock`, 'isolated-lock');
  await assert.rejects(() => save(), error => error.code === 'CONFIG_BUSY');
  assert.deepEqual(await fs.readFile(settings.filename), bytes); await fs.unlink(`${settings.filename}.lock`);
});
test('malformed settings fail closed instead of silently switching buckets', async () => {
  await fs.writeFile(settings.filename, '{broken');
  assert.throws(() => settings.environment(), error => error.code === 'CONFIG_UNREADABLE');
});
test('bucket or region changes are rejected when uploaded materials exist', async () => {
  await save(); await service.run(s => s.initUpload(ids.collection, ids.member, metadata));
  const bucket = 'another-classhub-1234567890';
  await assert.rejects(() => save({ ...input(), bucket, endpoint: `https://${bucket}.cos.ap-guangzhou.myqcloud.com` }), error => error.code === 'STORAGE_IN_USE');
});
test('save is rejected during in-flight storage work and the operation lease is released on errors', async () => {
  await save(); let unblock; const pending = service.run(async () => new Promise(resolve => { unblock = resolve; }));
  await assert.rejects(() => save(), error => error.code === 'CONFIG_BUSY'); unblock(); await pending;
  await assert.rejects(() => service.run(() => { throw new Error('isolated failure'); })); await save();
});
test('SCF credentials never reach students; signed PUT uses an exact key, headers, method and expiry', async () => {
  await save(); const init = await request('POST', `quantification/collections/${ids.collection}/uploads`, ids.member, metadata);
  assert.equal(init.status, 201); assert.equal(init.body.credentials.mode, 'signed'); assert.equal(init.body.target.key, 'quantification/隔离测试.zip'); assert.equal(JSON.stringify(init.body).includes('test-temp'), false);
  const auth = await request('POST', `quantification/uploads/${init.body.upload.id}/authorization`, ids.member, { partNumber: null });
  assert.equal(auth.status, 200);
  const url = new URL(auth.body.url);
  assert.equal(decodeURIComponent(url.pathname), `/${init.body.target.key}`);
  assert.match(url.searchParams.get('q-header-list'), /content-type;host;x-cos-acl/);
  const [start, end] = url.searchParams.get('q-sign-time').split(';').map(Number); assert.equal(end - start, 300);
  const expected = COS.getAuthorization({ SecretId: 'test-temp-id', SecretKey: 'test-temp-key', Method: 'PUT', Key: init.body.target.key, Headers: { ...auth.body.headers, host: url.hostname }, KeyTime: `${start};${end}` });
  assert.equal(url.searchParams.get('q-signature'), new URLSearchParams(expected).get('q-signature'));
  assert.equal(auth.body.headers['x-cos-acl'], 'private');
  assert.equal(auth.body.headers['x-cos-forbid-overwrite'], 'true');
  assert.equal(auth.body.headers['x-cos-meta-classhub-upload'], init.body.upload.id);
  assert.equal((await request('POST', `quantification/uploads/${init.body.upload.id}/authorization`, ids.other, { partNumber: null })).status, 404);
  for (const body of [{ partNumber: 1 }, { partNumber: null, key: init.body.target.key }, {}]) assert.equal((await request('POST', `quantification/uploads/${init.body.upload.id}/authorization`, ids.member, body)).status, 400);
});
test('multipart authorization is restricted to the server-created upload id and valid part numbers', async () => {
  await save(); const session = await service.run(s => s.initUpload(ids.collection, ids.member, { ...metadata, fileSize: PART_BYTES + 22 }));
  for (const partNumber of [null, 0, 3, '1', -1]) await assert.rejects(() => service.run(s => s.authorizeUpload(session.upload.id, ids.member, { partNumber })), error => error.status === 400);
  const auth = await service.run(s => s.authorizeUpload(session.upload.id, ids.member, { partNumber: 2 }));
  const url = new URL(auth.url); assert.equal(url.searchParams.get('uploadId'), session.target.multipartId); assert.equal(url.searchParams.get('partNumber'), '2');
  assert.match(url.searchParams.get('q-url-param-list'), /partnumber;uploadid/);
});
test('saving a new directory immediately affects new uploads and preserves confirmation/download paths for old ones', async () => {
  await save(); const old = await service.run(s => s.initUpload(ids.collection, ids.member, metadata)); objects.put(old.target.key, undefined, { uploadId: old.upload.id });
  await save({ ...input(), directoryPrefix: 'materials/2026' });
  const submitted = await service.run(s => s.confirm(old.upload.id, ids.member));
  const stored = repo.submissions.get(submitted.submission.id); assert.match(stored.storageKey, /^quantification\//);
  const download = await service.run(s => s.download(submitted.submission.id, ids.member)); assert.ok(download.url);
  assert.equal(cloudCalls.at(-1).options.params.prefix, 'quantification/');
  const next = await service.run(s => s.initUpload(ids.collection, ids.member, metadata)); assert.match(next.target.key, /^materials\/2026\//);
});
test('connection check actually calls both configured SCF endpoints without exposing credentials', async () => {
  await save(); const r = await request('POST', 'admin/quantification/storage/test', ids.admin, {});
  assert.equal(r.status, 200); assert.equal(r.body.connected, true); assert.deepEqual(cloudCalls.map(call => call.url), [input().tokenEndpoint, `${input().functionUrl}/list`]);
  assert.doesNotMatch(JSON.stringify(r.body), /test-temp|test-session/);
});
test('incomplete cloud credentials and poisoned download URLs are rejected', async () => {
  await save();
  const incomplete = new ScfAdapter(settings.environment(), { http: { get: async () => ({ data: { success: true } }) } });
  await assert.rejects(() => incomplete.credentials(`quantification/${ids.collection}/${ids.member}/staging/${ids.other}.zip`), error => error.code === 'SCF_CONTRACT');
  const adapter = storageFactory(settings.environment());
  assert.throws(() => adapter.validateUrl('https://attacker.example/secret?q-signature=bad', `quantification/${ids.collection}/${ids.member}/submitted/${ids.other}.zip`), error => error.code === 'SCF_CONTRACT');
});
test('public Function URL requests need no access token or response version for upload, list and download', async () => {
  await save(); const adapter = storageFactory(settings.environment());
  assert.equal(adapter.describe().configured, true);
  const key = `quantification/${ids.collection}/${ids.member}/submitted/${ids.other}.zip`; objects.put(key);
  const connected = await adapter.testConnection(); assert.equal(connected.connected, true);
  const url = new URL(await adapter.downloadUrl(key, metadata.originalFilename));
  assert.equal(url.searchParams.get('x-cos-security-token'), 'test-session-token');
  assert.deepEqual(cloudCalls.map(call => call.url), [input().tokenEndpoint, `${input().functionUrl}/list`, `${input().functionUrl}/download`]);
  for (const { options } of cloudCalls) assert.equal(options.headers, undefined);
});
test('cloud errors mask credentials, response bodies and transport errors', async () => {
  await save(); const privateMessage = 'private-cloud-error-details';
  const adapter = new ScfAdapter(settings.environment(), { http: { get: async () => { throw { response: { status: 403, data: { privateMessage } }, message: privateMessage }; } } });
  await assert.rejects(() => adapter.credentials(`quantification/${ids.collection}/${ids.member}/staging/${ids.other}.zip`), error => error.code === 'SCF_UNAVAILABLE' && !error.message.includes(privateMessage));
});
test('download cloud function accepts public requests and rejects traversal and outside-prefix keys', async () => {
  const params = new URLSearchParams({ bucket: baseEnv.COS_BUCKET, region: baseEnv.COS_REGION, prefix: 'quantification/' });
  const response = await fetch(`${cloudOrigin}/list?${params}`);
  assert.equal(response.status, 200); assert.equal((await response.json()).success, true);
  for (const key of ['../secret.zip', 'elsewhere/test.zip', 'quantification/a/../secret.zip']) {
    const r = await fetch(`${cloudOrigin}/download?${params}&key=${encodeURIComponent(key)}`); assert.equal(r.status, 400);
  }
});
test('download cloud function honors the configured bucket, directory and original filename', async () => {
  const key = `materials/2026/${ids.collection}/${ids.member}/submitted/${ids.other}.zip`; objects.put(key);
  const params = new URLSearchParams({ bucket: baseEnv.COS_BUCKET, region: baseEnv.COS_REGION, prefix: 'materials/2026/', key, filename: '原始文件名.zip' });
  const response = await fetch(`${cloudOrigin}/download?${params}`); const body = await response.json(); assert.equal(response.status, 200);
  const url = new URL(body.url); assert.equal(url.hostname, `${baseEnv.COS_BUCKET}.cos.${baseEnv.COS_REGION}.myqcloud.com`); assert.equal(decodeURIComponent(url.pathname), `/${key}`);
  assert.match(url.searchParams.get('response-content-disposition'), /filename\*=UTF-8''/);
  assert.equal(url.searchParams.get('x-cos-security-token'), 'test-session');
});

test('write-only upload role completes flat-file confirmation using download-role reads with no copy permission', async () => {
  await save(); repo.roster = [];
  const initialized = await request('POST', `quantification/collections/${ids.collection}/uploads`, ids.member, metadata);
  assert.equal(initialized.status, 201); const session = initialized.body;
  objects.put(session.target.key, undefined, { uploadId: session.upload.id });
  const confirmed = await request('POST', `quantification/uploads/${session.upload.id}/complete`, ids.member, {});
  assert.equal(confirmed.status, 200); assert.equal(repo.submissions.get(confirmed.body.submission.id).storageKey, 'quantification/隔离测试.zip');
  const downloaded = await request('GET', `quantification/submissions/${confirmed.body.submission.id}/download`, ids.member);
  assert.equal(downloaded.status, 200); assert.equal(new URL(downloaded.body.url).searchParams.get('x-cos-security-token'), 'test-session-token');
  assert.equal((await request('POST', `quantification/uploads/${session.upload.id}/complete`, ids.member, {})).status, 200);
});
test('flat names cannot overwrite existing materials or confirm a file written for another upload', async () => {
  await save(); objects.put('quantification/隔离测试.zip');
  const blocked = await request('POST', `quantification/collections/${ids.collection}/uploads`, ids.member, metadata);
  assert.equal(blocked.status, 409); assert.equal(blocked.body.code, 'FILENAME_EXISTS'); assert.equal(repo.uploads.size, 0);
  const session = await service.run(s => s.initUpload(ids.collection, ids.member, { ...metadata, originalFilename: '另一份.zip' }));
  objects.put(session.target.key, undefined, { uploadId: ids.other });
  await assert.rejects(() => service.run(s => s.confirm(session.upload.id, ids.member)), error => error.code === 'OBJECT_MISMATCH');
});
test('old staged uploads recover to the original filename using signed read and PUT, and hide the retained duplicate', async () => {
  await save(); repo.roster = [];
  const source = `quantification/${ids.collection}/${ids.member}/staging/${ids.other}.zip`;
  await repo.createUpload({ _id: ids.other, collectionId: ids.collection, user: ids.member, ...metadata, stagingKey: source, finalKey: source.replace('/staging/', '/submitted/'), baseVersion: 0, state: 'pending', expiresAt: new Date(Date.now() + 3600000) });
  objects.put(source);
  const before = await service.run(s => s.storageFiles()); assert.equal(before.files[0].name, metadata.originalFilename); assert.equal(before.files[0].pending, true);
  const confirmed = await service.run(s => s.confirm(ids.other, ids.member));
  assert.equal(repo.submissions.get(confirmed.submission.id).storageKey, 'quantification/隔离测试.zip'); assert.ok(objects.objects.has(source));
  const after = await service.run(s => s.storageFiles()); assert.equal(after.count, 1); assert.equal(after.retainedCopies, 1); assert.equal(after.files[0].key, 'quantification/隔离测试.zip');
});
test('42 existing files refresh and download with no roster or website submission records, under admin authentication', async () => {
  await save(); repo.roster = [];
  for (let i = 0; i < 42; i++) objects.put(`quantification/学生材料${i}.zip`);
  for (const user of [null, ids.member]) {
    assert.equal((await request('GET', 'admin/quantification/files', user)).status, user ? 403 : 401);
    assert.equal((await request('POST', 'admin/quantification/files/downloads', user, { keys: ['quantification/学生材料1.zip'] })).status, user ? 403 : 401);
  }
  const listed = await request('GET', 'admin/quantification/files'); assert.equal(listed.status, 200); assert.equal(listed.body.count, 42); assert.equal(repo.submissions.size, 0);
  const links = await request('POST', 'admin/quantification/files/downloads', ids.admin, { keys: listed.body.files.map(file => file.key) });
  assert.equal(links.status, 200); assert.equal(links.body.links.length, 42); assert.equal(links.body.errors.length, 0);
  objects.put('quantification/新增材料.zip'); assert.equal((await request('GET', 'admin/quantification/files')).body.count, 43);
  const invalid = await request('POST', 'admin/quantification/files/downloads', ids.admin, { keys: ['../secret.zip', 'outside/file.zip'] });
  assert.equal(invalid.body.links.length, 0); assert.equal(invalid.body.errors.length, 2);
  assert.equal((await request('POST', 'admin/quantification/files/downloads', ids.admin, { keys: [], token: 'bad' })).status, 400);
});
test('cloud list consumes all pages, deduplicates keys and rejects a looping marker', async () => {
  await save(); let calls = 0;
  const adapter = new ScfAdapter(settings.environment(), { http: { get: async (url, options) => {
    calls++; assert.equal(options.headers, undefined);
    const files = [{ key: 'quantification/分页材料.zip', size: 22 }];
    if (options.params.marker) return { data: { success: true, prefix: 'quantification/', files: [...files, { key: 'quantification/第二页.zip', size: 22 }] } };
    return { data: { success: true, prefix: 'quantification/', files, nextMarker: 'quantification/分页材料.zip' } };
  } } });
  assert.equal((await adapter.listFiles()).length, 2); assert.equal(calls, 2);
  adapter.http.get = async () => ({ data: { success: true, prefix: 'quantification/', files: [], nextMarker: 'quantification/same.zip' } });
  await assert.rejects(() => adapter.listFiles(), error => error.code === 'SCF_CONTRACT');
});
test('signed COS range reads bind the source ETag and reject unbounded or changed responses', async () => {
  await save(); const key = 'quantification/读取校验.zip'; objects.put(key);
  const adapter = storageFactory(settings.environment()); const head = await adapter.headObject(key);
  assert.equal(head.fileSize, 22); assert.equal((await adapter.readRange(key, 0, 3, head.etag)).length, 4);
  await assert.rejects(() => adapter.readRange(key, 0, 3, 'wrong-etag'), error => error.code === 'OBJECT_CHANGED');
  adapter.http = { get: async () => ({ status: 200, data: Buffer.alloc(1), headers: {} }) };
  await assert.rejects(() => adapter.headObject(key), error => error.code === 'SCF_CONTRACT');
});
test('SCF multipart completion uses only upload operations and preserves the upload identity', async () => {
  await save(); const session = await service.run(s => s.initUpload(ids.collection, ids.member, { ...metadata, fileSize: PART_BYTES + 22 }));
  const multipart = objects.multipart.get(session.target.multipartId); multipart.parts.set(1, Buffer.alloc(PART_BYTES)); multipart.parts.set(2, Buffer.alloc(22));
  const adapter = storageFactory(settings.environment()); await adapter.completeMultipart(session.target.key, session.target.multipartId, PART_BYTES + 22, PART_BYTES);
  assert.equal(objects.objects.get(session.target.key).fileSize, PART_BYTES + 22); assert.equal(objects.objects.get(session.target.key).uploadId, session.upload.id);
});
