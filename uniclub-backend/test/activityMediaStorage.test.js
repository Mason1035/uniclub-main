const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const COS = require('cos-nodejs-sdk-v5');
const Storage = require('../services/storage/ActivityMediaStorage');
const { createApp } = require('../cloud-functions/quantification/download/src/app');
const { safeMediaKey, validateUpload, verifyImage, MAX_IMAGE_BYTES } = require('../utils/activityMediaPolicy');
const key = 'activity/aaaaaaaaaaaaaaaaaaaaaaaa/photos/bbbbbbbbbbbbbbbbbbbbbbbb.png';
const thumbnailKey = 'activity/aaaaaaaaaaaaaaaaaaaaaaaa/photos/bbbbbbbbbbbbbbbbbbbbbbbb-thumb.webp';
const secret = 'isolated-test-service-secret-32-bytes';
const env = { OBJECT_STORAGE_PROVIDER: 'scf', COS_BUCKET: 'isolated-media-1234567890', COS_REGION: 'ap-guangzhou', COS_ENDPOINT: 'https://isolated-media-1234567890.cos.ap-guangzhou.myqcloud.com', SCF_TOKEN_ENDPOINT: 'https://isolated-token.ap-guangzhou.tencentscf.com', SCF_FUNCTION_URL: 'https://isolated-download.ap-guangzhou.tencentscf.com', CLASSHUB_SCF_AUTH_SECRET: secret };

