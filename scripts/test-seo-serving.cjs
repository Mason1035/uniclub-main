const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const net = require('node:net');
const { execFileSync, spawn } = require('node:child_process');
const { once } = require('node:events');
const { updateSeoConfig, memberPath, publicPages } = require('../deploy/ecs/update-seo-nginx.cjs');
const { updateSocialUploadConfig } = require('../deploy/ecs/update-social-upload-nginx.cjs');
const { updatePerformanceConfig } = require('../deploy/ecs/update-performance-nginx.cjs');
const project = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(project, file), 'utf8');

for (const name of ['nginx.conf', 'nginx-https.conf']) {
  test(`${name}: repeatable SEO patch preserves existing transport and asset policy`, () => {
    const original = read(`deploy/ecs/${name}`);
    const updated = updateSeoConfig(original);
    assert.equal(updateSeoConfig(updated), updated);
    assert.equal(updated, original, 'Checked-in template must match its patcher output');
    for (const directive of ['ssl_certificate', 'listen', 'proxy_pass', 'proxy_read_timeout', 'proxy_buffering', 'client_max_body_size']) {
      const expression = new RegExp(`^[ \\t]*${directive}[^;]*;`, 'gm');
      assert.deepEqual(updated.match(expression), original.match(expression), directive);
    }
    assert.match(updated, /client_max_body_size 251m;/);
    assert.match(updated, /client_max_body_size 10m;/);
    assert.match(updated, /public, max-age=31536000, immutable/);
    assert.match(updated, /location \^~ \/\.well-known\/acme-challenge\//);
    assert.doesNotMatch(updated, /http_user_agent|OAI-SearchBot|GPTBot/);
    assert.equal(updateSeoConfig(updatePerformanceConfig(updateSocialUploadConfig(updated))), updated, 'Full activation patch pipeline must be repeatable');
  });
}

test('patch is bounded to ClassHub and fails closed on an unsupported template', () => {
  const other = 'server { listen 443 ssl; root /srv/other; location / { return 200; } }\n';
  const managed = read('deploy/ecs/nginx.conf');
  assert.ok(updateSeoConfig(other + managed).startsWith(other));
  assert.throws(() => updateSeoConfig(other), /frontend root not found/);
  assert.throws(() => updateSeoConfig('server {\nroot /opt/classhub/current/dist;\n}'), /SPA location not found/);
  assert.throws(() => updateSeoConfig('server {\nroot /opt/classhub/current/dist;\nlocation / {'), /Unbalanced/);
});

test('public manifest and declared private routes stay aligned without exposing member data', () => {
  const manifest = JSON.parse(read('shared/seo.json'));
  assert.deepEqual(manifest.publicPages.map(page => page.path).sort(), Object.keys(publicPages).sort());
  const routes = read('src/routeConfig.tsx');
  const declared = [...routes.matchAll(/<Route\s+path="(\/[^"]*)"/g)].map(([, route]) => route);
  for (const route of declared.filter(route => !publicPages[route] && route !== '*')) {
    const example = route.replace(':type', 'news').replace(':id', '1234567890abcdef12345678');
    assert.ok(memberPath.test(example), `Missing private route: ${route}`);
  }
  const adminDeclarations = routes.slice(routes.indexOf('path="/admin"'), routes.indexOf('{/* ---------------- Member-facing app'));
  for (const [, child] of adminDeclarations.matchAll(/<Route\s+path="([^/][^"]*)"/g)) {
    assert.ok(memberPath.test(`/admin/${child.replace(':id', '1234567890abcdef12345678')}`), `Missing private admin route: ${child}`);
  }
  for (const file of ['src/lib/routeState.ts', 'deploy/ecs/update-seo-nginx.cjs']) {
    assert.match(read(file), /news.*event.*resource.*social/, 'Comment type whitelist');
  }
  for (const route of ['/abc', '/news/not-exist-page', '/hello/world', '/admin/not-declared', '/comments/user/1234567890abcdef12345678']) {
    assert.equal(memberPath.test(route), false, route);
  }
});

test('Vercel routing keeps public HTML, private noindex, assets and actual 404 distinct', () => {
  const { routes } = JSON.parse(read('vercel.json'));
  // Vercel legacy routes.src is case-insensitive (official route reference).
  const resolve = value => routes.find(route => new RegExp(`^${route.src}$`, 'i').test(value));
  for (const [url, document] of Object.entries(publicPages)) {
    const route = resolve(url);
    assert.equal(route.dest, document);
    assert.equal(route.headers['X-Robots-Tag'], undefined);
  }
  for (const url of ['/auth', '/settings', '/admin/ai', '/Admin/AI', '/admin/events/1234567890abcdef12345678', '/events/1234567890abcdef12345678', '/NEWS', '/functions/random-call', '/news/1234567890abcdef12345678']) {
    const route = resolve(url);
    assert.equal(route.dest, '/app.html');
    assert.equal(route.headers['X-Robots-Tag'], 'noindex, nofollow, noarchive');
    assert.equal(route.headers['Cache-Control'], 'private, no-store');
  }
  assert.equal(resolve('/About').dest, '/about.html');
  assert.equal(resolve('/Privacy').dest, '/privacy.html');
  for (const url of ['/abc', '/news/not-exist-page', '/hello/world', '/app.html', '/404.html']) {
    const route = resolve(url);
    assert.equal(route.dest, '/404.html');
    assert.equal(route.status, 404);
  }
  assert.equal(resolve('/api/members').dest, 'uniclub-backend/index.js');
  assert.equal(resolve('/api/members').headers['Cache-Control'], 'private, no-store');
  assert.equal(resolve('/uploads/private-picture.png').headers['X-Robots-Tag'], 'noindex, nofollow, noarchive');
  assert.equal(resolve('/sitemap.xml').dest, '/sitemap.xml');
  assert.equal(resolve('/robots.txt').dest, '/robots.txt');
  assert.equal(resolve('/static/chunk.js').dest, '/$1');
});

