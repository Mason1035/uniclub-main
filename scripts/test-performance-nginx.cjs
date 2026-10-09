const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { updatePerformanceConfig } = require('../deploy/ecs/update-performance-nginx.cjs');

for (const name of ['nginx.conf', 'nginx-https.conf']) {
  test(`${name}: bounded cache, TLS and API preservation, repeatable patch`, () => {
    const original = fs.readFileSync(path.join(__dirname, '../deploy/ecs', name), 'utf8');
    const updated = updatePerformanceConfig(original);
    assert.equal(updatePerformanceConfig(updated), updated);
    assert.match(updated, /gzip_comp_level 6;/);
    assert.match(updated, /max-age=31536000, immutable/);
    assert.match(updated, /fonts\/classhub\|branding/);
    assert.equal(updated.match(/ssl_certificate[^;]*;/g)?.join('\n'), original.match(/ssl_certificate[^;]*;/g)?.join('\n'));
    assert.equal(updated.match(/location \/api\/ \{[\s\S]*?\n    \}/g)?.join('\n'), original.match(/location \/api\/ \{[\s\S]*?\n    \}/g)?.join('\n'));
    assert.match(updated, /location = \/index.html \{\s*add_header Cache-Control "no-cache";/);
    if (name.includes('https')) assert.match(updated, /listen 443 ssl http2/);
  });
}

test('unrelated sites are unchanged; unsupported structures fail closed', () => {
  const unrelated = 'server { listen 443 ssl; root /some/other/site; }\n';
  const managed = fs.readFileSync(path.join(__dirname, '../deploy/ecs/nginx.conf'), 'utf8');
  assert.ok(updatePerformanceConfig(unrelated + managed).startsWith(unrelated));
  assert.throws(() => updatePerformanceConfig(unrelated), /root not found/);
  assert.throws(() => updatePerformanceConfig('server {\n root /opt/classhub/current/dist;\n}'), /gzip\/static location/);
});

test('HTTP/2 can be skipped when the server has no compiled module', () => {
  const original = fs.readFileSync(path.join(__dirname, '../deploy/ecs/nginx-https.conf'), 'utf8').replace(/ssl http2/g, 'ssl');
  const updated = updatePerformanceConfig(original, { http2: false });
  assert.doesNotMatch(updated, /listen[^;]*http2/);
  assert.match(updated, /gzip_comp_level 6;/);
});
