const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const FeeSettings = require('../models/FeeSettings');
const FeeSubmission = require('../models/FeeSubmission');
const { prepareImage, parseRemark, MAX_IMAGE_BYTES } = require('../utils/feeImage');
const FeeService = require('../services/FeeService');

process.env.JWT_SECRET = 'fees-regression-tests-only';
const admin = '111111111111111111111111';
const student = '222222222222222222222222';
const other = '333333333333333333333333';
const accounts = new Map([
  [admin, { _id: admin, isAdmin: true, tokenVersion: 0 }],
  [student, { _id: student, isAdmin: false, tokenVersion: 0 }],
  [other, { _id: other, isAdmin: false, tokenVersion: 0 }],
]);
const userPath = require.resolve('../models/User');
require.cache[userPath] = { id: userPath, filename: userPath, loaded: true, exports: {
  findById(id) { return { select: async () => accounts.get(String(id)) || null }; },
} };
const { isAdminUser } = require('../middleware/admin');
const { createFeesRouters } = require('../routes/feesRouter');

class MemoryRepository {
  constructor() { this.rows = new Map(); this.current = null; this.sequence = 10; this.binaryReads = 0; }
  async settings() { return this.current; }
  async qr() { return this.current; }
  async saveQr(image) { this.current = { _id: 'current', paymentQrData: image.data, paymentQrMimeType: image.mimeType, paymentQrSize: image.size, updatedAt: new Date() }; return this.current; }
  async mine(user) { return [...this.rows.values()].find(row => row.user === user) || null; }
  async submission(id) { return this.rows.get(id) || null; }
  async proof(id) { this.binaryReads++; return this.rows.get(id) || null; }
  async submit(user, update, create) {
    let row = [...this.rows.values()].find(item => item.user === user);
    if (row?.status === 'CONFIRMED' || (!row && !create)) return null;
    if (!row) {
      row = { _id: (++this.sequence).toString(16).padStart(24, '0'), user, status: 'SUBMITTED', createdAt: new Date() };
      this.rows.set(row._id, row);
    }
    Object.assign(row, update, { updatedAt: new Date() });
    return row;
  }
  async confirm(id, by, at) {
    const row = this.rows.get(id);
    if (row?.status === 'SUBMITTED') Object.assign(row, { status: 'CONFIRMED', confirmedBy: by, confirmedAt: at });
    return row || null;
  }
  async list({ status, skip, limit }) {
    const rows = [...this.rows.values()].filter(row => !status || row.status === status);
    return { items: rows.slice(skip, skip + limit), total: rows.length };
  }
}

let repository, service, server, origin;
let png;
const app = express();
app.use(express.json());
// Requests always traverse the real ClassHub JWT/admin middleware.
const delegated = new Proxy({}, { get: (_, name) => (...args) => service[name](...args) });
const routers = createFeesRouters(delegated);
app.use('/api/fees', routers.userRouter);
app.use('/api/admin/fees', routers.adminRouter);
before(async () => {
  png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#007c99' } }).png().toBuffer();
  server = await new Promise(resolve => { const started = app.listen(0, '127.0.0.1', () => resolve(started)); });
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); });
beforeEach(() => {
  repository = new MemoryRepository();
  service = new FeeService(repository, { isAdmin: isAdminUser });
});

