#!/usr/bin/env node
// Re-encode the approved artwork, without changing its crop, color or alpha.
// Sharp is already a backend dependency; no browser image library is needed.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const sharp = require('../uniclub-backend/node_modules/sharp');

const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'public/branding');

async function asset(source, name, width, format) {
  const image = sharp(path.join(directory, source)).resize({ width });
  const buffer = await (format === 'webp'
    ? image.webp({ lossless: true, effort: 6 })
    : image.png({ compressionLevel: 9 })).toBuffer();
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 10);
  const file = `${name}-${width}-${hash}.${format}`;
  await fs.writeFile(path.join(directory, file), buffer);
  return { src: `/branding/${file}`, width, bytes: buffer.length };
}

async function main() {
  const logo = [];
  for (const width of [192, 384, 576, 960]) {
    logo.push(await asset('classhub-logo-v2.png', 'classhub-logo', width, 'webp'));
  }
  const mark = [];
  for (const width of [28, 56, 84]) {
    mark.push(await asset('classhub-icon-192-v2.png', 'classhub-mark', width, 'webp'));
  }
  const manifest = {
    logo,
    logoFallback: await asset('classhub-logo-v2.png', 'classhub-logo', 576, 'png'),
    mark,
    markFallback: await asset('classhub-icon-192-v2.png', 'classhub-mark', 84, 'png'),
  };
  await fs.writeFile(path.join(root, 'src/lib/branding.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
