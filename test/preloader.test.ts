import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  criticalAssetsReady, delayUntil, isFirstFoldVisible, PRELOADER_DONE, PRELOADER_TIMING, ROUTE_READY,
  waitForEntry, waitForFontStyles, waitForImage, waitForLogoReveal, waitForRouteContent, type PreloaderBoot,
} from '../src/lib/preloader';

const entryHtml = readFileSync('index.html', 'utf8');
const bootScripts = [...entryHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).filter(source => source.includes('__classhubPreloader'));
assert.equal(bootScripts.length, 2, 'the head bootstrap and body logo bootstrap must both be tested');
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function observe(promise: Promise<unknown>) {
  const result = { settled: false };
  void promise.then(() => { result.settled = true; });
  return result;
}

/** Only the event and layout surface the actual preloader uses. */
type FixtureEvent = Event | { type: string; key?: string; target?: { closest: (selector: string) => unknown } };
class Target {
  private listeners = new Map<string, { callback: (event: FixtureEvent) => void; once: boolean; capture: boolean }[]>();
  addEventListener(type: string, callback: (event: FixtureEvent) => void, options: boolean | { once?: boolean; capture?: boolean } = false) {
    const capture = typeof options === 'boolean' ? options : !!options.capture;
    const entries = this.listeners.get(type) || [];
    if (!entries.some(entry => entry.callback === callback && entry.capture === capture)) {
      entries.push({ callback, capture, once: typeof options === 'object' && !!options.once });
    }
    this.listeners.set(type, entries);
  }
  removeEventListener(type: string, callback: (event: FixtureEvent) => void, options: boolean | { capture?: boolean } = false) {
    const capture = typeof options === 'boolean' ? options : !!options.capture;
    this.listeners.set(type, (this.listeners.get(type) || []).filter(entry => entry.callback !== callback || entry.capture !== capture));
  }
  dispatchEvent(event: FixtureEvent) {
    for (const entry of [...(this.listeners.get(event.type) || [])]) {
      if (!(this.listeners.get(event.type) || []).includes(entry)) continue;
      if (entry.once) this.removeEventListener(event.type, entry.callback, entry.capture);
      entry.callback(event);
    }
    return true;
  }
  listenerCount(type?: string) {
    return type ? (this.listeners.get(type) || []).length : [...this.listeners.values()].reduce((sum, entries) => sum + entries.length, 0);
  }
}
class Signal extends Target {
  aborted = false;
  abort() { if (!this.aborted) { this.aborted = true; this.dispatchEvent(new Event('abort')); } }
  get domSignal() { return this as unknown as AbortSignal; }
}
class Clock {
  now = 0;
  private nextId = 1;
  timers = new Map<number, { at: number; callback: () => void }>();
  setTimeout = (callback: () => void, delay = 0) => {
    const id = this.nextId++;
    this.timers.set(id, { at: this.now + Math.max(0, delay), callback });
    return id;
  };
  clearTimeout = (id: number) => { this.timers.delete(id); };
  async to(time: number) {
    assert.ok(time >= this.now, 'the fixture clock may only move forward');
    await flush();
    while (true) {
      const next = [...this.timers.entries()].filter(([, timer]) => timer.at <= time)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      this.now = next[1].at;
      this.timers.delete(next[0]);
      next[1].callback();
      await flush();
    }
    this.now = time;
    await flush();
  }
}
class Element extends Target {
  attributes = new Map<string, string>();
  dataset = new Proxy<Record<string, string>>({}, {
    set: (_target, key: string, value: string) => { this.setAttribute(`data-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`, value); return true; },
  });
  style: Record<string, string> = { display: 'block', visibility: 'visible', fontWeight: '400', fontSize: '16px', fontFamily: 'ClassHub' };
  rect = { width: 100, height: 32, left: 10, right: 110, top: 10, bottom: 42 };
  textContent = 'First-fold text';
  removed = false;
  hasAttribute(name: string) { return this.attributes.has(name); }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  getBoundingClientRect() { return this.rect; }
  remove() { this.removed = true; }
}
class Image extends Element {
  complete = false;
  naturalWidth = 192;
  decode?: () => Promise<void>;
  get domImage() { return this as unknown as HTMLImageElement; }
}
class FontStylesheet extends Element {
  sheet: object | null = null;
  media = 'print';
}
class Browser {
  clock = new Clock();
  html = new Element();
  root = new Element();
  content = new Element();
  contentMounted = true;
  observers = new Set<{ notify(): void; disconnect(): void }>();
  observation: { target: unknown; options: MutationObserverInit } | null = null;
  logo = new Image();
  layer = Object.assign(new Element(), { querySelector: () => this.logo });
  images: Image[] = [];
  text: Element[] = [];
  fontStylesheet: FontStylesheet | null = null;
  fontCalls: [string, string][] = [];
  fontReady: Promise<unknown> = Promise.resolve();
  fontLoad: (font: string, text: string) => Promise<unknown> = () => Promise.resolve();
  queried: string[] = [];
  window = Object.assign(new Target(), {
    innerWidth: 1280, innerHeight: 800, setTimeout: this.clock.setTimeout, __classhubPreloader: undefined as PreloaderBoot | undefined,
  });
  document = Object.assign(new Target(), {
    documentElement: this.html,
    getElementById: (id: string) => id === 'root' ? this.root : id === 'classhub-preloader' && !this.layer.removed ? this.layer : null,
    querySelector: (selector: string) => { this.queried.push(selector); return selector.startsWith('link[') ? this.fontStylesheet : selector.startsWith('#root ') ? this.contentMounted ? this.content : null : this.layer.removed ? null : this.logo; },
    querySelectorAll: (selector: string) => { this.queried.push(selector); return selector.includes(' img') ? this.images : this.text; },
    fonts: {
      ready: this.fontReady,
      load: (font: string, text: string) => { this.fontCalls.push([font, text]); return this.fontLoad(font, text); },
    },
  });
  constructor(routeReady = true, contentMounted = true) {
    this.contentMounted = contentMounted;
    this.logo.complete = true;
    this.html.style['--motion-structural'] = '320ms';
    if (routeReady) this.html.setAttribute('data-classhub-route-ready', '');
  }
  commitContent() {
    this.contentMounted = true;
    for (const observer of [...this.observers]) observer.notify();
  }
  mutateWithoutContent() { for (const observer of [...this.observers]) observer.notify(); }
  install(t: TestContext) {
    const observers = this.observers;
    const recordObservation = (target: unknown, options: MutationObserverInit) => { this.observation = { target, options }; };
    class FixtureMutationObserver {
      constructor(private callback: () => void) {}
      observe(target: unknown, options: MutationObserverInit) {
        recordObservation(target, options);
        observers.add(this);
      }
      notify() { this.callback(); }
      disconnect() { observers.delete(this); }
    }
    const globals = {
      MutationObserver: FixtureMutationObserver,
      window: this.window, document: this.document, performance: { now: () => this.clock.now },
      getComputedStyle: (element: Element) => ({ ...element.style, getPropertyValue: (name: string) => element.style[name] || '' }), clearTimeout: this.clock.clearTimeout,
    };
    for (const [name, value] of Object.entries(globals)) {
      const original = Object.getOwnPropertyDescriptor(globalThis, name);
      Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
      t.after(() => { if (original) Object.defineProperty(globalThis, name, original); else delete globalThis[name]; });
    }
  }
  bootstrap(storage = new Map<string, string>(), unavailable = false) {
    const context = {
      window: this.window, document: this.document, performance: { now: () => this.clock.now }, Event,
      setTimeout: this.clock.setTimeout, clearTimeout: this.clock.clearTimeout,
      sessionStorage: {
        getItem: (key: string) => { if (unavailable) throw new Error('storage denied'); return storage.get(key) ?? null; },
        setItem: (key: string, value: string) => { if (unavailable) throw new Error('storage denied'); storage.set(key, value); },
      },
    };
    for (const script of bootScripts) runInNewContext(script, context);
    return this.window.__classhubPreloader!;
  }
  boot(overrides: Partial<PreloaderBoot> = {}): PreloaderBoot {
    return { startedAt: 0, logoStartedAt: 0, minDisplayMs: 900, maxWaitMs: 4000, state: 'revealing', finish() {}, ...overrides };
  }
}

