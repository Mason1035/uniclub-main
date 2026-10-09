/** CSS tokens remain the single source of truth for component timing. */
export type MotionKind = 'fast' | 'panel' | 'structural' | 'exit';
export const motionEase = 'power2.out';
export const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(reducedMotionQuery).matches;
}

/** GSAP expects seconds; the shared CSS values use milliseconds. Read on events, not frames. */
export function motionDuration(kind: MotionKind): number {
  if (typeof document === 'undefined') return 0;
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--motion-${kind}`).trim();
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? amount / (value.endsWith('ms') ? 1000 : 1) : 0;
}