async function freePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

let nginxAvailable = true;
try { execFileSync('nginx', ['-v'], { stdio: 'ignore' }); } catch { nginxAvailable = false; }

test('actual Nginx responses: public HTML, member shells, denied API, 404 and canonical redirects', { skip: !nginxAvailable }, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'classhub-seo-nginx-'));
  const staticDirectory = path.join(directory, 'dist');
  fs.mkdirSync(staticDirectory);
  for (const document of ['index.html', 'privacy.html', 'about.html', 'app.html', '404.html']) {
    fs.writeFileSync(path.join(staticDirectory, document), `<html><body>${document}</body></html>`);
  }
  fs.writeFileSync(path.join(staticDirectory, 'robots.txt'), 'User-agent: *\nDisallow: /api/\n');
  fs.writeFileSync(path.join(staticDirectory, 'sitemap.xml'), '<urlset/>');
  fs.mkdirSync(path.join(staticDirectory, 'static'));
  fs.writeFileSync(path.join(staticDirectory, 'static', 'chunk.js'), 'console.log("asset")');
  const api = http.createServer((request, response) => {
    response.writeHead(request.url.startsWith('/uploads/') ? 200 : 401, { 'Content-Type': 'text/plain' });
    response.end(request.url.startsWith('/uploads/') ? 'Existing media' : 'Authentication required');
  });
  api.listen(0, '127.0.0.1');
  await once(api, 'listening');
  const port = await freePort();
  const site = read('deploy/ecs/nginx.conf')
    .replace(/listen[^;]*;/g, '')
    .replace('server {', `server {\nlisten 127.0.0.1:${port};`)
    .replaceAll('/opt/classhub/current/dist', staticDirectory)
    .replaceAll('127.0.0.1:5050', `127.0.0.1:${api.address().port}`);
  const config = path.join(directory, 'nginx.conf');
  fs.writeFileSync(config, `pid ${directory}/nginx.pid;\nerror_log ${directory}/error.log;\nevents {}\nhttp {\naccess_log off;\ndefault_type text/html;\n${site}\n}\n`);
  let process;
  try {
    // Override the bootstrap log as well as the configured runtime log so
    // Nginx never attempts to open its installation-wide default error.log.
    const localOptions = ['-e', path.join(directory, 'error.log'), '-p', directory, '-c', config];
    execFileSync('nginx', ['-t', ...localOptions], { stdio: 'pipe' });
    process = spawn('nginx', [...localOptions, '-g', 'daemon off;'], { stdio: 'pipe' });
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) { ready = true; break; } } catch { /* A process startup probe, not runtime error suppression. */ }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.ok(ready, 'Temporary Nginx server must start');
    const get = url => fetch(`http://127.0.0.1:${port}${url}`, { redirect: 'manual' });
    for (const [url, document] of Object.entries(publicPages)) {
      const response = await get(url);
      assert.equal(response.status, 200, url);
      assert.ok((await response.text()).includes(document.slice(1)), url);
      assert.equal(response.headers.get('x-robots-tag'), null, url);
    }
    for (const url of ['/auth', '/settings', '/admin/ai', '/Admin/AI', '/admin/events/1234567890abcdef12345678', '/events/1234567890abcdef12345678', '/NEWS', '/social', '/functions/random-call', '/article/1234567890abcdef12345678']) {
      const response = await get(url);
      assert.equal(response.status, 200, url);
      assert.ok((await response.text()).includes('app.html'), url);
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive', url);
      assert.equal(response.headers.get('cache-control'), 'private, no-store', url);
    }
    for (const url of ['/abc', '/news/not-exist-page', '/hello/world', '/admin/not-declared', '/admin/events/not-an-id', '/events/not-an-id', '/app.html', '/404.html']) {
      const response = await get(url);
      assert.equal(response.status, 404, url);
      if (!url.endsWith('.html')) assert.ok((await response.text()).includes('404.html'), url);
    }
    const denied = await get('/api/members');
    assert.equal(denied.status, 401);
    assert.equal(denied.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
    assert.equal(denied.headers.get('cache-control'), 'private, no-store');
    const social = await get('/api/social/posts');
    assert.equal(social.status, 401);
    assert.equal(social.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
    const media = await get('/uploads/example.png');
    assert.equal(media.status, 200);
    assert.equal(media.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
    assert.equal(media.headers.get('cache-control'), null, 'Media cache policy must remain unchanged');
    const alias = await get('/privacy/?utm_source=test');
    assert.equal(alias.status, 308);
    assert.ok(alias.headers.get('location').endsWith('/privacy?utm_source=test'));
    for (const [variant, canonical] of [['/About', '/about'], ['/Privacy', '/privacy']]) {
      const response = await get(`${variant}?utm_source=test`);
      assert.equal(response.status, 308, variant);
      assert.ok(response.headers.get('location').endsWith(`${canonical}?utm_source=test`));
    }
    assert.equal((await get('/static/chunk.js')).status, 200);
    assert.equal((await get('/sitemap.xml')).headers.get('content-type'), 'application/xml');
    assert.equal((await get('/robots.txt')).status, 200);
    // A previous pre-SEO release remains usable after application rollback.
    fs.unlinkSync(path.join(staticDirectory, 'app.html'));
    const oldMemberShell = await get('/settings');
    assert.equal(oldMemberShell.status, 200);
    assert.ok((await oldMemberShell.text()).includes('index.html'));
    assert.equal(oldMemberShell.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  } finally {
    if (process) {
      process.kill('SIGTERM');
      await once(process, 'exit');
    }
    await new Promise(resolve => api.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