test('cached images wait for decoding and release their abort listener afterwards', async () => {
  const image = new Image(); image.complete = true;
  const decoded = deferred(); image.decode = () => decoded.promise;
  const signal = new Signal();
  const ready = observe(waitForImage(image.domImage, signal.domSignal));
  await flush(); assert.equal(ready.settled, false);
  assert.equal(image.listenerCount(), 0); assert.equal(signal.listenerCount('abort'), 1);
  decoded.resolve(); await flush();
  assert.equal(ready.settled, true); assert.equal(signal.listenerCount(), 0);
});

test('loading images use their decoder and remove load, error, and abort listeners', async () => {
  const image = new Image(); const decoded = deferred(); let decodes = 0;
  image.decode = () => { decodes++; return decoded.promise; };
  const signal = new Signal(); const ready = observe(waitForImage(image.domImage, signal.domSignal));
  assert.equal(image.listenerCount('load'), 1); assert.equal(image.listenerCount('error'), 1);
  image.dispatchEvent(new Event('load')); await flush();
  assert.equal(decodes, 1); assert.equal(ready.settled, false);
  decoded.resolve(); await flush();
  assert.equal(ready.settled, true); assert.equal(image.listenerCount(), 0); assert.equal(signal.listenerCount(), 0);
});

test('image errors, broken cached images, and decoder failures all settle readiness', async () => {
  for (const scenario of ['error', 'broken-cache', 'decode-failure']) {
    const image = new Image(); const signal = new Signal(); let decodes = 0;
    image.complete = scenario !== 'error'; image.naturalWidth = scenario === 'broken-cache' ? 0 : 192;
    image.decode = () => { decodes++; return Promise.reject(new Error('decode failed')); };
    const ready = waitForImage(image.domImage, signal.domSignal);
    if (scenario === 'error') image.dispatchEvent(new Event('error'));
    await ready;
    assert.equal(decodes, scenario === 'decode-failure' ? 1 : 0, scenario);
    assert.equal(image.listenerCount(), 0, scenario); assert.equal(signal.listenerCount(), 0, scenario);
  }
});

