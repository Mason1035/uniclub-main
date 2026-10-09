import { useRef } from 'react';
import { gsap, useGSAP } from '../lib/gsap';
import {
  isFirstFoldVisible, PRELOADER_DONE, PRELOADER_TIMING,
  waitForEntry, waitForLogoReveal, type PreloaderState,
} from '../lib/preloader';

/** Adopt the first-paint HTML layer; React never mounts a second overlay or logo. */
export default function BrandPreloader() {
  const scope = useRef(document.getElementById('root'));
  useGSAP((context, contextSafe) => {
    const boot = window.__classhubPreloader;
    const layer = document.getElementById('classhub-preloader');
    const logo = layer?.querySelector<HTMLImageElement>('img');
    const root = scope.current;
    if (!boot || boot.state === 'done' || !layer || !logo || !root) return;
    const controller = new AbortController();
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let active = true;
    const stage = (state: PreloaderState) => {
      boot.state = state;
      document.documentElement.dataset.classhubPreloader = state;
    };
    const finish = () => {
      if (!active) return;
      active = false;
      controller.abort();
      // Kill the sequence and restore only properties owned by this GSAP context.
      // Tab/focus, the HTML safety release and motion preference changes use this too.
      context.revert();
      window.removeEventListener(PRELOADER_DONE, finish);
      media.removeEventListener('change', finish);
      boot.finish();
      window.dispatchEvent(new Event('resize'));
    };
    window.addEventListener(PRELOADER_DONE, finish);
    media.addEventListener('change', finish);
    const exit = contextSafe(() => {
      if (!active || boot.state === 'done') return;
      controller.abort(); // Release losing resource waits on the 4-second deadline path.
      stage('exiting'); // Hand the completed HTML/CSS intro over to GSAP.
      const timing = PRELOADER_TIMING;
      if (media.matches) {
        gsap.to(layer, { opacity: 0, duration: timing.reducedFadeMs / 1000, ease: 'none', onComplete: finish });
        return;
      }

      // Animate first-fold content blocks, never #root/main: transforming either
      // would change the containing block of fixed navigation or modal controls.
      const main = root.querySelector('main');
      const home = main?.querySelector('.home-page');
      const page = main?.children.length === 1 && main.firstElementChild?.tagName === 'DIV'
        ? main.firstElementChild : main;
      const candidates = home
        ? Array.from(home.querySelectorAll<HTMLElement>(':scope > .hero > *, :scope > .home-card-grid'))
        : Array.from(page?.children || []);
      const content = candidates.filter(isFirstFoldVisible).slice(0, 6);
      const slideAt = timing.logoExitMs / 1000;
      const timeline = gsap.timeline({ onComplete: finish });
      timeline.to(logo, {
        scale: 0.84, y: -12, duration: slideAt, ease: 'power2.inOut',
      }, 0);
      timeline.to(layer, {
        yPercent: -100, duration: timing.overlayExitMs / 1000, ease: 'power4.inOut',
      }, slideAt);
      if (content.length) timeline.fromTo(content, {
        y: 32, opacity: 0, willChange: 'transform,opacity',
      }, {
        y: 0, opacity: 1, duration: timing.contentEnterMs / 1000,
        stagger: timing.contentStaggerMs / 1000, ease: 'power3.out',
        clearProps: 'transform,opacity,willChange',
      }, slideAt);
    });
    // CSS starts before the application chunk. Adopt its clock, including slow
    // logo downloads, rather than replaying the intro when React mounts.
    void waitForLogoReveal(boot, controller.signal, media.matches)
      .then(() => { if (active && boot.state === 'revealing') stage('waiting'); });
    void waitForEntry(boot, controller.signal, media.matches).then(exit, exit);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener(PRELOADER_DONE, finish);
      media.removeEventListener('change', finish);
      // StrictMode replays setup; only the HTML boot owns the session claim,
      // scroll lock and fallback deadline. Effect cleanup must not finish it.
    };
  }, { scope });
  return null;
}
