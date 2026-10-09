import { build } from 'vite';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const site = JSON.parse(await readFile('shared/seo.json', 'utf8'));
// External React/GSAP imports resolve against the existing node_modules runtime.
const directory = await mkdtemp(path.resolve('node_modules/.classhub-public-render-'));
const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c');

function head(metadata) {
  const meta = (name, value, property = false) => `<meta data-classhub-seo ${property ? 'property' : 'name'}="${name}" content="${escape(value)}" />`;
  const tags = [`<title>${escape(metadata.title)}</title>`, meta('description', metadata.description), meta('robots', metadata.robots)];
  if (metadata.canonical) tags.push(
    `<link data-classhub-seo rel="canonical" href="${escape(metadata.canonical)}" />`,
    ...Object.entries({ 'og:title': metadata.title, 'og:description': metadata.description, 'og:type': 'website', 'og:site_name': site.name, 'og:locale': 'zh_CN', 'og:url': metadata.canonical, 'og:image': metadata.image, 'og:image:alt': 'ClassHub 标志' }).map(([key, value]) => meta(key, value, true)),
    meta('twitter:card', 'summary'), meta('twitter:title', metadata.title), meta('twitter:description', metadata.description), meta('twitter:image', metadata.image),
  );
  if (metadata.structuredData) tags.push(`<script data-classhub-seo type="application/ld+json">${safeJson(metadata.structuredData)}</script>`);
  return tags.join('\n    ');
}

try {
  await build({
    logLevel: 'error',
    build: { ssr: 'src/seo/renderPublic.tsx', outDir: directory, copyPublicDir: false, manifest: false, emptyOutDir: true, minify: false },
  });
  const { renderPublic } = await import(pathToFileURL(path.join(directory, 'renderPublic.js')).href);
  const template = await readFile('dist/index.html', 'utf8');
  const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
  // Preserve the existing boot/preloader/assets. Only metadata and guest body vary.
  const documentFor = (path, pageModule) => {
    const { html, metadata } = renderPublic(path);
    const css = (manifest[pageModule]?.css || []).map(file => `<link rel="stylesheet" href="/${file}" />`).join('\n');
    return template.replace(/<meta\s+data-classhub-seo\b[^>]*>/g, '')
      .replace(/<title>[\s\S]*?<\/title>/, head(metadata))
      .replace('</head>', `${css}</head>`)
      .replace(/<div id="root">[\s\S]*?<\/noscript>\s*<\/div>/, `<div id="root">${html}</div>`);
  };
  // app.html stays unrendered, noindex and contains no public page canonical/schema.
  await writeFile('dist/app.html', template);
  for (const page of site.publicPages) await writeFile(`dist/${page.file}`, documentFor(page.path, page.module));
  await writeFile('dist/404.html', documentFor('/__not_found__', 'src/pages/NotFound.tsx'));
  const urls = site.publicPages.map(page => `  <url><loc>${escape(site.origin + page.path)}</loc></url>`).join('\n');
  await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  // No fabricated lastmod timestamps and no DB-derived URLs.
  await writeFile('dist/seo-routes.json', JSON.stringify({ origin: site.origin, publicPages: site.publicPages.map(({ path, file }) => ({ path, file })) }, null, 2));
  console.log(`Public HTML generated: ${site.publicPages.map(page => page.path).join(', ')}; private shell and 404 isolated.`);
} finally { await rm(directory, { recursive: true, force: true }); }