test('abort settles both pending loads and pending decodes without retaining listeners', async () => {
  for (const decoding of [false, true]) {
    const image = new Image(); image.complete = decoding; image.decode = () => new Promise(() => {});
    const signal = new Signal(); const ready = observe(waitForImage(image.domImage, signal.domSignal));
    signal.abort(); await flush();
    assert.equal(ready.settled, true); assert.equal(image.listenerCount(), 0); assert.equal(signal.listenerCount(), 0);
  }
  const image = new Image(); image.complete = true; image.decode = () => { throw new Error('must not decode after abort'); };
  const signal = new Signal(); signal.abort(); await waitForImage(image.domImage, signal.domSignal);
  assert.equal(image.listenerCount(), 0); assert.equal(signal.listenerCount(), 0);
});

test('deadline waits use the entry clock and abort clears the timer', async t => {
  const browser = new Browser(); browser.install(t); browser.clock.now = 300;
  const signal = new Signal(); const ready = observe(delayUntil(900, signal.domSignal));
  await browser.clock.to(899); assert.equal(ready.settled, false);
  signal.abort(); await flush();
  assert.equal(ready.settled, true); assert.equal(browser.clock.timers.size, 0); assert.equal(signal.listenerCount(), 0);
  const past = observe(delayUntil(200, new Signal().domSignal));
  await browser.clock.to(899); assert.equal(past.settled, true);
});

test('critical assets wait for the route commit, then the logo, visible first-fold images, and actual text fonts', async t => {
  const browser = new Browser(false); browser.install(t);
  browser.logo.complete = false;
  const visible = new Image(); const below = new Image(); below.rect.top = 900;
  const above = new Image(); above.rect.bottom = -1;
  const hidden = new Image(); hidden.style.visibility = 'hidden';
  const zero = new Image(); zero.rect.width = 0;
  browser.images = [visible, below, above, hidden, zero];
  const text = new Element(); text.textContent = 'Actual masthead and headline';
  const belowText = new Element(); belowText.rect.top = 900;
  browser.text = [text, belowText];
  const fonts = deferred(); browser.fontLoad = () => fonts.promise;
  const fontReady = deferred(); browser.document.fonts.ready = fontReady.promise;
  const signal = new Signal(); const ready = observe(criticalAssetsReady(signal.domSignal));
  await flush(); assert.equal(browser.queried.length, 0);
  browser.window.dispatchEvent(new Event(ROUTE_READY)); await flush();
  assert.equal(browser.window.listenerCount(ROUTE_READY), 0);
  assert.equal(browser.logo.listenerCount('load'), 1); assert.equal(visible.listenerCount('load'), 1);
  for (const excluded of [below, above, hidden, zero]) assert.equal(excluded.listenerCount(), 0);
  assert.deepEqual(browser.fontCalls, [['400 16px ClassHub', 'Actual masthead and headline']]);
  browser.logo.dispatchEvent(new Event('load')); visible.dispatchEvent(new Event('error'));
  await flush(); assert.equal(ready.settled, false, 'the explicit first-fold font load still belongs to the gate');
  fonts.reject(new Error('font offline'));
  await flush();
  // An unrelated/below-fold font can leave global fonts.ready pending forever.
  // Only the explicit first-fold text loads belong to this gate.
  assert.equal(ready.settled, true); assert.equal(signal.listenerCount(), 0);
});

test('aborting before a route commits removes listeners and does not inspect the unfinished route', async t => {
  const browser = new Browser(false); browser.install(t);
  const signal = new Signal(); const ready = criticalAssetsReady(signal.domSignal);
  assert.equal(browser.window.listenerCount(ROUTE_READY), 1);
  signal.abort(); await ready;
  assert.equal(browser.window.listenerCount(), 0); assert.equal(signal.listenerCount(), 0); assert.equal(browser.queried.length, 0);
});

