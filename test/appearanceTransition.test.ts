import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppearanceTransition, APPEARANCE_TRANSITION_MS } from '../src/lib/appearanceTransition';
import { isAppearanceMotionPaused } from '../src/lib/appearanceMotion';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

async function environment(run: (env: ReturnType<typeof setup>) => Promise<void>, options: { instant?: boolean; native?: boolean; throws?: boolean } = {}) {
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const env = setup(options);
  Object.defineProperty(globalThis, 'document', { configurable: true, value: env.doc });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: env.win });
  try { await run(env); } finally {
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else delete globalThis.document;
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else delete globalThis.window;
  }
}

function setup({ instant = false, native = true, throws = false } = {}) {
  const timers = new Map<number, { callback: () => void; duration: number }>();
  const transitions: Array<{ finish: () => void; skipped: boolean; updateCallbackDone: Promise<void> }> = [];
  const doc = {
    hidden: false, documentElement: { dataset: {} as Record<string, string> }, body: {},
    querySelector: () => ({ dataset: { ready: 'true' } }),
    startViewTransition: native ? (update: () => Promise<void>) => {
      if (throws) throw new Error('capture unavailable');
      const done = deferred();
      const transition = {
        skipped: false, finish: done.resolve,
        updateCallbackDone: Promise.resolve().then(update),
        ready: Promise.resolve(), finished: done.promise,
        skipTransition() { this.skipped = true; },
      };
      transitions.push(transition);
      return transition;
    } : undefined,
  };
  const win = {
    matchMedia: () => ({ matches: instant }),
    clearTimeout: (id: number) => timers.delete(id),
    setTimeout: (callback: () => void, duration: number) => { const id = timers.size + 1; timers.set(id, { callback, duration }); return id; },
    getComputedStyle: () => ({ backgroundColor: '#fff' }),
  };
  return { doc, win, transitions, timers };
}

test('a light request supersedes an earlier dark request still loading its optional chunk', async () => {
  await environment(async env => {
    const chunk = deferred(), committed: boolean[] = [];
    const controller = createAppearanceTransition(value => committed.push(value), () => chunk.promise);
    const first = controller.switchTo(true);
    await controller.switchTo(false);
    await env.transitions[0].updateCallbackDone;
    chunk.resolve(); await first;
    assert.deepEqual(committed, [false]);
    assert.equal(env.transitions.length, 1);
    controller.dispose();
  });
});

test('a previous transition finishing cannot clear the new transition', async () => {
  await environment(async env => {
    const committed: boolean[] = [];
    const controller = createAppearanceTransition(value => committed.push(value), async () => {});
    await controller.switchTo(true); await env.transitions[0].updateCallbackDone;
    await controller.switchTo(false); await env.transitions[1].updateCallbackDone;
    env.transitions[0].finish(); await Promise.resolve();
    assert.equal(env.transitions[0].skipped, true);
    assert.equal(env.doc.documentElement.dataset.appearanceTransition, 'snapshot');
    assert.equal(isAppearanceMotionPaused(), true);
    assert.deepEqual(committed, [true, false]);
    env.transitions[1].finish(); await Promise.resolve();
    assert.equal(env.doc.documentElement.dataset.appearanceTransition, undefined);
    assert.equal(isAppearanceMotionPaused(), false);
    controller.dispose();
  });
});

test('reduced motion commits immediately without loading optional graphics or creating a transition', async () => {
  await environment(async env => {
    let loads = 0; const committed: boolean[] = [];
    const controller = createAppearanceTransition(value => committed.push(value), async () => { ++loads; });
    await controller.switchTo(true);
    assert.deepEqual(committed, [true]); assert.equal(loads, 0);
    assert.equal(env.transitions.length, 0); assert.equal(env.timers.size, 0);
    controller.dispose();
  }, { instant: true });
});

test('missing API and failed snapshot capture both retain the requested theme with color fallback', async () => {
  for (const options of [{ native: false }, { throws: true }]) await environment(async env => {
    const committed: boolean[] = [];
    const controller = createAppearanceTransition(value => committed.push(value), async () => {});
    await controller.switchTo(true);
    assert.deepEqual(committed, [true]);
    assert.equal(env.doc.documentElement.dataset.appearanceTransition, 'colors');
    const timer = [...env.timers.values()][0];
    assert.equal(timer.duration, APPEARANCE_TRANSITION_MS + 50);
    timer.callback();
    assert.equal(env.doc.documentElement.dataset.appearanceTransition, undefined);
    controller.dispose();
  }, options);
});

test('user interaction during preparation skips only the fade, preserving the requested theme', async () => {
  await environment(async env => {
    const chunk = deferred(), committed: boolean[] = [];
    const controller = createAppearanceTransition(value => committed.push(value), () => chunk.promise);
    const pending = controller.switchTo(true);
    controller.cancel(); chunk.resolve(); await pending;
    assert.deepEqual(committed, [true]); assert.equal(env.transitions.length, 0);
    controller.dispose();
  });
});

test('disposing during graphics preparation cannot apply state after unmount', async () => {
  await environment(async env => {
    const chunk = deferred(), committed: boolean[] = [];
    const controller = createAppearanceTransition(value => committed.push(value), () => chunk.promise);
    const pending = controller.switchTo(true);
    controller.dispose(); chunk.resolve(); await pending;
    assert.deepEqual(committed, []); assert.equal(env.transitions.length, 0);
    assert.equal(env.doc.documentElement.dataset.appearanceTransition, undefined);
  });
});

// Freezing is scoped to the animation, never the theme state or optional renderer.
test('the old view is captured with frozen motion and cancellation releases it immediately', async () => {
  await environment(async env => {
    const controller = createAppearanceTransition(() => {}, async () => {});
    await controller.switchTo(true);
    assert.equal(isAppearanceMotionPaused(), true);
    assert.equal(env.doc.documentElement.dataset.appearanceMotion, 'paused');
    controller.cancel();
    assert.equal(isAppearanceMotionPaused(), false);
    assert.equal(env.doc.documentElement.dataset.appearanceMotion, undefined);
    controller.dispose();
  });
});

test('color fallback and failed capture both unfreeze motion after the fade', async () => {
  for (const options of [{ native: false }, { throws: true }]) await environment(async env => {
    const controller = createAppearanceTransition(() => {}, async () => {});
    await controller.switchTo(true);
    assert.equal(isAppearanceMotionPaused(), true);
    [...env.timers.values()][0].callback();
    assert.equal(isAppearanceMotionPaused(), false);
    controller.dispose();
  }, options);
});

test('a new request waiting on graphics does not leave live text frozen by the cancelled fade', async () => {
  await environment(async env => {
    const chunk = deferred();
    const controller = createAppearanceTransition(() => {}, () => chunk.promise);
    await controller.switchTo(false); await env.transitions[0].updateCallbackDone;
    assert.equal(isAppearanceMotionPaused(), true);
    const pending = controller.switchTo(true);
    assert.equal(isAppearanceMotionPaused(), false);
    chunk.resolve(); await pending; await env.transitions[1].updateCallbackDone;
    assert.equal(isAppearanceMotionPaused(), true);
    controller.dispose();
    assert.equal(isAppearanceMotionPaused(), false);
  });
});
