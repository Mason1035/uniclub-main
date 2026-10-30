import { createGlassField } from './homeGlassOptics';

type GlassMaps = { url: string; reflectionUrl: string; scale: number };
// Six home cards have repeated sizes. Bound this cache instead of retaining resize history.
const maps = new Map<string, GlassMaps>();

/** Light mode retains no decoded/applied optics or cached raster maps. */
export function clearGlassMapCache() { maps.clear(); }

export function createGlassNormalMap(width: number, height: number, radius: number, continuous: boolean): GlassMaps | null {
  const key = `${width.toFixed(1)}:${height.toFixed(1)}:${radius}:${continuous}`;
  const cached = maps.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return null;
  const field = createGlassField(width, height, radius, continuous);
  canvas.width = field.width;
  canvas.height = field.height;
  context.putImageData(new ImageData(field.displacement, field.width, field.height), 0, 0);
  const url = canvas.toDataURL();
  context.putImageData(new ImageData(field.fresnel, field.width, field.height), 0, 0);
  const result = { url, reflectionUrl: canvas.toDataURL(), scale: field.scale };
  if (maps.size === 4) maps.delete(maps.keys().next().value!);
  maps.set(key, result);
  return result;
}

/** SVG backdrop refraction is optional. Syntax support alone doesn't prove it renders. */
function supportsGlassBackdrop() {
  const chromium = /(?:Chrome|Chromium|Edg)\//.test(navigator.userAgent) && !/(?:CriOS|EdgiOS)\//.test(navigator.userAgent);
  return chromium && CSS.supports('backdrop-filter', 'url("#home-glass")');
}

/** No per-frame map work; observe content/font/viewport size changes and release on unmount. */
export function attachGlassLens(card: HTMLElement) {
  const filter = card.querySelector<SVGFilterElement>('.home-card__lens-filter');
  const motionFilter = card.querySelector<SVGFilterElement>('.home-card__lens-motion-filter');
  const map = filter?.querySelector<SVGFEImageElement>('feImage');
  const motionMap = motionFilter?.querySelector<SVGFEImageElement>('feImage');
  const displacements = Array.from(filter?.querySelectorAll<SVGFEDisplacementMapElement>('feDisplacementMap') ?? []);
  if (!filter || !map || !displacements.length || !supportsGlassBackdrop()) return () => {};
  let frame = 0;
  let generation = 0;
  let size = '';
  let disposed = false;
  const update = (width: number, height: number) => {
    const style = getComputedStyle(card);
    const radius = parseFloat(style.borderTopLeftRadius);
    const continuous = style.getPropertyValue('corner-shape').includes('superellipse');
    const key = `${width.toFixed(1)}:${height.toFixed(1)}:${radius}:${continuous}`;
    if (key === size || width <= 0 || height <= 0) return;
    size = key;
    // Until the resized maps decode, use CSS rather than a stale/clipped filter region.
    card.style.removeProperty('--home-glass-lens');
    card.style.removeProperty('--home-glass-lens-motion');
    card.style.removeProperty('--home-glass-reflection');
    delete card.dataset.glassOptics;
    cancelAnimationFrame(frame);
    const current = ++generation;
    frame = requestAnimationFrame(() => {
      frame = 0;
      try {
        const normal = createGlassNormalMap(width, height, radius, continuous);
        if (!normal) return;
        const decode = (url: string) => { const image = new Image(); image.src = url; return image.decode(); };
        void Promise.all([decode(normal.url), decode(normal.reflectionUrl)]).then(() => {
          if (disposed || current !== generation) return;
          [filter, motionFilter].forEach(f => {
            f?.setAttribute('width', String(width));
            f?.setAttribute('height', String(height));
          });
          [map, motionMap].forEach(image => {
            image?.setAttribute('width', String(width));
            image?.setAttribute('height', String(height));
            image?.setAttribute('href', normal.url);
          });
          motionFilter?.querySelector('feDisplacementMap')?.setAttribute('scale', String(normal.scale));
          // Closely spaced wavelength samples approximate dispersion without a rainbow outline.
          displacements.forEach((pass, index) => pass.setAttribute('scale', String(normal.scale * [ .98, 1, 1.02 ][index])));
          card.style.setProperty('--home-glass-lens', `url("#${filter.id}")`);
          if (motionFilter) card.style.setProperty('--home-glass-lens-motion', `url("#${motionFilter.id}")`);
          card.style.setProperty('--home-glass-reflection', `url("${normal.reflectionUrl}")`);
          card.dataset.glassOptics = 'ready';
        }).catch(() => { /* CSS blur remains readable if decoding fails. */ });
      } catch { /* Canvas/filter support is optional. */ }
    });
  };
  const observer = new ResizeObserver(entries => {
    const box = entries[0]?.borderBoxSize?.[0];
    if (box) update(box.inlineSize, box.blockSize);
  });
  // Prewarm shortly before entry; don't rasterize or retain applied filters offscreen.
  const visibility = new IntersectionObserver(entries => {
    if (entries[0]?.isIntersecting) observer.observe(card, { box: 'border-box' });
    else {
      observer.disconnect();
      ++generation;
      cancelAnimationFrame(frame); frame = 0; size = '';
      card.style.removeProperty('--home-glass-lens');
      card.style.removeProperty('--home-glass-lens-motion');
      card.style.removeProperty('--home-glass-reflection');
      delete card.dataset.glassOptics;
      map.removeAttribute('href');
      motionMap?.removeAttribute('href');
    }
  }, { rootMargin: '200px 0px' });
  visibility.observe(card);
  return () => {
    disposed = true;
    ++generation;
    cancelAnimationFrame(frame);
    observer.disconnect();
    visibility.disconnect();
    card.style.removeProperty('--home-glass-lens');
    card.style.removeProperty('--home-glass-lens-motion');
    card.style.removeProperty('--home-glass-reflection');
    delete card.dataset.glassOptics;
    map.removeAttribute('href');
    motionMap?.removeAttribute('href');
  };
}
