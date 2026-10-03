import { useRef, type RefObject } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

export function useCalendarMotion(scope: RefObject<HTMLElement>, date: string, selected: string, direction: RefObject<number>) {
  const previous = useRef({ date, selected });
  useGSAP(() => {
    const monthChanged = previous.current.date !== date;
    const dayChanged = previous.current.selected !== selected;
    previous.current = { date, selected };
    if (!monthChanged && !dayChanged) return;
    const media = gsap.matchMedia();
    media.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)', reduce: '(prefers-reduced-motion: reduce)' }, ({ conditions }) => {
      if (conditions?.reduce || !scope.current) return;
      const select = gsap.utils.selector(scope);
      const timeline = gsap.timeline({ defaults: { ease: 'power2.out', clearProps: 'transform,opacity,visibility' } });
      if (monthChanged) timeline.fromTo(select('.calendar-month-body'), {
        autoAlpha: 0, x: (direction.current || 0) * (conditions?.mobile ? 10 : 16),
      }, { autoAlpha: 1, x: 0, duration: direction.current ? 0.24 : 0.18 }, 0);
      if (dayChanged) timeline.fromTo(select('.calendar-agenda'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 0);
      const root = scope.current;
      const finish = () => { timeline.progress(1); };
      root.addEventListener('focusin', finish);
      return () => root.removeEventListener('focusin', finish);
    }, scope);
    return () => media.revert();
  }, { scope, dependencies: [date, selected], revertOnUpdate: true });
}
