const fs = require('node:fs');

// Five attachments at the existing 50 MiB per-file maximum, plus multipart
// overhead. Other endpoints retain their existing 10 MiB request limit.
const uploadLocation = String.raw`# BEGIN CLASSHUB SOCIAL UPLOAD
location ~ ^/api/social/posts(?:/|$) {
    client_max_body_size 251m;
    proxy_pass http://127.0.0.1:5050;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    proxy_buffering off;
}
# END CLASSHUB SOCIAL UPLOAD
`;

function updateSocialUploadConfig(config) {
  const withoutManagedBlock = config.replace(
    /^[ \t]*# BEGIN CLASSHUB SOCIAL UPLOAD\n[\s\S]*?^[ \t]*# END CLASSHUB SOCIAL UPLOAD\n\n?/gm,
    ''
  );
  let count = 0;
  const updated = withoutManagedBlock.replace(/^([ \t]*)location\s+\/api\/\s*\{/gm, (match, indent) => {
    count++;
    return uploadLocation.trimEnd().split('\n').map(line => indent + line).join('\n') + '\n\n' + match;
  });
  if (!count) throw new Error('ClassHub Nginx API location not found; configuration was not changed.');
  return updated;
}

if (require.main === module) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output || input === output) throw new Error('Supply separate input and candidate config paths.');
  fs.writeFileSync(output, updateSocialUploadConfig(fs.readFileSync(input, 'utf8')));
}

module.exports = { updateSocialUploadConfig };
