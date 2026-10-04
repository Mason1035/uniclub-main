const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { createSocialUpload } = require('../middleware/socialUpload');
const { updateSocialUploadConfig } = require('../../deploy/ecs/update-social-upload-nginx.cjs');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'classhub-upload-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function receive(upload, files = []) {
  const boundary = 'classhub-isolated-upload-test';
  const chunks = [Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="content"\r\n\r\n班级近况\r\n`)];
  for (const file of files) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="photo.png"\r\nContent-Type: ${file.type || 'image/png'}\r\n\r\n`));
    chunks.push(file.bytes || Buffer.from('isolated-file-fixture'));
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(chunks);
  const req = Readable.from([body]);
  req.headers = { 'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': String(body.length) };
  return new Promise((resolve, reject) => {
    req.on('error', reject);
    const res = {
      status(status) { this.statusCode = status; return this; },
      json(data) { resolve({ req, status: this.statusCode, data }); }
    };
    upload(req, res, error => error ? reject(error) : resolve({ req, status: 200 }));
  });
}

test('production multipart upload creates a missing social directory and writes the attachment', async t => {
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  t.after(() => previousEnv === undefined ? delete process.env.NODE_ENV : process.env.NODE_ENV = previousEnv);
  const uploadsDir = path.join(fixture(t), 'uploads/social');
  const bytes = Buffer.from('production image fixture');
  const result = await receive(createSocialUpload({ uploadsDir }), [{ bytes }]);
  assert.equal(result.status, 200);
  assert.equal(result.req.body.content, '班级近况');
  assert.equal(result.req.files.length, 1);
  assert.deepEqual(fs.readFileSync(result.req.files[0].path), bytes);
});

test('upload follows the release symlink into persistent shared storage', async t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, 'shared/uploads'), { recursive: true });
  fs.mkdirSync(path.join(root, 'release/public'), { recursive: true });
  fs.symlinkSync(path.join(root, 'shared/uploads'), path.join(root, 'release/public/uploads'));
  const uploadsDir = path.join(root, 'release/public/uploads/social');
  const upload = createSocialUpload({ uploadsDir });
  const result = await receive(upload, [{}, {}]);
  assert.equal(result.status, 200);
  assert.equal(fs.readdirSync(path.join(root, 'shared/uploads/social')).length, 2);
  // A subsequent request keeps existing files instead of recreating storage.
  assert.equal((await receive(upload, [{}])).status, 200);
  assert.equal(fs.readdirSync(path.join(root, 'shared/uploads/social')).length, 3);
});

test('text posts do not require a writable media directory', async t => {
  const blocked = path.join(fixture(t), 'not-a-directory');
  fs.writeFileSync(blocked, 'fixture');
  const result = await receive(createSocialUpload({ uploadsDir: path.join(blocked, 'social') }));
  assert.equal(result.status, 200);
  assert.equal(result.req.files.length, 0);
});

test('storage failure returns actionable JSON without leaking filesystem paths', async t => {
  const blocked = path.join(fixture(t), 'not-a-directory');
  fs.writeFileSync(blocked, 'fixture');
  const result = await receive(createSocialUpload({ uploadsDir: path.join(blocked, 'social') }), [{}]);
  assert.equal(result.status, 500);
  assert.equal(result.data.code, 'UPLOAD_STORAGE_UNAVAILABLE');
  assert.ok(!JSON.stringify(result.data).includes(blocked));
});

test('unwritable storage fails safely before publishing', async t => {
  if (process.getuid?.() === 0) return t.skip('root bypasses Unix directory write permissions');
  const root = fixture(t);
  const uploadsDir = path.join(root, 'social');
  fs.mkdirSync(uploadsDir, { mode: 0o500 });
  try {
    const result = await receive(createSocialUpload({ uploadsDir }), [{}]);
    assert.equal(result.status, 500);
    assert.equal(result.data.code, 'UPLOAD_STORAGE_UNAVAILABLE');
    assert.equal(fs.readdirSync(uploadsDir).length, 0);
  } finally {
    fs.chmodSync(uploadsDir, 0o700);
  }
});

test('oversized file is rejected and its partial upload is removed', async t => {
  const uploadsDir = path.join(fixture(t), 'social');
  const result = await receive(createSocialUpload({ uploadsDir, maxFileSize: 16 }), [{ bytes: Buffer.alloc(32) }]);
  assert.equal(result.status, 413);
  assert.equal(result.data.code, 'FILE_TOO_LARGE');
  assert.equal(fs.readdirSync(uploadsDir).length, 0);
});

test('unsupported attachments and excessive file counts do not reach publishing', async t => {
  const uploadsDir = path.join(fixture(t), 'social');
  const upload = createSocialUpload({ uploadsDir });
  const invalid = await receive(upload, [{ type: 'text/html' }]);
  assert.equal(invalid.status, 400);
  assert.equal(invalid.data.code, 'INVALID_FILE_TYPE');
  const excessive = await receive(upload, Array.from({ length: 6 }, () => ({})));
  assert.equal(excessive.status, 400);
  assert.equal(excessive.data.code, 'TOO_MANY_FILES');
  assert.equal(fs.readdirSync(uploadsDir).length, 0);
});

test('Nginx patch is repeatable, scoped to social posts and preserves existing site settings', () => {
  const original = `server {\n    listen 443 ssl;\n    ssl_certificate /original/cert.pem;\n    client_max_body_size 10m;\n    location /api/ {\n        proxy_pass http://127.0.0.1:5050;\n    }\n}\n`;
  const updated = updateSocialUploadConfig(original);
  assert.equal(updateSocialUploadConfig(updated), updated);
  assert.ok(updated.includes('ssl_certificate /original/cert.pem;'));
  assert.ok(updated.includes('client_max_body_size 10m;'));
  assert.ok(updated.includes('client_max_body_size 251m;'));
  const route = new RegExp('^/api/social/posts(?:/|$)');
  assert.ok(route.test('/api/social/posts'));
  assert.ok(route.test('/api/social/posts/123'));
  assert.ok(!route.test('/api/social/posts-other'));
  assert.ok(!route.test('/api/auth/login'));
  assert.throws(() => updateSocialUploadConfig('server { listen 80; }'), /not found/);
});

test('HTTP and HTTPS templates contain the same repeatable upload configuration', () => {
  for (const file of ['nginx.conf', 'nginx-https.conf']) {
    const config = fs.readFileSync(path.join(__dirname, '../../deploy/ecs', file), 'utf8');
    assert.equal(updateSocialUploadConfig(config), config);
  }
});
