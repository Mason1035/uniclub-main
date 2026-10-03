// Explicit integration check: npm test stays independent of MongoDB.
// Always uses and removes a freshly named isolated database, never uniclub.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');
const express = require('express');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');
const User = require('../models/User');
const FeeSettings = require('../models/FeeSettings');
const FeeSubmission = require('../models/FeeSubmission');
const initializeFees = require('../scripts/initializeFees');
process.env.JWT_SECRET = 'fees-isolated-mongo-check-only';
const { createFeesRouters } = require('../routes/feesRouter');

test('fees HTTP + real MongoDB Binary / atomic updates / unique constraints', async t => {
  const dbName = `classhub_fees_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  let server;
  try {
    await mongoose.connect(process.env.FEE_TEST_MONGO_URI || 'mongodb://127.0.0.1:27017', { dbName, autoIndex: false, serverSelectionTimeoutMS: 5000 });
    await initializeFees();
    const admin = await User.create({ name: 'Test administrator', uniqueId: 'ADMIN-fees-test', passwordHash: 'test-only-unusable-hash', isAdmin: true });
    const student = await User.create({ name: 'Test student', uniqueId: '9000000001', passwordHash: 'test-only-unusable-hash', isAdmin: false });
    const other = await User.create({ name: 'Other test student', uniqueId: '9000000002', passwordHash: 'test-only-unusable-hash', isAdmin: false });
    const app = express();
    app.use(express.json());
    const routers = createFeesRouters();
    app.use('/api/fees', routers.userRouter);
    app.use('/api/admin/fees', routers.adminRouter);
    server = await new Promise(resolve => { const started = app.listen(0, '127.0.0.1', () => resolve(started)); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const png = await sharp({ create: { width: 80, height: 40, channels: 3, background: '#007c99' } }).png().toBuffer();
    const form = (name = 'proof', remark) => {
      const body = new FormData(); if (remark !== undefined) body.append('remark', remark);
      body.append(name, new Blob([png], { type: 'image/png' }), 'fixture.png'); return body;
    };
    const request = async (method, path, account = student, body) => {
      const result = await fetch(origin + path, { method, headers: {
        Authorization: `Bearer ${jwt.sign({ userId: String(account._id), tokenVersion: 0 }, process.env.JWT_SECRET)}`,
        ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      }, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) });
      return { status: result.status, data: result.headers.get('content-type')?.startsWith('image/') ? Buffer.from(await result.arrayBuffer()) : await result.json() };
    };
    let submission;

    await t.test('initialization is additive and idempotent', async () => {
      const result = await initializeFees();
      assert.deepEqual(result, { settings: 1, submissions: 0, userUniqueIndex: true });
      assert.equal(await User.countDocuments(), 3);
    });
    await t.test('no QR / no submission reads work in a real database', async () => {
      assert.equal((await request('GET', '/api/fees/settings')).data.settings.hasPaymentQr, false);
      assert.equal((await request('GET', '/api/fees/me')).data.submission, null);
      assert.equal((await request('GET', '/api/fees/payment-qr')).status, 404);
    });
    await t.test('QR replacement keeps one BSON Binary row and metadata omits data', async () => {
      for (let i = 0; i < 3; i++) assert.equal((await request('PUT', '/api/admin/fees/payment-qr', admin, form('paymentQr'))).status, 200);
      assert.equal(await FeeSettings.countDocuments(), 1);
      const types = await FeeSettings.aggregate([{ $project: { type: { $type: '$paymentQrData' } } }]);
      assert.equal(types[0].type, 'binData');
      const metadata = await request('GET', '/api/fees/settings');
      assert.doesNotMatch(JSON.stringify(metadata.data), /paymentQrData|Buffer|base64/);
      assert.deepEqual(await sharp((await request('GET', '/api/fees/payment-qr')).data).raw().toBuffer(), await sharp(png).raw().toBuffer());
    });
    await t.test('12 simultaneous first submissions leave exactly one record', async () => {
      const responses = await Promise.all(Array.from({ length: 12 }, (_, i) => request('POST', '/api/fees/submissions', student, form('proof', `remark ${i}`))));
      assert.ok(responses.every(result => result.status === 200), JSON.stringify(responses.map(result => result.status)));
      assert.equal(await FeeSubmission.countDocuments({ user: student._id }), 1);
      assert.equal(new Set(responses.map(result => result.data.submission.id)).size, 1);
      submission = responses[0].data.submission;
    });
    await t.test('proof is BSON Binary and only its owner or verified admin can read it', async () => {
      const types = await FeeSubmission.aggregate([{ $project: { type: { $type: '$proofImageData' } } }]);
      assert.equal(types[0].type, 'binData');
      const path = `/api/fees/submissions/${submission.id}/proof`;
      assert.equal((await request('GET', path, other)).status, 404);
      assert.deepEqual(await sharp((await request('GET', path, student)).data).raw().toBuffer(), await sharp(png).raw().toBuffer());
      assert.deepEqual(await sharp((await request('GET', path, admin)).data).raw().toBuffer(), await sharp(png).raw().toBuffer());
    });
    await t.test('remark-only edit and screenshot replacement preserve record id/time', async () => {
      const remark = await request('PATCH', '/api/fees/submissions/me', student, { remark: '6-301寝室' });
      assert.equal(remark.status, 200);
      const image = await request('PATCH', '/api/fees/submissions/me', student, form());
      assert.equal(image.status, 200); assert.equal(image.data.submission.remark, '6-301寝室');
      assert.equal(image.data.submission.id, submission.id);
      assert.equal(image.data.submission.createdAt, submission.createdAt);
    });
    await t.test('admin list joins existing users and paginates metadata only', async () => {
      assert.equal((await request('POST', '/api/fees/submissions', other, form())).status, 200);
      const result = await request('GET', '/api/admin/fees/submissions?limit=1&page=2', admin);
      assert.equal(result.data.pagination.total, 2);
      assert.equal(result.data.submissions.length, 1);
      assert.ok(result.data.submissions[0].user.name);
      assert.doesNotMatch(JSON.stringify(result.data), /proofImageData|Buffer|base64/);
    });
    await t.test('simultaneous confirmations are idempotent and retain actor/time', async () => {
      const results = await Promise.all(Array.from({ length: 8 }, () => request('POST', `/api/admin/fees/submissions/${submission.id}/confirm`, admin)));
      assert.ok(results.every(result => result.status === 200));
      assert.equal(new Set(results.map(result => result.data.submission.confirmedAt)).size, 1);
      assert.ok(results.every(result => result.data.submission.confirmedBy.id === String(admin._id)));
    });
    await t.test('confirmed row rejects every student write without changing data', async () => {
      const before = await FeeSubmission.findById(submission.id).select('+proofImageData').lean();
      const results = await Promise.all([
        request('POST', '/api/fees/submissions', student, form()),
        request('PATCH', '/api/fees/submissions/me', student, { remark: 'forbidden' }),
        request('PATCH', '/api/fees/submissions/me', student, form()),
      ]);
      assert.deepEqual(results.map(result => result.status), [409, 409, 409]);
      const after = await FeeSubmission.findById(submission.id).select('+proofImageData').lean();
      assert.deepEqual(after, before);
    });
    await t.test('a real edit/confirm race leaves the record locked', async () => {
      const row = (await request('GET', '/api/fees/me', other)).data.submission;
      const results = await Promise.all([
        request('PATCH', '/api/fees/submissions/me', other, form('proof', 'racing edit')),
        request('POST', `/api/admin/fees/submissions/${row.id}/confirm`, admin),
      ]);
      assert.ok([200, 409].includes(results[0].status)); assert.equal(results[1].status, 200);
      assert.equal((await request('GET', '/api/fees/me', other)).data.submission.status, 'CONFIRMED');
      assert.equal((await request('PATCH', '/api/fees/submissions/me', other, { remark: 'late' })).status, 409);
    });
    await t.test('DB unique constraint rejects a direct duplicate user row', async () => {
      await assert.rejects(FeeSubmission.create({ user: student._id, proofImageData: png, proofImageMimeType: 'image/png', proofImageSize: png.length }), error => error.code === 11000);
    });
    await t.test('migration preserves existing QR and confirmed submissions', async () => {
      const before = await FeeSettings.findById('current').select('+paymentQrData').lean();
      const result = await initializeFees();
      assert.deepEqual(result, { settings: 1, submissions: 2, userUniqueIndex: true });
      assert.equal((await request('GET', '/api/fees/me')).data.submission.status, 'CONFIRMED');
      assert.equal((await request('GET', '/api/fees/settings')).data.settings.hasPaymentQr, true);
      assert.deepEqual(await FeeSettings.findById('current').select('+paymentQrData').lean(), before);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName && /^classhub_fees_test_/.test(dbName)) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