test('a route commit during auth loading waits for real content before sampling images and fonts', async t => {
  const browser = new Browser(false, false); browser.install(t);
  const image = new Image(); const decoded = deferred(); image.complete = true; image.decode = () => decoded.promise;
  const text = new Element(); text.textContent = 'The authenticated first fold';
  browser.images = [image]; browser.text = [text];
  const fonts = deferred(); browser.fontLoad = () => fonts.promise;
  const signal = new Signal(); t.after(() => signal.abort());
  const ready = observe(criticalAssetsReady(signal.domSignal));
  browser.window.dispatchEvent(new Event(ROUTE_READY)); await flush();
  assert.equal(ready.settled, false);
  assert.equal(browser.observers.size, 1);
  assert.equal(browser.observation?.target, browser.root);
  assert.deepEqual(browser.observation?.options, { childList: true, subtree: true });
  assert.equal(browser.fontCalls.length, 0);
  assert.equal(browser.queried.some(selector => selector.includes(' img')), false);
  browser.mutateWithoutContent(); await flush(); assert.equal(ready.settled, false);
  browser.commitContent(); await flush();
  assert.equal(browser.observers.size, 0);
  assert.deepEqual(browser.fontCalls, [['400 16px ClassHub', 'The authenticated first fold']]);
  fonts.resolve(); await flush(); assert.equal(ready.settled, false, 'the final image must finish decoding');
  decoded.resolve(); await flush(); assert.equal(ready.settled, true);
  assert.equal(signal.listenerCount(), 0);
});

test('aborting while waiting for real route content disconnects its observer', async t => {
  const browser = new Browser(true, false); browser.install(t);
  const signal = new Signal(); const ready = observe(waitForRouteContent(signal.domSignal));
  await flush(); assert.equal(browser.observers.size, 1); assert.equal(ready.settled, false);
  signal.abort(); await flush();
  assert.equal(ready.settled, true); assert.equal(browser.observers.size, 0); assert.equal(signal.listenerCount(), 0);
  browser.commitContent(); await flush(); assert.equal(browser.observers.size, 0);
});

test('first-fold visibility excludes zero, hidden, collapsed, and horizontally or vertically offscreen elements', t => {
  const browser = new Browser(); browser.install(t);
  const excluded: Element[] = [];
  const below = new Element(); below.rect.top = 801; excluded.push(below);
  const above = new Element(); above.rect.bottom = 0; excluded.push(above);
  const left = new Element(); left.rect.right = 0; excluded.push(left);
  const right = new Element(); right.rect.left = 1280; excluded.push(right);
  const hidden = new Element(); hidden.style.visibility = 'hidden'; excluded.push(hidden);
  const collapsed = new Element(); collapsed.style.visibility = 'collapse'; excluded.push(collapsed);
  const undisplayed = new Element(); undisplayed.style.display = 'none'; excluded.push(undisplayed);
  const zeroWidth = new Element(); zeroWidth.rect.width = 0; excluded.push(zeroWidth);
  const zeroHeight = new Element(); zeroHeight.rect.height = 0; excluded.push(zeroHeight);
  for (const element of excluded) assert.equal(isFirstFoldVisible(element as unknown as HTMLElement), false);
  const entering = new Element(); entering.style.opacity = '0'; entering.rect.left = -10; entering.rect.top = -10;
  assert.equal(isFirstFoldVisible(entering as unknown as HTMLElement), true, 'temporary reveal opacity must not skip real resources');
});

test('first-fold font loads exclude hidden and offscreen text, with all selectors scoped to the app', async t => {
  const browser = new Browser(); browser.install(t);
  const visible = new Element(); visible.textContent = 'Visible content';
  const hidden = new Element(); hidden.style.display = 'none';
  const above = new Element(); above.rect.bottom = -1;
  const right = new Element(); right.rect.left = 1300;
  browser.text = [visible, hidden, above, right];
  const signal = new Signal(); await criticalAssetsReady(signal.domSignal);
  assert.deepEqual(browser.fontCalls, [['400 16px ClassHub', 'Visible content']]);
  const selector = browser.queried.find(query => query.includes(' h2'));
  assert.ok(selector);
  assert.ok(selector.split(',').every(part => part.trim().startsWith('#root ')), 'font queries cannot match unrelated overlays or outside content');
});

