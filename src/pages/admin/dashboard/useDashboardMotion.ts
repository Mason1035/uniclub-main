import { useRef, useState } from 'react';
import { gsap, useGSAP } from '../../../lib/gsap';

/** One short reveal per mounted chart; hover and range changes never restart it. */
export function useChartReveal(replayKey?: object) {
  const [progress, setProgress] = useState(1);
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add({ animate: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, context => {
      if (context.conditions?.reduce) { setProgress(1); return; }
      const state = { value: 0 };
      setProgress(0);
      gsap.to(state, { value: 1, duration: .55, ease: 'power2.out', onUpdate: () => setProgress(state.value) });
    });
    return () => media.revert();
  }, { dependencies: [replayKey], revertOnUpdate: true });
  return progress;
}
export function useDashboardEntrance() {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('[data-dashboard-enter]', { opacity: 0, y: 12, duration: .4, stagger: .035, ease: 'power2.out', clearProps: 'opacity,transform' });
    }, root);
    return () => media.revert();
  }, { scope: root });
  return root;
}
export function useAnimatedCount(value: number) {
  const node = useRef<HTMLSpanElement>(null);
  const previous = useRef(0);
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add({ animate: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, context => {
      if (!node.current) return;
      if (context.conditions?.reduce) { node.current.textContent = value.toLocaleString('zh-CN'); return; }
      const state = { value: previous.current };
      gsap.to(state, { value, duration: .6, ease: 'power2.out', onUpdate: () => {
        if (node.current) node.current.textContent = Math.round(state.value).toLocaleString('zh-CN');
      } });
      return () => { if (node.current) node.current.textContent = value.toLocaleString('zh-CN'); };
    });
    previous.current = value;
    return () => media.revert();
  }, { dependencies: [value], revertOnUpdate: true });
  return node;
}
