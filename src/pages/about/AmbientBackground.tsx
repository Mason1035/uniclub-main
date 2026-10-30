import { useRef } from 'react';
import { gsap, ScrollTrigger, useGSAP } from './motion';

/** 固定底色 + 三层原创柔光；每层只有一套位移，不旋转或放大全屏纹理。 */
export default function AmbientBackground() {
  const scope = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const background = scope.current!;
      const layers = gsap.utils.toArray<HTMLElement>('.about-ambient-drift', background);
      const state = { progress: 0 };
      let elapsed = 0;
      background.classList.add('is-animated');

      // 直接使用页面可滚动范围，避免把 ScrollSmoother 正在变换的正文当作测量基准。
      gsap.to(state, { progress: 1, ease: 'none', scrollTrigger: {
        start: 0, end: () => Math.max(1, ScrollTrigger.maxScroll(window)), scrub: 1.3,
      } });

      // 漂移与滚动先合成数值，每帧每层只写一次 transform。
      // 始终使用同一种平移矩阵，避免动画端点切换 2D / 3D 合成方式。
      const render = (_time: number, deltaMs: number) => {
        if (document.hidden) return;
        // 切回标签页或掉帧后限制时间增量，柔光不会突然跳到另一位置。
        elapsed += Math.min(deltaMs, 64) / 1000;
        layers.forEach((layer, index) => {
          const phase = elapsed * Math.PI * 2 / (22 + index * 5) + index * 1.8;
          const x = Math.sin(phase) * 1.6 + state.progress * [-3.5, 2, 1][index];
          const y = Math.cos(phase) * 1.4 + state.progress * [2.5, -2, 1][index];
          layer.style.transform = `translate3d(${x}%, ${y}%, 0)`;
        });
      };
      render(0, 0);
      gsap.ticker.add(render);
      return () => {
        gsap.ticker.remove(render);
        background.classList.remove('is-animated');
        layers.forEach(layer => layer.style.removeProperty('transform'));
      };
    });
    return () => media.revert();
  }, { scope });
  return <div className="about-ambient-background" ref={scope} aria-hidden="true">
    <div className="about-ambient-drift about-ambient-blue"/>
    <div className="about-ambient-drift about-ambient-rose"/>
    <div className="about-ambient-drift about-ambient-silver"/>
  </div>;
}
