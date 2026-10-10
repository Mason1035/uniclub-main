import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const site = JSON.parse(fs.readFileSync('shared/seo.json', 'utf8'));
const branding = JSON.parse(fs.readFileSync('src/lib/branding.json', 'utf8'));
const source = fs.readFileSync('src/lib/seo.ts', 'utf8')
  .replace(/import site from [^;]+;/, `const site = ${JSON.stringify(site)};`)
  .replace(/import branding from [^;]+;/, `const branding = ${JSON.stringify(branding)};`);
const module = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { pageMetadata, jsonLdText } = await import(`data:text/javascript;base64,${Buffer.from(module).toString('base64')}`);
const read = file => fs.readFileSync(`dist/${file}`, 'utf8');

test('only reviewed public paths get canonical/structured data; private and error paths fail closed', () => {
  for (const path of ['/auth', '/admin/ai', '/settings', '/news', '/article/0123456789abcdef01234567', '/api/users', '/__unknown__']) {
    const meta = pageMetadata(path);
    assert.match(meta.robots, /noindex/); assert.equal(meta.canonical, null); assert.equal(meta.structuredData, null); assert.equal(meta.image, null);
  }
  for (const page of site.publicPages) {
    assert.equal(pageMetadata(page.path).canonical, site.origin + page.path);
    assert.equal(pageMetadata(page.path === '/' ? '/' : page.path + '/').canonical, site.origin + page.path);
    assert.equal(pageMetadata(page.path.toUpperCase()).canonical, site.origin + page.path);
    assert.equal(pageMetadata(page.path, true).canonical, null);
  }
  assert.equal(JSON.parse(jsonLdText({ x: '</script><script>' })).x, '</script><script>');
  assert.ok(!jsonLdText({ x: '</script>' }).includes('<'));
});

test('public build contains real guest HTML and one coherent metadata set without credentials', () => {
  for (const page of site.publicPages) {
    const html = read(page.file);
    const head = html.split('</head>')[0];
    const body = html.split('<div id="root">')[1];
    assert.ok(body?.includes('masthead-brand')); assert.ok(body?.includes('footer-links'));
    assert.equal((head.match(/rel="canonical"/g) || []).length, 1);
    assert.ok(head.includes(`href="${site.origin + page.path}"`));
    assert.equal((head.match(/name="description"/g) || []).length, 1);
    assert.equal((head.match(/name="robots"/g) || []).length, 1);
    assert.match(head, /property="og:description"/); assert.match(head, /property="og:image"/);
    assert.equal((body.match(/<h1\b/g) || []).length, 1);
    assert.doesNotMatch(body, /<noscript>/, 'Crawlable copy must not be restricted to noscript');
    assert.doesNotMatch(body, /passwordHash|tokenVersion|authToken|uniqueId|Bearer /);
    for (const match of html.matchAll(/(?:src|href)="(\/(?:static|branding|fonts)\/[^"?]+)"/g)) {
      assert.ok(fs.existsSync(`dist${match[1]}`), `Missing built asset ${match[1]}`);
    }
    for (const match of head.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)) {
      const data = JSON.parse(match[1]);
      assert.equal(data.name, 'ClassHub'); assert.doesNotMatch(match[1], /aggregateRating|reviewCount|Organization|Person|SearchAction/);
    }
  }
  assert.match(read('index.html'), /班级重要消息，集中在这里/);
  assert.match(read('about.html'), /如何开始使用/);
  assert.match(read('privacy.html'), /账号与必要存储/);
});

test('private shell and static 404 do not inherit home metadata or public JSON-LD', () => {
  for (const file of ['app.html', '404.html']) {
    const html = read(file);
    assert.match(html, /name="robots" content="noindex/);
    assert.doesNotMatch(html, /rel="canonical"|application\/ld\+json|og:url/);
  }
  assert.match(read('404.html'), /Page Not Found/);
  assert.doesNotMatch(read('app.html'), /关于 ClassHub|班级重要消息，集中在这里/);
});

test('sitemap contains only real public canonical URLs and no fabricated lastmod', () => {
  const xml = read('sitemap.xml');
  assert.match(xml, /xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9"/);
  assert.deepEqual([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]), site.publicPages.map(page => site.origin + page.path));
  assert.doesNotMatch(xml, /lastmod|\/auth|\/admin|\/api|\/news|\/social|\/fees/);
});

test('OAI-SearchBot shares a narrow public allowlist; no new training-specific policy', () => {
  const robots = read('robots.txt');
  assert.match(robots, /^User-agent: OAI-SearchBot$/m);
  assert.match(robots, /^Disallow: \/$/m);
  assert.doesNotMatch(robots, /^User-agent: (?:GPTBot|Google-Extended|CCBot|ClaudeBot)$/m);
  const rules = [...robots.matchAll(/^(Allow|Disallow): (.+)$/gm)].map(([, action, pattern]) => ({ action, pattern }));
  const allowed = url => {
    const matching = rules.filter(rule => new RegExp('^' + rule.pattern.replace(/[.]/g, '\\.') .replace(/\?/g, '\\?')).test(url));
    matching.sort((a, b) => b.pattern.replace(/\$$/, '').length - a.pattern.replace(/\$$/, '').length || (a.action === 'Allow' ? -1 : 1));
    return matching[0]?.action === 'Allow';
  };
  for (const url of ['/', '/?utm_source=search', '/about', '/privacy', '/about?ref=ai', '/static/app.js', '/branding/logo.png', '/fonts/test.woff2', '/sitemap.xml']) assert.ok(allowed(url), url);
  for (const url of ['/admin', '/api/users', '/news', '/social', '/privacy-secret', '/about/private', '/uploads/photo.jpg', '/fees', '/notifications']) assert.equal(allowed(url), false, url);
});
