export type PreloaderState = 'revealing' | 'waiting' | 'exiting' | 'done';
export interface PreloaderBoot {
  startedAt: number;
  logoStartedAt: number | null;
  minDisplayMs: number;
  maxWaitMs: number;
  state: PreloaderState;
  finish: () => void;
}

declare global {
  interface Window { __classhubPreloader?: PreloaderBoot }
}

export const PRELOADER_DONE = 'classhub:preloader-done';
export const ROUTE_READY = 'classhub:route-ready';
const LOGO_READY = 'classhub:preloader-logo-ready';

// Brand entry is a deliberate sequence, independent of short dialog/UI timing.
// Keep the HTML-only reveal/fade durations in index.html in sync (covered by tests).
export const PRELOADER_TIMING = {
  logoRevealMs: 800,
  logoExitMs: 200,
  overlayExitMs: 900,
  contentEnterMs: 800,
  contentStaggerMs: 100,
  reducedFadeMs: 200,
} as const;

/** Cancellation settles pending waits and removes listeners; it never releases another mount's layer. */
export function waitForImage(image: HTMLImageElement, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      image.removeEventListener('load', loaded);
      image.removeEventListener('error', finish);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const loaded = () => {
      // Decode the responsive currentSrc, rather than fetching the large PNG fallback again.
      if (image.naturalWidth && image.decode) void Promise.resolve().then(() => {
        if (!settled) return image.decode();
      }).then(finish, finish);
      else finish();
    };
    if (signal.aborted) { finish(); return; }
    signal.addEventListener('abort', finish, { once: true });
    if (image.complete) loaded();
    else {
      image.addEventListener('load', loaded, { once: true });
      image.addEventListener('error', finish, { once: true });
    }
  });
}

export function delayUntil(deadline: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = window.setTimeout(finish, Math.max(0, deadline - performance.now()));
    if (signal.aborted) finish();
    else signal.addEventListener('abort', finish, { once: true });
  });
}

function waitForRoute(signal: AbortSignal): Promise<void> {
  if (document.documentElement.hasAttribute('data-classhub-route-ready') || signal.aborted) return Promise.resolve();
  return new Promise(resolve => {
    const finish = () => {
      window.removeEventListener(ROUTE_READY, finish);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    window.addEventListener(ROUTE_READY, finish, { once: true });
    signal.addEventListener('abort', finish, { once: true });
  });
}

export async function waitForLogoReveal(boot: PreloaderBoot, signal: AbortSignal, reduced: boolean): Promise<void> {
  if (boot.logoStartedAt === null && !signal.aborted) await new Promise<void>(resolve => {
    const finish = () => {
      window.removeEventListener(LOGO_READY, finish);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    window.addEventListener(LOGO_READY, finish, { once: true });
    signal.addEventListener('abort', finish, { once: true });
  });
  await delayUntil((boot.logoStartedAt ?? boot.startedAt) + (reduced ? PRELOADER_TIMING.reducedFadeMs : PRELOADER_TIMING.logoRevealMs), signal);
}

/** A lazy route commit can still contain an auth gate; sample the actual page, not its spinner. */
export async function waitForRouteContent(signal: AbortSignal): Promise<void> {
  await waitForRoute(signal);
  const root = document.getElementById('root');
  const hasContent = () => !!document.querySelector('#root main, #root h1');
  if (signal.aborted || hasContent() || !root) return;
  await new Promise<void>(resolve => {
    const finish = () => {
      observer.disconnect();
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const check = () => { if (signal.aborted || hasContent()) finish(); };
    const observer = new MutationObserver(check);
    observer.observe(root, { childList: true, subtree: true });
    signal.addEventListener('abort', finish, { once: true });
    check();
  });
}

export function isFirstFoldVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0
    && rect.left < window.innerWidth && rect.right > 0
    && style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse';
}

/** font-face declarations must exist before fonts.load can request their glyph subsets. */
export function waitForFontStyles(signal: AbortSignal): Promise<void> {
  const link = document.querySelector<HTMLLinkElement>('link[data-classhub-fonts="extended"]');
  if (!link || signal.aborted || (link.sheet && link.media !== 'print')) return Promise.resolve();
  return new Promise(resolve => {
    const finish = () => {
      observer.disconnect();
      link.removeEventListener('load', check);
      link.removeEventListener('error', finish);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const check = () => { if (link.sheet && link.media !== 'print') finish(); };
    // The existing deferred font loader changes media to all on stylesheet load.
    // Observe activation too, including a stylesheet loaded before that script.
    const observer = new MutationObserver(check);
    observer.observe(link, { attributes: true, attributeFilter: ['media'] });
    link.addEventListener('load', check);
    link.addEventListener('error', finish, { once: true });
    signal.addEventListener('abort', finish, { once: true });
    check();
  });
}

/** Only rendered first-fold images/fonts matter. Below-fold content and API queries are excluded. */
export async function criticalAssetsReady(signal: AbortSignal): Promise<void> {
  await waitForRouteContent(signal);
  if (signal.aborted) return;
  await waitForFontStyles(signal);
  if (signal.aborted) return;
  const logo = document.querySelector<HTMLImageElement>('#classhub-preloader img');
  const visibleImages = Array.from(document.querySelectorAll<HTMLImageElement>('#root main img, #root header img'))
    .filter(isFirstFoldVisible);
  const images = logo ? [logo, ...visibleImages] : visibleImages;
  const fonts = document.fonts;
  // The eager home/chrome CSS is applied before their commit; a lazy route's CSS
  // arrives with its module before ROUTE_READY. Load the actual first-fold text.
  const fontLoads = fonts ? Array.from(document.querySelectorAll<HTMLElement>(
    '#root .masthead-nav, #root main h1, #root main h2, #root main h3, #root main p, #root main button, #root main a, #root main label',
  )).filter(isFirstFoldVisible)
    .map(element => Promise.resolve().then(() => {
      const style = getComputedStyle(element);
      return fonts.load(`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, element.textContent?.slice(0, 200) || 'ClassHub');
    })) : [];
  // fonts.ready is global and may include below-fold member copy. These explicit
  // loads await the first-fold faces without making the loader wait for the rest.
  await Promise.allSettled([...images.map(image => waitForImage(image, signal)), ...fontLoads]);
}

/** A single budget from HTML entry also includes slow app/chunk startup. */
export async function waitForEntry(boot: PreloaderBoot, signal: AbortSignal, reduced: boolean): Promise<void> {
  const resources = Promise.all([
    criticalAssetsReady(signal),
    delayUntil(boot.startedAt + boot.minDisplayMs, signal),
    waitForLogoReveal(boot, signal, reduced),
  ]);
  await Promise.race([resources, delayUntil(boot.startedAt + boot.maxWaitMs, signal)]);
}
