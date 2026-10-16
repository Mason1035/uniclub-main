import { setAppearanceMotionPaused } from './appearanceMotion';

export const APPEARANCE_TRANSITION_MS = 1500;

let starfieldImport: ReturnType<typeof importStarfield> | undefined;
const importStarfield = () => import('../components/home/HomeStarfield').catch(() => ({ default: () => null }));

/** Share the optional chunk with React.lazy so the first dark snapshot has stars. */
export function loadHomeStarfield() {
  return starfieldImport ??= importStarfield();
}

function waitForStarfield() {
  const ready = () => document.querySelector('.home-starfield[data-ready="true"], .home-starfield[data-ready="false"]');
  if (ready()) return Promise.resolve();
  return new Promise<void>(resolve => {
    const finish = () => { observer.disconnect(); window.clearTimeout(timer); resolve(); };
    const observer = new MutationObserver(() => { if (ready()) finish(); });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-ready'] });
    // A failed or slow optional canvas must never hold up the interface.
    const timer = window.setTimeout(finish, 240);
  });
}

/** Latest intent wins, including clicks during chunk loading or snapshot capture. */
export function createAppearanceTransition(commit: (dark: boolean) => void,
  prepareDark: () => Promise<unknown> = loadHomeStarfield,
  freezeMotion: (paused: boolean) => void = setAppearanceMotionPaused) {
  let revision = 0;
  let skipThrough = 0;
  let disposed = false;
  let active: ReturnType<Document['startViewTransition']> | undefined;
  let colorTimer: number | undefined;
  const root = document.documentElement;
  const instant = () => document.hidden || window.matchMedia('(prefers-reduced-motion: reduce), (forced-colors: active)').matches;
  const clearColors = () => { window.clearTimeout(colorTimer); colorTimer = undefined; };
  const freeze = (paused: boolean) => {
    if (paused) root.dataset.appearanceMotion = 'paused';
    else delete root.dataset.appearanceMotion;
    freezeMotion(paused);
  };

  const switchTo = async (dark: boolean) => {
    const id = ++revision;
    const previous = active;
    previous?.skipTransition();
    clearColors();
    // Resume between requests while an optional chunk is still loading.
    freeze(false);
    if (dark && !instant()) {
      try { await prepareDark(); } catch { /* Optional artwork does not block the theme. */ }
    }
    if (previous) await previous.updateCallbackDone.catch(() => {});
    if (disposed || id !== revision) return;
    let committed = false;
    const apply = () => {
      if (!committed && !disposed && id === revision) { committed = true; commit(dark); }
    };
    const finish = () => {
      if (id === revision) { delete root.dataset.appearanceTransition; active = undefined; freeze(false); }
    };
    if (instant() || id <= skipThrough) {
      finish(); apply(); return;
    }
    // Freeze before the OLD snapshot, then keep the exact text and caret until done.
    freeze(true);
    if (typeof document.startViewTransition === 'function') {
      root.dataset.appearanceTransition = 'snapshot';
      try {
        const transition = document.startViewTransition(async () => {
          apply();
          if (dark && committed && !disposed) await waitForStarfield();
        });
        active = transition;
        // A skipped/cancelled animation still performs its DOM update.
        void transition.ready.catch(() => {});
        void transition.finished.then(finish, finish);
        return;
      } catch { /* Fall back to color interpolation if capture cannot start. */ }
    }
    root.dataset.appearanceTransition = 'colors';
    // Resolve the fallback rules before changing tokens; this is one style read.
    void window.getComputedStyle(document.body).backgroundColor;
    apply();
    colorTimer = window.setTimeout(finish, APPEARANCE_TRANSITION_MS + 50);
  };

  const cancel = () => {
    skipThrough = revision;
    active?.skipTransition();
    clearColors();
    delete root.dataset.appearanceTransition;
    freeze(false);
  };
  return {
    switchTo,
    cancel,
    dispose() { disposed = true; ++revision; cancel(); },
  };
}
