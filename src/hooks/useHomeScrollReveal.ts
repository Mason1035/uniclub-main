import { useRef, type RefObject } from 'react';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';

/** Visible by default; offscreen content is only faded when its trigger plays. */
export function useHomeScrollReveal(scope: RefObject<HTMLDivElement>, revision: string) {
  const played = useRef(new WeakSet<Element>());
  useGSAP(() => {
    const root = scope.current;
    if (!root) return;
    const media = gsap.matchMedia();
    media.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)', reduce: '(prefers-reduced-motion: reduce)' }, ({ conditions }) => {
      if (conditions?.reduce) return;
      const regions = root.querySelectorAll<HTMLElement>('.home-announcements, .home-section, .archive-strip');
      const finishers: Array<() => void> = [];
      regions.forEach(region => {
        // Loading, error and empty messages are never animated or hidden.
        if (played.current.has(region) || region.querySelector('.content-state')) return;
        const archive = region.classList.contains('home-section') && region.querySelector('.archive-strip');
        const target = archive ? region.querySelector('.section-heading') : region;
        if (!target) return;
        const entries = archive ? [] : Array.from(region.querySelectorAll(':scope > article, :scope > .schedule-list > article, :scope > .archive-entry'));
        const timeline = gsap.timeline({
          scrollTrigger: { trigger: region, start: 'top 92%', once: true },
          defaults: { ease: 'power2.out', clearProps: 'transform,opacity,visibility' },
          onStart: () => { played.current.add(region); },
        }).fromTo(target, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.34, immediateRender: false });
        if (entries.length > 1) timeline.fromTo(entries, { y: 8, autoAlpha: 0 }, {
          y: 0, autoAlpha: 1, duration: 0.24, stagger: 0.045, immediateRender: false,
        }, 0.12);
        const finish = () => { timeline.progress(1); played.current.add(region); };
        region.addEventListener('focusin', finish);
        finishers.push(() => region.removeEventListener('focusin', finish));
      });
      return () => finishers.forEach(remove => remove());
    }, scope);
    // Async content and image loading may move trigger positions.
    let frame = 0;
    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => ScrollTrigger.refresh());
    };
    const observer = new ResizeObserver(refresh);
    observer.observe(root);
    root.addEventListener('load', refresh, true);
    refresh();
    return () => {
      observer.disconnect();
      root.removeEventListener('load', refresh, true);
      cancelAnimationFrame(frame);
      media.revert();
    };
  }, { scope, dependencies: [revision], revertOnUpdate: true });
}
