import { useEffect, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { PRELOADER_DONE } from '@/lib/preloader';
import { gsap, MOTION, ScrollSmoother, ScrollTrigger, useGSAP } from './motion';

/** 所有动画归属当前 About 生命周期；离开路由时还原 body 高度与滚动样式。 */
export function useAboutMotion(scope: RefObject<HTMLDivElement>) {
  const { hash, key } = useLocation();
  useGSAP(() => {
    const root = scope.current;
    const shell = root?.closest('.site-shell--about');
    const wrapper = shell?.querySelector<HTMLElement>('#about-scroll-wrapper');
    const content = shell?.querySelector<HTMLElement>('#about-scroll-content');
    if (!root || !shell || !wrapper || !content) return;
    const media = gsap.matchMedia();
    let disposed = false;

    // 手机、触屏和减少动态效果使用原生滚动；弹窗和底部导航保持固定。
    media.add('(min-width: 900px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', context => {
      const bodyHeight = document.body.style.height;
      const bodyScroll = document.body.style.scrollBehavior;
      const rootScroll = document.documentElement.style.scrollBehavior;
      let smoother: ScrollSmoother;
      shell.classList.add('about-smoothing');
      // 插件自身负责还原 wrapper/content。避免媒体 context 再还原创建后的 body 高度。
      context.ignore(() => {
        smoother = ScrollSmoother.create({ wrapper, content,
          smooth: MOTION.smoothSeconds, smoothTouch: 0, effects: false });
      });
      return () => {
        smoother.kill();
        document.body.style.height = bodyHeight;
        document.body.style.scrollBehavior = bodyScroll;
        document.documentElement.style.scrollBehavior = rootScroll;
        shell.classList.remove('about-smoothing');
      };
    });
    media.add('(prefers-reduced-motion: no-preference)', () => {
      root.querySelectorAll<HTMLElement>('.about-chapter, .about-end').forEach(chapter => {
        gsap.from(chapter.querySelectorAll('.about-chapter-heading, .about-chapter-body > *, .about-end-copy > *'), {
          y: 22, opacity: 0.72, duration: 0.75, stagger: 0.06, ease: 'power2.out',
          scrollTrigger: { trigger: chapter, start: 'top 85%', once: true },
        });
      });
    });
    const refresh = () => { if (!disposed) ScrollTrigger.refresh(); };
    void document.fonts.ready.then(refresh);
    window.addEventListener(PRELOADER_DONE, refresh);
    refresh();
    return () => {
      disposed = true;
      window.removeEventListener(PRELOADER_DONE, refresh);
      media.revert();
    };
  }, { scope });

  // 真正的 Router hash 保留浏览器历史；首次进入等待字体和品牌覆盖层完成。
  useEffect(() => {
    if (!hash) return;
    let disposed = false;
    const jump = async () => {
      await document.fonts.ready;
      if (disposed) return;
      const target = scope.current?.querySelector<HTMLElement>(`[id="${hash.slice(1).replace(/[^a-zA-Z0-9_-]/g, '')}"]`);
      if (!target) return;
      ScrollTrigger.refresh();
      const smoother = ScrollSmoother.get();
      if (smoother) smoother.scrollTo(target, true, 'top top');
      else target.scrollIntoView({ block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    };
    const onReady = () => { void jump(); };
    const boot = window.__classhubPreloader;
    if (boot && boot.state !== 'done') window.addEventListener(PRELOADER_DONE, onReady, { once: true });
    else onReady();
    return () => { disposed = true; window.removeEventListener(PRELOADER_DONE, onReady); };
  }, [hash, key, scope]);
}
