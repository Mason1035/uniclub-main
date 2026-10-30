import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { gsap, useGSAP } from '../../lib/gsap';
import './modules.css';

const SECTIONS = [
  { to: '/announcements', label: '班级公告' },
  { to: '/news', label: '新闻资讯' },
  { to: '/events', label: '班级活动' },
  { to: '/resources', label: '学习资源' },
  { to: '/social', label: '班级交流' },
  { to: '/functions', label: '日常事务' },
  { to: '/about', label: '认识 ClassHub' },
];

/** MindMarket-style rail. Only public column labels enter the animation. */
export function MMMarquee({ className = '' }: { className?: string }) {
  const scope = useRef<HTMLElement>(null);
  const pausedByUser = useRef(false);
  const syncPlayback = useRef<(() => void) | null>(null);
  const [paused, setPaused] = useState(false);
  pausedByUser.current = paused;

  useEffect(() => { syncPlayback.current?.(); }, [paused]);

  useGSAP(() => {
    const root = scope.current;
    const track = root?.querySelector<HTMLElement>('.mm-marquee__track');
    const group = root?.querySelector<HTMLElement>('.mm-marquee__group');
    if (!root || !track || !group) return;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const setX = gsap.quickSetter(track, 'x', 'px');
      let disposed = false;
      let visible = false;
      let hovered = false;
      let focused = false;
      let running = false;
      let distance = 0;
      let width = 1;
      let direction = 1;
      let scrollBoost = 0;
      let previousScroll = window.scrollY;
      let previousScrollAt = performance.now();
      const measure = () => {
        width = Math.max(1, group.getBoundingClientRect().width);
        distance = gsap.utils.wrap(-width, 0, distance);
        setX(distance);
      };
      const tick = (_time: number, deltaMs: number) => {
        // Clamp resuming frames so background tabs never cause a visible jump.
        const seconds = Math.min(deltaMs, 50) / 1000;
        scrollBoost *= Math.exp(-seconds * 3.5);
        distance = gsap.utils.wrap(-width, 0, distance - direction * (38 + scrollBoost) * seconds);
        setX(distance);
      };
      const sync = () => {
        const shouldRun = visible && !document.hidden && !hovered && !focused && !pausedByUser.current;
        if (shouldRun === running) return;
        running = shouldRun;
        root.dataset.running = String(running);
        if (running) gsap.ticker.add(tick);
        else gsap.ticker.remove(tick);
      };
      syncPlayback.current = sync;
      const onScroll = () => {
        const now = performance.now();
        const next = window.scrollY;
        const delta = next - previousScroll;
        if (delta !== 0) {
          direction = delta > 0 ? 1 : -1;
          scrollBoost = Math.min(220, Math.abs(delta) / Math.max(16, now - previousScrollAt) * 28);
        }
        previousScroll = next;
        previousScrollAt = now;
      };
      const onEnter = () => { hovered = true; sync(); };
      const onLeave = () => { hovered = false; sync(); };
      const onFocus = () => {
        focused = true;
        // Keep the original, keyboard-accessible track fully in view.
        distance = 0;
        setX(0);
        sync();
      };
      const onBlur = (event: FocusEvent) => {
        if (event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return;
        focused = false;
        sync();
      };
      const observer = new IntersectionObserver(entries => {
        visible = entries[0]?.isIntersecting ?? false;
        sync();
      }, { threshold: 0 });
      const resize = new ResizeObserver(measure);
      measure();
      observer.observe(root);
      resize.observe(group);
      void document.fonts.ready.then(() => { if (!disposed) measure(); });
      window.addEventListener('scroll', onScroll, { passive: true });
      document.addEventListener('visibilitychange', sync);
      root.addEventListener('pointerenter', onEnter);
      root.addEventListener('pointerleave', onLeave);
      root.addEventListener('focusin', onFocus);
      root.addEventListener('focusout', onBlur);
      return () => {
        disposed = true;
        syncPlayback.current = null;
        gsap.ticker.remove(tick);
        observer.disconnect();
        resize.disconnect();
        window.removeEventListener('scroll', onScroll);
        document.removeEventListener('visibilitychange', sync);
        root.removeEventListener('pointerenter', onEnter);
        root.removeEventListener('pointerleave', onLeave);
        root.removeEventListener('focusin', onFocus);
        root.removeEventListener('focusout', onBlur);
        delete root.dataset.running;
        gsap.set(track, { clearProps: 'transform' });
      };
    });
    return () => { media.revert(); };
  }, { scope });

  return <section className={`mm-marquee ${className}`} ref={scope} aria-label="班级栏目">
    <div className="mm-marquee__viewport">
      <div className="mm-marquee__track">
        <div className="mm-marquee__group">
          {SECTIONS.map(section => <Link className="mm-marquee__item" key={section.to} to={section.to}>
            <span>{section.label}</span><span className="mm-marquee__flower" aria-hidden="true">✳</span>
          </Link>)}
        </div>
        <div className="mm-marquee__group mm-marquee__group--clone" aria-hidden="true">
          {SECTIONS.map(section => <Link className="mm-marquee__item" key={section.to} to={section.to} tabIndex={-1}>
            <span>{section.label}</span><span className="mm-marquee__flower" aria-hidden="true">✳</span>
          </Link>)}
        </div>
      </div>
    </div>
    <button className="mm-marquee__pause" type="button" onClick={() => setPaused(value => !value)}
      aria-label={paused ? '继续栏目滚动' : '暂停栏目滚动'} aria-pressed={paused}>
      {paused ? <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="m6 3 11 7-11 7z"/></svg>
        : <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5 3h3v14H5zm7 0h3v14h-3z"/></svg>}
    </button>
  </section>;
}