test('activity path and metadata validators reject other prefixes, traversal and unsupported formats', () => {
  assert.ok(safeMediaKey(key)); assert.ok(safeMediaKey(thumbnailKey));
  for (const invalid of ['quantification/file.zip', key.replace('/photos/', '/staging/'), key.replace('.png', '.svg'), key.replace('activity/', 'activity/_test/'), key.replace('/photos/', '/../')]) assert.equal(safeMediaKey(invalid), false);
  const input = { mediaType: 'PHOTO', filename: '班级照片.png', mimeType: 'image/png', size: 100 };
  assert.equal(validateUpload(input).fileSize, 100);
  for (const patch of [{ mimeType: 'image/heic' }, { size: MAX_IMAGE_BYTES + 1 }, { size: '100' }, { filename: '../image.png' }, { objectKey: 'arbitrary' }]) assert.throws(() => validateUpload({ ...input, ...patch }), error => error.status === 400);
});
test('real sharp validates JPEG PNG WebP, creates small WebP thumbnails and rejects fake signatures', async () => {
  for (const [format, mime] of [['png', 'image/png'], ['jpeg', 'image/jpeg'], ['webp', 'image/webp']]) {
    const bytes = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#125e6b' } }).toFormat(format).toBuffer();
    const image = await verifyImage(bytes, mime); assert.equal(image.width, 800); const thumb = await sharp(image.thumbnail).metadata(); assert.equal(thumb.format, 'webp'); assert.equal(thumb.width, 640); assert.equal(thumb.height, 480);
    await assert.rejects(verifyImage(bytes, mime === 'image/png' ? 'image/jpeg' : 'image/png'), error => error.code === 'INVALID_IMAGE');
  }
  await assert.rejects(verifyImage(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]), 'image/png'), error => error.code === 'INVALID_IMAGE');
});
test('activity storage refuses missing service auth and old SCF contract, without returning role credentials', async () => {
  assert.equal(new Storage({ ...env, CLASSHUB_SCF_AUTH_SECRET: '' }).describe().configured, false);
  const adapter = new Storage(env, { http: { get: async () => ({ data: { success: true, bucket: env.COS_BUCKET, region: env.COS_REGION, credentials: { TmpSecretId: 'test-temp-id', TmpSecretKey: 'test-temp-key', Token: 'test-token' } } }) } });
  await assert.rejects(adapter.authorizeImage(key, 'image/png', 'bbbbbbbbbbbbbbbbbbbbbbbb', 100), error => error.code === 'ACTIVITY_SCF_UPGRADE_REQUIRED');
});
test('secured SCF headers stay server-side; actual SDK signs exact private no-overwrite image PUT for five minutes', async () => {
  const calls = [];
  const adapter = new Storage(env, { http: { get: async (url, options) => { calls.push({ url, options }); return { data: { success: true, secured: true, business: 'activity', bucket: env.COS_BUCKET, region: env.COS_REGION, credentials: { TmpSecretId: 'test-temp-id', TmpSecretKey: 'test-temp-key', Token: 'test-token' } } }; } } });
  const result = await adapter.authorizeImage(key, 'image/png', 'bbbbbbbbbbbbbbbbbbbbbbbb', 100); const url = new URL(result.url);
  assert.equal(calls[0].options.headers['X-ClassHub-Service-Auth'], secret); assert.equal(calls[0].options.params.business, 'activity'); assert.equal(calls[0].options.params.prefix, 'activity/');
  assert.equal(url.origin, env.COS_ENDPOINT); assert.equal(decodeURIComponent(url.pathname), '/' + key); assert.ok(url.searchParams.has('q-signature'));
  const times = url.searchParams.get('q-key-time').split(';').map(Number); assert.equal(times[1] - times[0], 300);
  assert.ok(url.searchParams.get('q-header-list').split(';').includes('content-length'));
  assert.deepEqual(result.headers, { 'Content-Type': 'image/png', 'x-cos-acl': 'private', 'x-cos-forbid-overwrite': 'true', 'x-cos-meta-classhub-upload': 'bbbbbbbbbbbbbbbbbbbbbbbb' });
  // q-ak and the runtime session token are part of an exact-method/key COS
  // signature. The signing SecretKey and the SCF service secret never leave.
  assert.doesNotMatch(JSON.stringify(result), /test-temp-key|isolated-test-service-secret|SecretId|SecretKey/);
  assert.throws(() => adapter.params('quantification/file.zip'), error => error.code === 'INVALID_MEDIA_KEY');
});
test('download SCF protects activity reads, fixes resources, refuses listing and preserves authenticated ZIP compatibility', async () => {
  const calls = [];
  class FakeCos extends COS {
    headObject(params, callback) { calls.push(['head', params]); callback(null, {}); }
    getBucket(params, callback) { calls.push(['list', params]); callback(null, { Contents: [] }); }
  }
  const app = createApp({ env: { ...env, TENCENTCLOUD_SECRETID: 'test-temp-id', TENCENTCLOUD_SECRETKEY: 'test-temp-key', TENCENTCLOUD_SESSIONTOKEN: 'test-token' }, Cos: FakeCos });
  const server = await new Promise(resolve => { const started = app.listen(0, '127.0.0.1', () => resolve(started)); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const params = { bucket: env.COS_BUCKET, region: env.COS_REGION, prefix: 'activity/', business: 'activity', key };
  const get = (path, query = params, auth = secret) => fetch(`${origin}${path}?${new URLSearchParams(query)}`, { headers: auth ? { 'X-ClassHub-Service-Auth': auth } : {} });
  try {
    assert.equal((await get('/download', params, '')).status, 403); assert.equal((await get('/download', params, 'wrong')).status, 403); assert.equal(calls.length, 0);
    const response = await get('/download'); const body = await response.json(); assert.equal(response.status, 200); assert.equal(body.secured, true); assert.equal(body.business, 'activity'); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(new URL(body.url).searchParams.get('response-content-disposition'), 'inline');
    for (const patch of [{ bucket: 'other-media-1234567890' }, { region: 'ap-beijing' }, { key: key.replace('photos', '../photos') }, { key: 'quantification/file.zip' }]) assert.ok([400, 403].includes((await get('/download', { ...params, ...patch })).status));
    assert.equal((await get('/list')).status, 400);
    assert.equal((await get('/list', { bucket: env.COS_BUCKET, region: env.COS_REGION, prefix: 'quantification/' })).status, 200);
    assert.equal((await get('/download', { bucket: env.COS_BUCKET, region: env.COS_REGION, prefix: 'quantification/', key: 'quantification/历史材料.zip' })).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('legacy open download SCF explicitly refuses activity image reads', async () => {
  const server = await new Promise(resolve => { const started = createApp({ env: {} }).listen(0, '127.0.0.1', () => resolve(started)); });
  try {
    const url = `http://127.0.0.1:${server.address().port}/download?${new URLSearchParams({ bucket: env.COS_BUCKET, region: env.COS_REGION, prefix: 'activity/', business: 'activity', key })}`;
    assert.equal((await fetch(url)).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
