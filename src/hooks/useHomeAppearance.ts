import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { createAppearanceTransition } from '../lib/appearanceTransition';
import { setAppearanceMotionPaused } from '../lib/appearanceMotion';
import { hasConsent, subscribeConsent } from '../lib/privacy/consent';

const STORAGE_KEY = 'classhub.home.appearance';

function savedStarfield() {
  if (typeof window === 'undefined' || !hasConsent('preferences')) return false;
  try { return window.localStorage.getItem(STORAGE_KEY) === 'starry'; }
  catch { return false; }
}

/** Shared appearance; retain the existing consent-gated key for saved homepage choices. */
export function useHomeAppearance() {
  const [starry, setStarry] = useState(savedStarfield);
  const desired = useRef(starry);
  const transition = useRef<ReturnType<typeof createAppearanceTransition> | null>(null);
  const changeAppearance = useCallback((next: boolean) => {
    desired.current = next;
    if (transition.current) void transition.current.switchTo(next);
    else setStarry(next);
  }, []);

  useEffect(() => {
    const controller = createAppearanceTransition(next => flushSync(() => setStarry(next)),
      undefined, paused => {
        if (paused) flushSync(() => setAppearanceMotionPaused(true));
        else setAppearanceMotionPaused(false);
      });
    transition.current = controller;
    const interrupt = () => controller.cancel();
    const visibility = () => { if (document.hidden) interrupt(); };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce), (forced-colors: active)');
    // Normal scrolling, navigation and typing take priority over a decorative fade.
    window.addEventListener('pointerdown', interrupt, { passive: true });
    window.addEventListener('keydown', interrupt);
    window.addEventListener('scroll', interrupt, { passive: true });
    window.addEventListener('resize', interrupt, { passive: true });
    window.addEventListener('popstate', interrupt);
    document.addEventListener('visibilitychange', visibility);
    reduced.addEventListener('change', interrupt);
    return () => {
      controller.dispose();
      transition.current = null;
      window.removeEventListener('pointerdown', interrupt);
      window.removeEventListener('keydown', interrupt);
      window.removeEventListener('scroll', interrupt);
      window.removeEventListener('resize', interrupt);
      window.removeEventListener('popstate', interrupt);
      document.removeEventListener('visibilitychange', visibility);
      reduced.removeEventListener('change', interrupt);
    };
  }, []);

  useEffect(() => {
    const persist = () => {
      try {
        if (hasConsent('preferences')) window.localStorage.setItem(STORAGE_KEY, starry ? 'starry' : 'light');
        else window.localStorage.removeItem(STORAGE_KEY);
      } catch { /* The switch still works when storage is unavailable. */ }
    };
    persist();
    return subscribeConsent(persist);
  }, [starry]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (hasConsent('preferences') && (event.key === STORAGE_KEY || event.key === null)) changeAppearance(savedStarfield());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [changeAppearance]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', starry);
    root.style.colorScheme = starry ? 'dark' : 'light';
    if (starry) root.setAttribute('data-home-appearance', 'starry');
    else root.removeAttribute('data-home-appearance');
    return () => {
      root.removeAttribute('data-home-appearance');
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    };
  }, [starry]);

  const toggle = useCallback(() => changeAppearance(!desired.current), [changeAppearance]);
  return { starry, toggle };
}