test('first-fold fonts wait for the loaded extended stylesheet to become active on screen', async t => {
  const browser = new Browser(); browser.install(t);
  const link = new FontStylesheet(); link.sheet = {};
  browser.fontStylesheet = link;
  const text = new Element(); text.textContent = 'Actual serif headline'; browser.text = [text];
  const fonts = deferred(); browser.fontLoad = () => fonts.promise;
  const signal = new Signal(); t.after(() => signal.abort());
  const ready = observe(criticalAssetsReady(signal.domSignal));
  await flush();
  assert.equal(ready.settled, false); assert.equal(browser.fontCalls.length, 0);
  assert.equal(browser.observers.size, 1);
  assert.equal(browser.observation?.target, link);
  assert.deepEqual(browser.observation?.options, { attributes: true, attributeFilter: ['media'] });
  link.dispatchEvent(new Event('load')); await flush();
  assert.equal(browser.fontCalls.length, 0, 'a loaded print-only sheet has no active first-fold font-face declarations');
  assert.equal(ready.settled, false);
  link.media = 'all'; browser.mutateWithoutContent(); await flush();
  assert.equal(browser.observers.size, 0); assert.equal(link.listenerCount(), 0);
  assert.deepEqual(browser.fontCalls, [['400 16px ClassHub', 'Actual serif headline']]);
  assert.equal(ready.settled, false, 'activated font declarations still require their actual glyph subsets');
  fonts.resolve(); await flush(); assert.equal(ready.settled, true); assert.equal(signal.listenerCount(), 0);
});

test('stylesheet activation before its load does not release until the sheet exists', async t => {
  const browser = new Browser(); browser.install(t);
  const link = new FontStylesheet(); link.media = 'all'; browser.fontStylesheet = link;
  const signal = new Signal(); const ready = observe(waitForFontStyles(signal.domSignal));
  await flush(); assert.equal(ready.settled, false); assert.equal(browser.observers.size, 1);
  browser.mutateWithoutContent(); await flush(); assert.equal(ready.settled, false);
  link.sheet = {}; link.dispatchEvent(new Event('load')); await flush();
  assert.equal(ready.settled, true); assert.equal(browser.observers.size, 0);
  assert.equal(link.listenerCount(), 0); assert.equal(signal.listenerCount(), 0);
});

test('font styles with no link, an already active sheet, or an already aborted wait settle without listeners', async t => {
  const browser = new Browser(); browser.install(t);
  const signal = new Signal(); await waitForFontStyles(signal.domSignal);
  const link = new FontStylesheet(); link.sheet = {}; link.media = 'all'; browser.fontStylesheet = link;
  await waitForFontStyles(signal.domSignal);
  link.sheet = null; link.media = 'print'; signal.abort(); await waitForFontStyles(signal.domSignal);
  assert.equal(browser.observers.size, 0); assert.equal(link.listenerCount(), 0); assert.equal(signal.listenerCount(), 0);
});

test('font stylesheet errors and aborts settle readiness and release every observer and listener', async t => {
  const browser = new Browser(); browser.install(t);
  for (const scenario of ['error', 'abort']) {
    const link = new FontStylesheet(); browser.fontStylesheet = link;
    const signal = new Signal(); const ready = observe(waitForFontStyles(signal.domSignal));
    await flush(); assert.equal(ready.settled, false);
    assert.equal(link.listenerCount('load'), 1); assert.equal(link.listenerCount('error'), 1);
    assert.equal(browser.observers.size, 1);
    if (scenario === 'error') link.dispatchEvent(new Event('error')); else signal.abort();
    await flush(); assert.equal(ready.settled, true, scenario);
    assert.equal(browser.observers.size, 0, scenario); assert.equal(link.listenerCount(), 0, scenario);
    assert.equal(signal.listenerCount(), 0, scenario);
  }
});

test('a delayed extended font stylesheet shares the same 4s budget as chunks and images', async t => {
  const browser = new Browser(); browser.install(t);
  const link = new FontStylesheet(); browser.fontStylesheet = link;
  const text = new Element(); browser.text = [text];
  const signal = new Signal(); const ready = observe(waitForEntry(browser.boot(), signal.domSignal, false));
  await browser.clock.to(3999); assert.equal(ready.settled, false);
  assert.equal(browser.fontCalls.length, 0); assert.equal(browser.observers.size, 1);
  await browser.clock.to(4000); assert.equal(ready.settled, true);
  signal.abort(); await flush();
  assert.equal(browser.observers.size, 0); assert.equal(link.listenerCount(), 0);
  assert.equal(signal.listenerCount(), 0); assert.equal(browser.clock.timers.size, 0);
  assert.equal(browser.fontCalls.length, 0, 'the deadline must not start another font load after exit');
});

test('entry choreography has a fixed local timing contract', () => {
  assert.deepEqual(PRELOADER_TIMING, {
    logoRevealMs: 800, logoExitMs: 200, overlayExitMs: 900,
    contentEnterMs: 800, contentStaggerMs: 100, reducedFadeMs: 200,
  });
});

