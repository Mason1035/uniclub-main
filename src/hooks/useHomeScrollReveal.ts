import { useRef, type RefObject } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

/** Visible by default; offscreen content is only faded when its trigger plays. */
export function useHomeScrollReveal(scope: RefObject<HTMLDivElement>, revision: string) {
  const played = useRef(new WeakSet<Element>());
  useGSAP((_context, contextSafe) => {
    const root = scope.current;
    if (!root) return;
    const media = gsap.matchMedia();
    media.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)', reduce: '(prefers-reduced-motion: reduce)' }, ({ conditions }) => {
      if (conditions?.reduce || typeof IntersectionObserver === 'undefined') return;
      const regions = root.querySelectorAll<HTMLElement>('.home-announcements, .home-section, .archive-strip');
      const finishers: Array<() => void> = [];
      const timelines = new Map<HTMLElement, gsap.core.Timeline>();
      let observer: IntersectionObserver;
      let frame = 0;
      let alive = true;
      regions.forEach(region => {
        // Loading, error and empty messages are never animated or hidden.
        if (played.current.has(region) || region.querySelector('.content-state')) return;
        const archive = region.classList.contains('home-section') && region.querySelector('.archive-strip');
        const target = archive ? region.querySelector('.section-heading') : region;
        if (!target) return;
        const entries = archive ? [] : Array.from(region.querySelectorAll(':scope > article, :scope > .schedule-list > article, :scope > .archive-entry'));
        const timeline = gsap.timeline({
          paused: true,
          defaults: { ease: 'power2.out', clearProps: 'transform,opacity,visibility' },
          onStart: () => { played.current.add(region); },
        }).fromTo(target, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.34, immediateRender: false });
        if (entries.length > 1) timeline.fromTo(entries, { y: 8, autoAlpha: 0 }, {
          y: 0, autoAlpha: 1, duration: 0.24, stagger: 0.045, immediateRender: false,
        }, 0.12);
        timelines.set(region, timeline);
        const finish = () => {
          observer?.unobserve(region);
          timeline.progress(1);
          played.current.add(region);
        };
        region.addEventListener('focusin', finish);
        finishers.push(() => region.removeEventListener('focusin', finish));
      });
      // Observe visible geometry directly; content/image changes need no global refresh.
      const reveal = contextSafe!((entries: IntersectionObserverEntry[]) => {
        if (!alive) return;
        entries.forEach(({ target, isIntersecting }) => {
          if (!isIntersecting) return;
          observer.unobserve(target);
          if (!played.current.has(target)) timelines.get(target as HTMLElement)?.play(0);
        });
      });
      const observe = () => {
        frame = 0;
        if (!alive) return;
        observer?.disconnect();
        // rootMargin percentages use width; pixels keep the previous 92vh start.
        observer = new IntersectionObserver(reveal, { rootMargin: `0px 0px -${window.innerHeight * 0.08}px 0px` });
        timelines.forEach((_timeline, region) => {
          if (played.current.has(region)) return;
          if (region.getBoundingClientRect().bottom <= 0) played.current.add(region);
          else observer.observe(region);
        });
      };
      const resize = () => { if (!frame) frame = requestAnimationFrame(observe); };
      observe();
      window.addEventListener('resize', resize, { passive: true });
      return () => {
        alive = false;
        observer.disconnect();
        cancelAnimationFrame(frame);
        window.removeEventListener('resize', resize);
        finishers.forEach(remove => remove());
      };
    }, scope);
    return () => media.revert();
  }, { scope, dependencies: [revision], revertOnUpdate: true });
}
