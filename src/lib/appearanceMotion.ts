let paused = false;
const listeners = new Set<() => void>();

/** Only live decorative text subscribes; theme changes do not rerender the page. */
export function isAppearanceMotionPaused() { return paused; }
export function setAppearanceMotionPaused(next: boolean) {
  if (paused === next) return;
  paused = next;
  listeners.forEach(listener => listener());
}
export function subscribeAppearanceMotion(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