test('a fast entry respects the 900ms minimum', async t => {
  const browser = new Browser(); const signal = new Signal();
  t.after(() => signal.abort()); browser.install(t);
  const ready = observe(waitForEntry(browser.boot(), signal.domSignal, false));
  await browser.clock.to(899); assert.equal(ready.settled, false);
  await browser.clock.to(900); assert.equal(ready.settled, true);
});

test('a slow first-fold asset keeps the gate closed after the minimum', async t => {
  const browser = new Browser(); const signal = new Signal();
  t.after(() => signal.abort()); browser.install(t); browser.logo.complete = false;
  const ready = observe(waitForEntry(browser.boot(), signal.domSignal, false));
  await browser.clock.to(1700); assert.equal(ready.settled, false);
  browser.logo.dispatchEvent(new Event('load')); await flush(); assert.equal(ready.settled, true);
});

test('a logo arriving late gets its own complete reveal before exit', async t => {
  const browser = new Browser(); const signal = new Signal();
  t.after(() => signal.abort()); browser.install(t); const boot = browser.boot({ logoStartedAt: null });
  const ready = observe(waitForEntry(boot, signal.domSignal, false));
  await browser.clock.to(1100); assert.equal(ready.settled, false);
  boot.logoStartedAt = browser.clock.now;
  browser.window.dispatchEvent(new Event('classhub:preloader-logo-ready'));
  await browser.clock.to(1899); assert.equal(ready.settled, false);
  await browser.clock.to(1900); assert.equal(ready.settled, true);
});

test('the full 800ms logo reveal is independent of unrelated shared motion tokens', async t => {
  const browser = new Browser(); const signal = new Signal();
  t.after(() => signal.abort()); browser.install(t);
  browser.html.style['--motion-structural'] = '.48s';
  const ready = observe(waitForLogoReveal(browser.boot(), signal.domSignal, false));
  await browser.clock.to(799); assert.equal(ready.settled, false);
  await browser.clock.to(800); assert.equal(ready.settled, true);
});

test('reduced-motion logo readiness waits for its 200ms fade without a transform animation', async t => {
  const browser = new Browser(); const signal = new Signal(); t.after(() => signal.abort()); browser.install(t);
  const ready = observe(waitForLogoReveal(browser.boot(), signal.domSignal, true));
  await browser.clock.to(199); assert.equal(ready.settled, false);
  await browser.clock.to(200); assert.equal(ready.settled, true);
});

test('uncommitted routes and unavailable resources cannot exceed the 4s entry budget', async t => {
  const browser = new Browser(false); browser.install(t); const signal = new Signal();
  const ready = observe(waitForEntry(browser.boot({ logoStartedAt: null }), signal.domSignal, false));
  await browser.clock.to(3999); assert.equal(ready.settled, false);
  await browser.clock.to(4000); assert.equal(ready.settled, true);
  // BrandPreloader aborts the losing resource and reveal waits on this path.
  signal.abort(); await flush();
  assert.equal(browser.window.listenerCount(), 0); assert.equal(signal.listenerCount(), 0); assert.equal(browser.clock.timers.size, 0);
});

test('a committed route with an image that never loads also releases at 4s', async t => {
  const browser = new Browser(); browser.install(t); browser.logo.complete = false;
  const signal = new Signal(); const ready = observe(waitForEntry(browser.boot(), signal.domSignal, false));
  await browser.clock.to(4000); assert.equal(ready.settled, true);
  signal.abort(); await flush(); assert.equal(browser.logo.listenerCount(), 0); assert.equal(signal.listenerCount(), 0);
});

test('reduced motion keeps the 900ms minimum and still waits for critical assets', async t => {
  const browser = new Browser(); const signal = new Signal();
  t.after(() => signal.abort()); browser.install(t);
  const ready = observe(waitForEntry(browser.boot(), signal.domSignal, true));
  await browser.clock.to(899); assert.equal(ready.settled, false);
  await browser.clock.to(900); assert.equal(ready.settled, true);
  browser.logo.complete = false;
  const slow = observe(waitForEntry(browser.boot({ startedAt: 1000, logoStartedAt: 1000 }), signal.domSignal, true));
  await browser.clock.to(2000); assert.equal(slow.settled, false);
  browser.logo.dispatchEvent(new Event('load')); await flush(); assert.equal(slow.settled, true);
});

test('late app startup consumes the original deadline instead of restarting the budget', async t => {
  const browser = new Browser(false); const signal = new Signal();
  t.after(() => signal.abort()); browser.install(t); browser.clock.now = 2500;
  const ready = observe(waitForEntry(browser.boot(), signal.domSignal, false));
  await browser.clock.to(3999); assert.equal(ready.settled, false);
  await browser.clock.to(4000); assert.equal(ready.settled, true);
  browser.clock.now = 4500;
  const overdue = observe(waitForEntry(browser.boot(), signal.domSignal, false));
  await browser.clock.to(4500); assert.equal(overdue.settled, true);
});

