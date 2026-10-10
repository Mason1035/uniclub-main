const fs = require('node:fs');

// Keep this whitelist aligned with routeConfig.tsx / validContentParams. A
// database-valid ID still needs the existing authenticated API to resolve it.
const memberPathSource = String.raw`/(?:auth|settings|saved-posts|notifications|debug|news|announcements|events|social|functions(?:/random-call)?|quantification|fees|resources|admin(?:/(?:roster|members|events(?:/[a-fA-F0-9]{24})?|news|resources|gallery|notifications|ai|quantification|fees))?|(?:article|news|event|events|past-events|resource)/[a-fA-F0-9]{24}|comments/(?:news|event|resource|social)/[a-fA-F0-9]{24})/?`;
const memberPath = new RegExp(`^${memberPathSource}$`, 'i');
const publicPages = { '/': '/index.html', '/privacy': '/privacy.html', '/about': '/about.html' };

const securityHeaders = `add_header X-Content-Type-Options nosniff always;
add_header Referrer-Policy strict-origin-when-cross-origin always;`;
const privateHeaders = `add_header X-Robots-Tag "noindex, nofollow, noarchive" always;
add_header Cache-Control "private, no-store" always;
${securityHeaders}`;
const indent = (text, padding) => text.split('\n').map(line => padding + line).join('\n');

const seoLocations = `# BEGIN CLASSHUB SEO
# Only the anonymous public pages are rendered/indexable. No crawler-specific
# user-agent handling, credentials or member content are involved.
# Only return directives here: normalize mixed case before location lookup,
# which can itself be case-insensitive on development macOS filesystems.
if ($uri ~ "^/(?!privacy/?$)[pP][rR][iI][vV][aA][cC][yY]/?$") {
    return 308 /privacy$is_args$args;
}
if ($uri ~ "^/(?!about/?$)[aA][bB][oO][uU][tT]/?$") {
    return 308 /about$is_args$args;
}
location = / {
    try_files /index.html =404;
    add_header Cache-Control "no-cache";
    ${indent(securityHeaders, '    ').trimStart()}
}
location = /privacy {
    try_files /privacy.html /index.html =404;
    add_header Cache-Control "no-cache";
    ${indent(securityHeaders, '    ').trimStart()}
}
location = /about {
    try_files /about.html /index.html =404;
    add_header Cache-Control "no-cache";
    ${indent(securityHeaders, '    ').trimStart()}
}
location = /privacy/ { return 308 /privacy$is_args$args; }
location = /about/ { return 308 /about$is_args$args; }
location = /index.html {
    add_header Cache-Control "no-cache";
    return 308 /$is_args$args;
}
location = /privacy.html { return 308 /privacy$is_args$args; }
location = /about.html { return 308 /about$is_args$args; }
location = /app.html { internal; }
location = /404.html {
    internal;
    try_files /404.html /index.html =404;
    ${indent(privateHeaders, '    ').trimStart()}
}
location = /robots.txt {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=3600";
    ${indent(securityHeaders, '    ').trimStart()}
}
location = /sitemap.xml {
    default_type application/xml;
    try_files $uri =404;
    add_header Cache-Control "public, max-age=3600";
    ${indent(securityHeaders, '    ').trimStart()}
}
location ~* "^${memberPathSource}$" {
    # index.html is a safe compatibility fallback during activation/rollback
    # of a release built before the public-only prerender step existed.
    try_files /app.html /index.html =404;
    ${indent(privateHeaders, '    ').trimStart()}
}
location @classhub_not_found {
    error_page 404 =404 /404.html;
    return 404;
}
location / {
    # Existing static assets continue to work. Unknown app routes no longer
    # return the homepage with HTTP 200 (soft 404).
    try_files $uri @classhub_not_found;
}
# END CLASSHUB SEO`;

function blockEnd(config, start) {
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
  throw new Error('Unbalanced Nginx block; configuration was not changed.');
}

// Parse location braces rather than replacing a proxy block with a broad regex.
// Keep API streaming/upload settings and media cache semantics intact.
function updateLocations(block) {
  const locations = /^([ \t]*)location\s+([^\n]*?)\s*\{/gm;
  let match, cursor = 0, updated = '', fallbackFound = false;
  while ((match = locations.exec(block))) {
    const end = blockEnd(block, locations.lastIndex);
    let location = block.slice(match.index, end);
    const declaration = match[2].trim();
    const padding = match[1] + '    ';
    locations.lastIndex = end;
    if (declaration === '/' || declaration === '= /index.html') {
      if (declaration === '/') fallbackFound = true;
      // Remove the old SPA fallback; the managed block is inserted below.
      location = '';
    } else if (declaration === '/api/' || declaration.includes('/api/social/posts')) {
      location = location.replace(/^[ \t]*add_header (?:X-Robots-Tag|Cache-Control|X-Content-Type-Options|Referrer-Policy)\s+[^;]*;\n?/gm, '');
      location = location.replace('{', '{\n' + indent(privateHeaders, padding));
    } else if (declaration === '/uploads/') {
      location = location.replace(/^[ \t]*add_header (?:X-Robots-Tag|X-Content-Type-Options|Referrer-Policy)\s+[^;]*;\n?/gm, '');
      location = location.replace('{', '{\n' + indent(`add_header X-Robots-Tag "noindex, nofollow, noarchive" always;\n${securityHeaders}`, padding));
    }
    updated += block.slice(cursor, match.index) + location;
    cursor = end;
  }
  if (!fallbackFound) throw new Error('ClassHub SPA location not found; configuration was not changed.');
  return updated + block.slice(cursor);
}

function updateSeoConfig(config) {
  const servers = /\bserver\s*\{/g;
  let match, cursor = 0, updated = '', count = 0;
  while ((match = servers.exec(config))) {
    const end = blockEnd(config, servers.lastIndex);
    let block = config.slice(match.index, end);
    servers.lastIndex = end;
    if (/^\s*root\s+\/opt\/classhub\/current\/dist\s*;/m.test(block)) {
      count++;
      const managed = /^[ \t]*# BEGIN CLASSHUB SEO\n[\s\S]*?^[ \t]*# END CLASSHUB SEO\n?/gm;
      if (managed.test(block)) {
        // Restore one temporary fallback so the same structural update is
        // applied to both initial and previously managed configurations.
        block = block.replace(managed, '    location / { try_files $uri $uri/ /index.html; }\n');
      }
      block = updateLocations(block)
        .replace(/^([ \t]*)gzip_types\s+([^;]*);/m, (_, padding, types) => `${padding}gzip_types ${[...new Set(types.trim().split(/\s+/).concat(['text/plain', 'application/xml']))].join(' ')};`)
        .replace(/\s*\}$/, '\n\n' + indent(seoLocations, '    ') + '\n}');
      // Collapse only blank lines created where the legacy fallback was removed.
      block = block.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n');
    }
    updated += config.slice(cursor, match.index) + block;
    cursor = end;
  }
  if (!count) throw new Error('ClassHub frontend root not found; configuration was not changed.');
  return updated + config.slice(cursor);
}

if (require.main === module) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output || input === output) throw new Error('Supply separate input and candidate config paths.');
  fs.writeFileSync(output, updateSeoConfig(fs.readFileSync(input, 'utf8')));
}

module.exports = { updateSeoConfig, memberPathSource, memberPath, publicPages };
