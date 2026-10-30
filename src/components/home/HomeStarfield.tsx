import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { HomeStarfieldRenderer } from '../../lib/graphics/HomeStarfieldRenderer';
import { PRELOADER_DONE } from '../../lib/preloader';
import fallback from '../../assets/home/starfield-fallback.svg';

/** Decorative only: never intercepts navigation, pointer input, or touch scrolling. */
export default function HomeStarfield() {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<HomeStarfieldRenderer | null>(null);

  // Capture the first star frame before the theme transition takes its new view.
  useLayoutEffect(() => {
    if (!host.current || !canvas.current) return;
    try {
      renderer.current = new HomeStarfieldRenderer(canvas.current, {
        host: host.current,
        active: !window.__classhubPreloader || window.__classhubPreloader.state === 'done',
      });
    } catch {
      // A failed canvas leaves the original static star image and all copy readable.
      host.current.dataset.ready = 'false';
    }
    const reveal = () => renderer.current?.setActive(true);
    window.addEventListener(PRELOADER_DONE, reveal);
    return () => {
      window.removeEventListener(PRELOADER_DONE, reveal);
      renderer.current?.dispose();
      renderer.current = null;
    };
  }, []);

  return <div ref={host} className="home-starfield" data-ready="loading" aria-hidden="true"
    style={{ '--home-starfield-fallback': `url("${fallback}")` } as CSSProperties}>
    <canvas ref={canvas} className="home-starfield__canvas"/>
    <div className="home-starfield__ambient"/>
    <div className="home-starfield__vignette"/>
  </div>;
}
