import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defaultAvatarUrl, resolveAvatarSrc } from '../src/lib/defaultAvatar';
import files from '../shared/default-avatars.json';

test('every library entry exists as a lightweight local SVG, preserving the supplied archive', () => {
  assert.equal(files.length, 50);
  assert.equal(new Set(files).size, 50);
  for (const file of files) {
    assert.match(file, /^[a-f0-9]{10}\.svg$/);
    const svg = readFileSync(`public/default-avatars/${file}`, 'utf8');
    assert.match(svg, /<svg\b/);
    assert.doesNotMatch(svg, /<script\b|<foreignObject\b|\bonload\s*=|<!ENTITY|<!DOCTYPE/i);
  }
});

test('the same account has a stable avatar and different IDs distribute through the library', () => {
  const ids = Array.from({ length: 200 }, (_, index) => index.toString(16).padStart(24, '0'));
  const assigned = ids.map(defaultAvatarUrl);
  assert.ok(new Set(assigned).size > 35);
  for (const [index, id] of ids.entries()) {
    assert.equal(defaultAvatarUrl(id), assigned[index]);
    assert.ok(files.some(file => assigned[index] === `/default-avatars/${file}`));
  }
  assert.equal(defaultAvatarUrl('  same-account  '), defaultAvatarUrl('same-account'));
  assert.equal(defaultAvatarUrl('同学'), defaultAvatarUrl('同学'));
});

test('upload wins, removal restores the same default, and missing identities remain safe', () => {
  const id = '111111111111111111111111';
  const uploaded = 'data:image/webp;base64,uploaded-avatar';
  assert.equal(resolveAvatarSrc(uploaded, id), uploaded);
  assert.equal(resolveAvatarSrc(null, id), defaultAvatarUrl(id));
  assert.equal(resolveAvatarSrc(undefined, id), defaultAvatarUrl(id));
  assert.equal(resolveAvatarSrc('  ', id), defaultAvatarUrl(id));
  assert.equal(defaultAvatarUrl(), defaultAvatarUrl(null));
  assert.match(defaultAvatarUrl(''), /^\/default-avatars\/[a-f0-9]{10}\.svg$/);
});