const file = (buffer = png, mimetype = 'image/png') => ({ buffer, mimetype });
const multipart = (bytes = png, name = 'proof', type = 'image/png', remark) => {
  const form = new FormData();
  if (remark !== undefined) form.append('remark', remark);
  if (bytes) form.append(name, new Blob([bytes], { type }), 'image.png');
  return form;
};
async function request(method, path, user = student, body, claims = {}) {
  const response = await fetch(origin + path, {
    method,
    headers: { ...(user ? { Authorization: `Bearer ${jwt.sign({ userId: user, tokenVersion: 0, ...claims }, process.env.JWT_SECRET)}` } : {}),
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
  });
  const image = response.headers.get('content-type')?.startsWith('image/');
  return { status: response.status, headers: response.headers, body: image ? Buffer.from(await response.arrayBuffer()) : await response.json() };
}

for (const format of ['jpeg', 'png', 'webp']) test(`decodes real ${format}, normalizes to PNG Binary`, async () => {
  const buffer = await sharp(png).toFormat(format).toBuffer();
  const image = await prepareImage(file(buffer, `image/${format}`));
  assert.equal(image.mimeType, 'image/png');
  assert.equal(Buffer.isBuffer(image.data), true);
  assert.equal((await sharp(image.data).metadata()).format, 'png');
});
test('resizes without distortion and strips trailing payload', async () => {
  const wide = await sharp({ create: { width: 2500, height: 1250, channels: 3, background: '#fff' } }).png().toBuffer();
  const image = await prepareImage(file(Buffer.concat([wide, Buffer.from('not-image-script-payload')])));
  const meta = await sharp(image.data).metadata();
  assert.deepEqual([meta.width, meta.height], [1920, 960]);
  assert.equal(image.data.includes(Buffer.from('not-image-script-payload')), false);
});
for (const [label, bytes, type] of [
  ['PDF', Buffer.from('%PDF-1.7'), 'image/png'],
  ['ZIP', Buffer.from('PK\u0003\u0004'), 'image/jpeg'],
  ['SVG', Buffer.from('<svg><script/></svg>'), 'image/png'],
  ['fake PNG header', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'],
]) test(`rejects ${label} despite an image MIME`, async () => { await assert.rejects(prepareImage(file(bytes, type)), error => error.status === 400); });
test('rejects mismatched declared MIME, empty and oversized uploads', async () => {
  await assert.rejects(prepareImage(file(png, 'image/jpeg')), error => error.status === 400);
  await assert.rejects(prepareImage(file(Buffer.alloc(0))), error => error.status === 400);
  await assert.rejects(prepareImage(file(Buffer.alloc(MAX_IMAGE_BYTES + 1))), error => error.status === 413);
});
test('rejects oversized dimensions even for compressed small files', async () => {
  const buffer = await sharp({ create: { width: 8000, height: 6000, channels: 3, background: '#fff' } }).png().toBuffer();
  assert.ok(buffer.length < MAX_IMAGE_BYTES);
  await assert.rejects(prepareImage(file(buffer)), error => error.status === 400);
});
test('remarks reject overlength, arrays and forged protected fields', () => {
  assert.equal(parseRemark({ remark: ' 6-301寝室 ' }), '6-301寝室');
  assert.equal(parseRemark({ remark: '' }), '');
  for (const body of [{ remark: 'x'.repeat(201) }, { remark: ['x'] }, { status: 'CONFIRMED' }, { user: other }]) assert.throws(() => parseRemark(body));
});
test('schemas use private Buffer fields, two states and a unique user constraint', async () => {
  assert.equal(FeeSettings.schema.path('paymentQrData').instance, 'Buffer');
  assert.equal(FeeSubmission.schema.path('proofImageData').instance, 'Buffer');
  assert.equal(FeeSubmission.schema.path('proofImageData').options.select, false);
  assert.deepEqual(FeeSubmission.schema.path('status').enumValues, ['SUBMITTED', 'CONFIRMED']);
  assert.equal(FeeSubmission.schema.indexes().find(([, options]) => options.name === 'fee_user_unique')[1].unique, true);
  await assert.rejects(new FeeSubmission({ user: student, status: 'REJECTED' }).validate());
});
test('every user route requires a valid live login', async () => {
  for (const path of ['/settings', '/payment-qr', '/me', '/submissions/000000000000000000000011/proof']) assert.equal((await request('GET', '/api/fees' + path, null)).status, 401);
  assert.equal((await request('POST', '/api/fees/submissions', null, multipart())).status, 401);
  assert.equal((await request('GET', '/api/fees/me', student, undefined, { tokenVersion: 9 })).status, 401);
});
test('friendly empty metadata and QR 404', async () => {
  assert.deepEqual((await request('GET', '/api/fees/settings')).body.settings, { hasPaymentQr: false, updatedAt: null });
  assert.equal((await request('GET', '/api/fees/me')).body.submission, null);
  assert.equal((await request('GET', '/api/fees/payment-qr')).status, 404);
  assert.deepEqual((await request('GET', '/api/admin/fees/submissions', admin)).body.pagination, { page: 1, limit: 20, total: 0, pages: 1 });
});
test('ordinary users cannot list, change QR or confirm, including forged admin claims', async () => {
  for (const [method, path, body] of [
    ['GET', '/api/admin/fees/submissions'], ['PUT', '/api/admin/fees/payment-qr', multipart(png, 'paymentQr')],
    ['POST', '/api/admin/fees/submissions/000000000000000000000011/confirm'],
  ]) assert.equal((await request(method, path, student, body, { isAdmin: true, role: 'admin' })).status, 403);
  assert.equal(repository.current, null);
});
test('admin QR replacement stays a singleton and images have private binary headers', async () => {
  for (let i = 0; i < 2; i++) assert.equal((await request('PUT', '/api/admin/fees/payment-qr', admin, multipart(png, 'paymentQr'))).status, 200);
  assert.equal(repository.current._id, 'current');
  const response = await request('GET', '/api/fees/payment-qr');
  assert.equal(response.status, 200);
  assert.equal(Buffer.isBuffer(response.body), true);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.match(response.headers.get('vary'), /Authorization/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});
test('HTTP rejects missing proof, nonimages, oversized images, excessive fields', async () => {
  assert.equal((await request('POST', '/api/fees/submissions', student, multipart(null, 'proof', 'image/png', 'remark'))).status, 400);
  assert.equal((await request('POST', '/api/fees/submissions', student, multipart(Buffer.from('not an image')))).status, 400);
  assert.equal((await request('POST', '/api/fees/submissions', student, multipart(Buffer.alloc(MAX_IMAGE_BYTES + 1)))).status, 413);
  const form = multipart(); form.append('status', 'CONFIRMED');
  assert.equal((await request('POST', '/api/fees/submissions', student, form)).status, 400);
  assert.equal(repository.rows.size, 0);
});
test('submission needs no remark, pending re-submit updates same record and JSON has no image', async () => {
  const first = await request('POST', '/api/fees/submissions', student, multipart());
  assert.equal(first.status, 200); assert.equal(first.body.message, '缴费凭证提交成功');
  const next = await request('POST', '/api/fees/submissions', student, multipart(png, 'proof', 'image/png', '6-301寝室'));
  assert.equal(next.body.submission.id, first.body.submission.id);
  assert.equal(next.body.submission.remark, '6-301寝室');
  assert.equal(repository.rows.size, 1);
  assert.doesNotMatch(JSON.stringify(next.body), /proofImageData|Buffer|base64|paymentQrData/);
});
test('pending users can edit remark only, replace image only, and keep creation time', async () => {
  const first = (await request('POST', '/api/fees/submissions', student, multipart())).body.submission;
  const edit = await request('PATCH', '/api/fees/submissions/me', student, { remark: 'new remark' });
  assert.equal(edit.status, 200); assert.equal(edit.body.submission.remark, 'new remark');
  const replace = await request('PATCH', '/api/fees/submissions/me', student, multipart());
  assert.equal(replace.body.submission.createdAt, first.createdAt);
  assert.equal(replace.body.submission.remark, 'new remark');
  assert.equal((await request('PATCH', '/api/fees/submissions/me', student, {})).status, 400);
  assert.equal((await request('PATCH', '/api/fees/submissions/me', other, { remark: 'x' })).status, 404);
});
test('proof ownership prevents IDOR and avoids loading the other user image', async () => {
  const row = (await request('POST', '/api/fees/submissions', student, multipart())).body.submission;
  const path = `/api/fees/submissions/${row.id}/proof`;
  assert.equal((await request('GET', path, other)).status, 404);
  assert.equal(repository.binaryReads, 0);
  assert.equal((await request('GET', path, student)).status, 200);
  assert.equal((await request('GET', path, admin)).status, 200);
  assert.equal((await request('GET', '/api/fees/submissions/invalid/proof', student)).status, 404);
});
test('only explicit admin confirm changes status and repeat confirmation preserves actor/time', async () => {
  const row = (await request('POST', '/api/fees/submissions', student, multipart())).body.submission;
  const path = `/api/admin/fees/submissions/${row.id}/confirm`;
  const first = (await request('POST', path, admin)).body.submission;
  const repeat = (await request('POST', path, admin)).body.submission;
  assert.equal(first.status, 'CONFIRMED'); assert.equal(first.confirmedBy.id, admin);
  assert.equal(repeat.confirmedAt, first.confirmedAt);
  assert.equal((await request('PATCH', '/api/fees/submissions/me', student, { remark: 'changed' })).status, 409);
  assert.equal((await request('POST', '/api/fees/submissions', student, multipart())).status, 409);
  assert.equal(repository.rows.size, 1);
});
test('a confirmation racing image validation prevents a late write', async () => {
  const row = await service.submit(student, { remark: 'original' }, file(), true);
  let release;
  const blockedImage = new Promise(resolve => { release = resolve; });
  const editing = new FeeService(repository, { processImage: async () => { await blockedImage; return prepareImage(file()); } });
  const pending = editing.submit(student, { remark: 'late edit' }, file(), false);
  await service.confirm(row.id, admin);
  release();
  await assert.rejects(pending, error => error.status === 409);
  assert.equal((await service.mine(student)).remark, 'original');
});
test('admin list returns paged metadata with no binary and validates status', async () => {
  await service.submit(student, {}, file(), true); await service.submit(other, {}, file(), true);
  const result = await request('GET', '/api/admin/fees/submissions?limit=1&page=2', admin);
  assert.equal(result.body.submissions.length, 1); assert.equal(result.body.pagination.total, 2);
  assert.doesNotMatch(JSON.stringify(result.body), /proofImageData|Buffer|base64/);
  assert.equal((await request('GET', '/api/admin/fees/submissions?status=INVALID', admin)).status, 400);
});