test('abort before logo readiness releases its event listener and minimum timer', async t => {
  const browser = new Browser(); browser.install(t); const signal = new Signal();
  const ready = observe(waitForLogoReveal(browser.boot({ logoStartedAt: null }), signal.domSignal, false));
  assert.equal(browser.window.listenerCount('classhub:preloader-logo-ready'), 1);
  signal.abort(); await flush();
  assert.equal(ready.settled, true); assert.equal(browser.window.listenerCount(), 0);
  assert.equal(browser.clock.timers.size, 0); assert.equal(signal.listenerCount(), 0);
});

test('the first session is claimed at HTML entry, so refresh during reveal immediately skips', async () => {
  const storage = new Map<string, string>();
  const first = new Browser(); const firstBoot = first.bootstrap(storage);
  assert.equal(firstBoot.state, 'revealing'); assert.equal(storage.get('classhub-preloader-seen'), '1');
  assert.equal(firstBoot.minDisplayMs, 900); assert.equal(firstBoot.maxWaitMs, 4000);
  assert.equal(first.html.hasAttribute('data-classhub-preloader'), true);
  await first.clock.to(300);
  const refresh = new Browser(); const refreshBoot = refresh.bootstrap(storage);
  assert.equal(refreshBoot.state, 'done'); assert.equal(refresh.layer.removed, true);
  assert.equal(refresh.html.hasAttribute('data-classhub-preloader'), false); assert.equal(refresh.clock.timers.size, 0);
  assert.equal(refresh.window.listenerCount(), 0); assert.equal(refresh.document.listenerCount(), 0);
  firstBoot.finish();
});

