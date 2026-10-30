import type { RefObject } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';
import { attachGlassLens } from '@/lib/graphics/homeGlassLens';

/** Move bounded surface and rim reflections; content and card geometry stay still. */
export function useHomeGlass(scope: RefObject<HTMLElement>, { enabled = true, refraction = true }: { enabled?: boolean; refraction?: boolean } = {}) {
  useGSAP(() => {
    if (!enabled) return;
    const card = scope.current;
    const reflections = Array.from(card?.querySelectorAll<HTMLElement>('.home-card__glass-light, .home-card__glass-sheen') ?? []);
    if (!card || !reflections.length) return;
    const media = gsap.matchMedia();
    media.add({
      desktop: '(hover: hover) and (pointer: fine)',
      lens: '(min-width: 900px)',
      reduce: '(prefers-reduced-motion: reduce)',
      contrast: '(prefers-contrast: more)',
      transparency: '(prefers-reduced-transparency: reduce)',
      forced: '(forced-colors: active)',
    }, ({ conditions }) => {
      if (!conditions?.desktop || conditions.reduce || conditions.contrast || conditions.transparency || conditions.forced) return;
      const disposeLens = refraction && conditions.lens ? attachGlassLens(card) : () => {};
      gsap.set(reflections, { xPercent: -50, yPercent: -50, opacity: 0 });
      const followers = reflections.map(reflection => ({
        xTo: gsap.quickTo(reflection, 'x', { duration: .24, ease: 'power2.out' }),
        yTo: gsap.quickTo(reflection, 'y', { duration: .24, ease: 'power2.out' }),
      }));
      const illumination = gsap.to(reflections, { opacity: 1, duration: .22, ease: 'power2.out', paused: true });
      let bounds: DOMRect | null = null;
      let boundsDirty = false;
      const measure = () => { bounds = card.getBoundingClientRect(); boundsDirty = false; };
      const invalidateBounds = () => { boundsDirty = true; };
      const enter = (event: PointerEvent) => {
        if (event.pointerType === 'touch') return;
        measure();
        const x = event.clientX - bounds!.left;
        const y = event.clientY - bounds!.top;
        followers.forEach(({ xTo, yTo }) => { xTo(x, x); yTo(y, y); });
        illumination.play();
        window.addEventListener('scroll', invalidateBounds, { passive: true });
        window.addEventListener('resize', invalidateBounds, { passive: true });
      };
      const move = (event: PointerEvent) => {
        if (!bounds || event.pointerType === 'touch') return;
        if (boundsDirty) measure();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;
        followers.forEach(({ xTo, yTo }) => { xTo(x); yTo(y); });
      };
      const leave = () => {
        bounds = null;
        illumination.reverse();
        window.removeEventListener('scroll', invalidateBounds);
        window.removeEventListener('resize', invalidateBounds);
      };
      card.addEventListener('pointerenter', enter);
      card.addEventListener('pointermove', move);
      card.addEventListener('pointerleave', leave);
      return () => {
        disposeLens();
        card.removeEventListener('pointerenter', enter);
        card.removeEventListener('pointermove', move);
        card.removeEventListener('pointerleave', leave);
        window.removeEventListener('scroll', invalidateBounds);
        window.removeEventListener('resize', invalidateBounds);
      };
    });
    return () => media.revert();
  }, { scope, dependencies: [enabled, refraction], revertOnUpdate: true });
}
