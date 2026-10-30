import { Children, useCallback, useEffect, useId, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import './modules.css';

export type MMCarouselProps = { children: ReactNode[]; label: string; className?: string };

/** A presentation-only carousel; cards keep their existing data and actions. */
export function MMCarousel({ children, label, className = '' }: MMCarouselProps) {
  const viewportId = useId();
  const slides = Children.toArray(children);
  const [viewport, api] = useEmblaCarousel({
    align: 'start', loop: false, containScroll: 'trimSnaps', slidesToScroll: 1,
    // Embla uses spring time units rather than milliseconds. 36 preserves the
    // reference's roughly 600 ms pacing while keeping touch inertia coherent.
    duration: 36,
    breakpoints: { '(prefers-reduced-motion: reduce)': { duration: 0 } },
  });
  const [previousEnabled, setPreviousEnabled] = useState(false);
  const [nextEnabled, setNextEnabled] = useState(false);
  const [selected, setSelected] = useState(0);
  const [snapCount, setSnapCount] = useState(0);
  const [visibleSlides, setVisibleSlides] = useState<number[]>([0]);

  const update = useCallback(() => {
    if (!api) return;
    setPreviousEnabled(api.canScrollPrev());
    setNextEnabled(api.canScrollNext());
    setSelected(api.selectedScrollSnap());
    setSnapCount(api.scrollSnapList().length);
    setVisibleSlides(api.slidesInView());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    const finishReducedDrag = () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) api.scrollTo(api.selectedScrollSnap(), true);
    };
    update();
    api.on('select', update).on('reInit', update).on('slidesInView', update);
    api.on('pointerUp', finishReducedDrag);
    return () => {
      api.off('select', update).off('reInit', update).off('slidesInView', update);
      api.off('pointerUp', finishReducedDrag);
    };
  }, [api, update]);

  const canScroll = snapCount > 1 && (previousEnabled || nextEnabled);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!canScroll || !api || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    // Embedded forms, media and menus retain their own arrow-key behavior.
    if (target.closest('input, textarea, select, [contenteditable="true"], [role="slider"], [role="menu"], video, audio')) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); api.scrollPrev(); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); api.scrollNext(); }
    else if (event.key === 'Home') { event.preventDefault(); api.scrollTo(0); }
    else if (event.key === 'End') { event.preventDefault(); api.scrollTo(api.scrollSnapList().length - 1); }
  };

  if (!slides.length) return null;

  return <section className={`mm-carousel ${className}`} role="region" aria-roledescription={canScroll ? '轮播' : undefined}
    style={{ '--mm-carousel-item-count': slides.length } as CSSProperties}
    aria-label={label} onKeyDown={onKeyDown}>
    <div className="mm-carousel__viewport" ref={viewport} id={viewportId} tabIndex={canScroll ? 0 : undefined}
      aria-label={canScroll ? `${label}，使用左右方向键切换` : label}>
      <div className="mm-carousel__track">
        {slides.map((child, index) => <div className="mm-carousel__slide" key={index}
          role="group" aria-roledescription="幻灯片" aria-label={`第 ${index + 1} 项，共 ${slides.length} 项`}
          data-visible={visibleSlides.includes(index) ? 'true' : 'false'}>
          {child}
        </div>)}
      </div>
    </div>
    {canScroll && <div className="mm-carousel__controls">
      <div className="mm-carousel__progress" aria-hidden="true">
        <span style={{ width: snapCount ? `${100 / snapCount}%` : '100%', transform: `translateX(${selected * 100}%)` }}/>
      </div>
      <span className="mm-carousel__position" aria-live="polite" aria-atomic="true">
        {Math.min(selected + 1, Math.max(snapCount, 1))}<span aria-hidden="true"> / </span><span className="mm-module-sr-only">，共</span>{Math.max(snapCount, 1)}<span className="mm-module-sr-only">个位置</span>
      </span>
      <div className="mm-carousel__arrows">
        <button type="button" className="mm-carousel__arrow" onClick={() => api?.scrollPrev()}
          disabled={!previousEnabled} aria-label={`${label}：上一项`} aria-controls={viewportId}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 12H4m7-7-7 7 7 7" stroke="currentColor" strokeWidth="1.5"/></svg>
        </button>
        <button type="button" className="mm-carousel__arrow" onClick={() => api?.scrollNext()}
          disabled={!nextEnabled} aria-label={`${label}：下一项`} aria-controls={viewportId}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h16m-7-7 7 7-7 7" stroke="currentColor" strokeWidth="1.5"/></svg>
        </button>
      </div>
    </div>}
  </section>;
}