test('internal route navigation retains the finished document boot and cannot recreate the entry layer', () => {
  const browser = new Browser(); const boot = browser.bootstrap(); boot.finish();
  browser.window.dispatchEvent(new Event(ROUTE_READY));
  browser.window.dispatchEvent(new Event('popstate'));
  assert.equal(browser.window.__classhubPreloader, boot); assert.equal(boot.state, 'done'); assert.equal(browser.layer.removed, true);
  // The component is adopted once at the app entry and creates no new overlay JSX.
  const main = readFileSync('src/main.tsx', 'utf8');
  const component = readFileSync('src/components/BrandPreloader.tsx', 'utf8');
  assert.equal((main.match(/<BrandPreloader\s*\/>/g) || []).length, 1);
  assert.match(component, /boot\.state\s*===\s*['"]done['"]/); assert.match(component, /return null/);
});

test('unavailable session storage still starts and finishes the current document safely', () => {
  const browser = new Browser(); const boot = browser.bootstrap(new Map(), true);
  assert.equal(boot.state, 'revealing'); boot.finish();
  assert.equal(boot.state, 'done'); assert.equal(browser.layer.removed, true);
  assert.equal(browser.html.hasAttribute('data-classhub-preloader'), false); assert.equal(browser.clock.timers.size, 0);
});

test('the HTML-only safety release removes the layer, unlocks the page, and cleans listeners without an app bundle', async () => {
  const browser = new Browser(); const boot = browser.bootstrap(); let done = 0;
  browser.window.addEventListener(PRELOADER_DONE, () => { done++; });
  assert.equal(browser.html.hasAttribute('data-classhub-preloader-logo-ready'), true);
  await browser.clock.to(5999); assert.equal(browser.layer.removed, false); assert.equal(boot.state, 'revealing');
  await browser.clock.to(6000);
  assert.equal(boot.state, 'done'); assert.equal(browser.layer.removed, true);
  assert.equal(browser.html.hasAttribute('data-classhub-preloader'), false);
  assert.equal(browser.html.hasAttribute('data-classhub-preloader-logo-ready'), false);
  assert.equal(browser.window.listenerCount('keydown'), 0); assert.equal(browser.document.listenerCount('focusin'), 0);
  assert.equal(browser.clock.timers.size, 0); assert.equal(done, 1);
  boot.finish(); assert.equal(done, 1, 'finish must be idempotent');
});

test('keyboard navigation and app focus can release the HTML layer immediately', () => {
  for (const key of ['Tab', 'Escape']) {
    const browser = new Browser(); const boot = browser.bootstrap();
    browser.window.dispatchEvent({ type: 'keydown', key: 'Enter' }); assert.equal(boot.state, 'revealing');
    browser.window.dispatchEvent({ type: 'keydown', key });
    assert.equal(boot.state, 'done', key); assert.equal(browser.layer.removed, true); assert.equal(browser.clock.timers.size, 0);
  }
  const browser = new Browser(); const boot = browser.bootstrap();
  browser.document.dispatchEvent({ type: 'focusin', target: { closest: () => null } }); assert.equal(boot.state, 'revealing');
  browser.document.dispatchEvent({ type: 'focusin', target: { closest: () => browser.root } });
  assert.equal(boot.state, 'done'); assert.equal(browser.document.listenerCount(), 0);
});

test('HTML logo readiness uses image completion time once and image failure does not block reveal', async () => {
  for (const event of ['load', 'error']) {
    const browser = new Browser(); browser.logo.complete = false; const boot = browser.bootstrap();
    assert.equal(boot.logoStartedAt, null); assert.equal(browser.html.hasAttribute('data-classhub-preloader-logo-ready'), false);
    await browser.clock.to(140); browser.logo.dispatchEvent(new Event(event));
    assert.equal(boot.logoStartedAt, 140); assert.equal(browser.html.hasAttribute('data-classhub-preloader-logo-ready'), true);
    if (event === 'error') assert.equal(browser.logo.style.visibility, 'hidden');
    await browser.clock.to(200); browser.logo.dispatchEvent(new Event('load')); assert.equal(boot.logoStartedAt, 140);
    boot.finish();
  }
});

test('critical HTML supplies the first frame, theme token, mobile sizing, and separate reduced-motion fade before the app bundle', () => {
  const css = entryHtml.match(/<style>([\s\S]*?)<\/style>/)?.[1]; assert.ok(css);
  const headBoot = entryHtml.indexOf(bootScripts[0]);
  const overlay = entryHtml.indexOf('<div id="classhub-preloader"');
  const bodyBoot = entryHtml.indexOf(bootScripts[1]);
  const app = entryHtml.indexOf('src="/src/main.tsx"');
  assert.ok(entryHtml.indexOf('<style>') < headBoot && headBoot < overlay && overlay < bodyBoot && bodyBoot < app);
  assert.match(css, /html\[data-classhub-preloader\]\s+\.classhub-preloader\s*\{[^}]*display:\s*grid[^}]*position:\s*fixed[^}]*inset:\s*0/s);
  assert.match(css, /background:\s*var\(--page-bg,\s*#E9E9E9\)/, 'the route theme token controls the overlay background');
  assert.match(css, /html\.dark\s+\.classhub-preloader\s*\{\s*background:\s*var\(--page-bg,\s*#1C1D21\)/, 'dark mode has a critical fallback before route CSS arrives');
  assert.match(readFileSync('src/pages/not-found.css', 'utf8'), /--page-bg:\s*#080B12/i, 'the dark route supplies its page token');
  assert.match(css, /height:\s*100%;\s*height:\s*100dvh/);
  assert.match(css, /@media\s*\(max-width:\s*767px\)[^}]*width:\s*88px/s);
  assert.match(css, /animation:\s*classhub-brand-reveal\s+800ms/);
  assert.match(css, /@keyframes\s+classhub-brand-reveal[\s\S]*filter:\s*blur\([1-9][^)]*\)[\s\S]*filter:\s*blur\(0(?:px)?\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*transform:\s*none;\s*filter:\s*none;[\s\S]*animation:\s*classhub-brand-fade\s+200ms/);
  const introRules = [...css.matchAll(/([^{}]+)\{[^{}]*animation:\s*classhub-brand-(?:reveal|fade)[^{}]*\}/g)];
  assert.equal(introRules.length, 2);
  for (const rule of introRules) {
    assert.match(rule[1], /\[data-classhub-preloader=['"]revealing['"]\]/);
    assert.match(rule[1], /\[data-classhub-preloader-logo-ready\]/);
  }
  assert.match(css, /classhub-preloader='exiting'[\s\S]*animation:\s*none;\s*opacity:\s*1;\s*transform:\s*none;\s*filter:\s*none/);
  assert.match(entryHtml, /id="classhub-preloader"[^>]*aria-hidden="true"/);
  assert.match(entryHtml, /class="classhub-preloader__logo"[^>]*width="576"[^>]*height="192"[^>]*alt=""[^>]*fetchpriority="high"/);
  const branding = JSON.parse(readFileSync('src/lib/branding.json', 'utf8'));
  const sources = entryHtml.match(/<source type="image\/webp" srcset="([^"]+)"/)?.[1].split(',').map(source => source.trim());
  assert.ok(sources?.length);
  for (const source of sources) assert.ok(branding.logo.some(image => source === `${image.src} ${image.width}w`));
  assert.ok(entryHtml.includes(`src="${branding.logoFallback.src}"`));
});
