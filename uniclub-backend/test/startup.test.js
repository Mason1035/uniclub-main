const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const backend = path.resolve(__dirname, '..');
const root = path.resolve(backend, '..');

test('production startup listens and serves health after the database is ready', { timeout: 15000 }, async () => {
  const child = spawn(process.execPath, ['-r', path.join(__dirname, 'fixtures/startup-preload.cjs'), 'index.js'], {
    cwd: backend,
    env: { ...process.env, NODE_ENV: 'production', VERCEL: '', PORT: '0',
      JWT_SECRET: 'startup-test-secret-not-for-production', MONGODB_URI: 'mongodb://127.0.0.1:1/test-no-live-database' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  const exit = new Promise((resolve) => child.once('exit', resolve));
  try {
    const port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Startup timed out: ' + logs)), 10000);
      child.stderr.on('data', (chunk) => { logs += chunk; });
      child.stdout.on('data', (chunk) => {
        logs += chunk;
        const match = logs.match(/Backend API running at: http:\/\/localhost:(\d+)/);
        if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
      });
      child.once('error', (err) => { clearTimeout(timeout); reject(err); });
      child.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Early exit ${code}: ${logs}`)); });
    });
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200);
    assert.ok(logs.indexOf('Connected to MongoDB') < logs.indexOf('Backend API running'));
  } finally {
    child.kill('SIGTERM');
    await exit;
  }
});

test('development wrapper uses the proxy port and respects explicit PORT', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'uniclub-startup-'));
  try {
    const output = path.join(temp, 'spawn.json');
    const executable = path.join(temp, 'npm');
    fs.writeFileSync(executable, `#!${process.execPath}\nrequire('node:fs').writeFileSync(process.env.STARTUP_CAPTURE, JSON.stringify({ port: process.env.PORT, cwd: process.cwd(), args: process.argv.slice(2) }));\n`, { mode: 0o700 });
    for (const [port, expected] of [['', '6067'], ['6070', '6070']]) {
      const result = spawnSync(process.execPath, ['scripts/start-backend.js'], {
        cwd: root, encoding: 'utf8',
        env: { ...process.env, PATH: temp + path.delimiter + process.env.PATH,
          VITE_API_PROXY_TARGET: 'http://localhost:6067', PORT: port, STARTUP_CAPTURE: output },
      });
      assert.equal(result.status, 0, result.stderr);
      const captured = JSON.parse(fs.readFileSync(output, 'utf8'));
      assert.equal(captured.port, expected); assert.equal(captured.cwd, backend);
      assert.deepEqual(captured.args, ['run', 'dev']);
    }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('MongoDB startup script runs as ESM and binds only to loopback', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'uniclub-mongo-'));
  try {
    const executable = path.join(temp, 'mongod');
    const output = path.join(temp, 'args.json');
    fs.writeFileSync(executable, `#!${process.execPath}\nrequire('node:fs').writeFileSync(process.env.STARTUP_CAPTURE, JSON.stringify(process.argv.slice(2)));\n`, { mode: 0o700 });
    const result = spawnSync(process.execPath, ['scripts/start-mongo.js'], {
      cwd: root, encoding: 'utf8', env: { ...process.env, MONGOD_BIN: executable,
        MONGODB_DBPATH: path.join(temp, 'data'), MONGODB_PORT: '27123', STARTUP_CAPTURE: output },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), [
      '--dbpath', path.join(temp, 'data'), '--bind_ip', '127.0.0.1', '--port', '27123',
    ]);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
