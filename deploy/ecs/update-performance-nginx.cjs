const fs = require('node:fs');

const cacheLocation = String.raw`# BEGIN CLASSHUB PERFORMANCE
location ~ "^/(?:fonts/classhub|branding)/[^/]+[.-][a-f0-9]{10}\.(?:woff2|webp|png|css|js)$" {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000, immutable";
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
}
# END CLASSHUB PERFORMANCE`;

// Work only inside ClassHub static-serving server blocks. Respect quoted regex
// braces and comments so TLS/redirect/other sites remain byte-for-byte intact.
function serverEnd(config, start) {
  let depth = 1, quote = '', comment = false;
  for (let i = start; i < config.length; i++) {
    const character = config[i];
    if (comment) { if (character === '\n') comment = false; continue; }
    if (character === '\\') { i++; continue; }
    if (quote) { if (character === quote) quote = ''; continue; }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === '#') { comment = true; continue; }
    if (character === '{') depth++;
    if (character === '}' && --depth === 0) return i + 1;
  }
  throw new Error('Unbalanced Nginx server block; configuration was not changed.');
}

function updatePerformanceConfig(config, { http2 = true } = {}) {
  const servers = /\bserver\s*\{/g;
  let match, cursor = 0, updated = '', count = 0;
  while ((match = servers.exec(config))) {
    const end = serverEnd(config, servers.lastIndex);
    let block = config.slice(match.index, end);
    servers.lastIndex = end;
    if (/^\s*root\s+\/opt\/classhub\/current\/dist\s*;/m.test(block)) {
      if (!/^\s*gzip\s+on\s*;/m.test(block) || !/^\s*location\s+\/static\/\s*\{/m.test(block)) {
        throw new Error('ClassHub gzip/static location not found; configuration was not changed.');
      }
      count++;
      block = block.replace(/^[ \t]*# BEGIN CLASSHUB PERFORMANCE\n[\s\S]*?^[ \t]*# END CLASSHUB PERFORMANCE\n\n?/gm, '')
        .replace(/^[ \t]*gzip_comp_level\s+\d+\s*;\n?/gm, '')
        .replace(/^[ \t]*gzip_vary\s+(?:on|off)\s*;\n?/gm, '')
        .replace(/^([ \t]*)gzip\s+on\s*;/m, '$&\n$1gzip_comp_level 6;\n$1gzip_vary on;')
        .replace(/^([ \t]*)location\s+\/static\/\s*\{/m, (location, indent) => cacheLocation.split('\n').map(line => indent + line).join('\n') + '\n\n' + location);
      if (http2 && !/^\s*http2\s+on\s*;/m.test(block)) {
        block = block.replace(/^([ \t]*listen\s+[^;]*\bssl\b)([^;]*;)/gm, (line, before, after) => /\bhttp2\b/.test(line) ? line : `${before} http2${after}`);
      }
    }
    updated += config.slice(cursor, match.index) + block;
    cursor = end;
  }
  if (!count) throw new Error('ClassHub frontend root not found; configuration was not changed.');
  return updated + config.slice(cursor);
}

if (require.main === module) {
  const [input, output, option] = process.argv.slice(2);
  if (!input || !output || input === output) throw new Error('Supply separate input and candidate config paths.');
  fs.writeFileSync(output, updatePerformanceConfig(fs.readFileSync(input, 'utf8'), { http2: option !== '--no-http2' }));
}

module.exports = { updatePerformanceConfig };
