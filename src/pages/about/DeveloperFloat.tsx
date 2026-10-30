import LiquidGlass from '../../components/LiquidGlass';
import { CSSProperties, KeyboardEvent, useRef, useId } from 'react';
import { flightPoint, gsap, MOTION, ScrollSmoother, ScrollTrigger, useGSAP } from './motion';

export interface Developer { name: string; shape: 'orbit' | 'frame' | 'disc' }
type Options = typeof MOTION;

// 原创 SVG 几何占位，不使用参考站的模型、贴图或人物肖像。
export function Geometry({ shape, id }: { shape: Developer['shape']; id: string }) {
  return <svg className="about-geometry" viewBox="0 0 240 200" aria-hidden="true">
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#fff"/><stop offset=".42" stopColor="#a2acd5" stopOpacity=".7"/>
        <stop offset=".7" stopColor="#e7daee"/><stop offset="1" stopColor="#8393bd"/>
      </linearGradient>
    </defs>
    <g stroke={`url(#${id})`} fill="none" strokeLinecap="round">
      {shape === 'orbit' && <g transform="translate(120 100) rotate(-25)">
        <ellipse rx="78" ry="30" strokeWidth="17"/>
        <ellipse rx="78" ry="30" strokeWidth="13" transform="rotate(65)"/>
        <ellipse rx="78" ry="30" strokeWidth="9" transform="rotate(120)"/>
        <circle r="13" fill={`url(#${id})`} strokeWidth="2"/>
      </g>}
      {shape === 'frame' && <g strokeLinejoin="round" strokeWidth="14">
        <path d="M50 71 122 34 191 73 118 112Z M50 71v73l68 39v-71 M191 73v72l-73 38"/>
        <path d="m84 89 38-19 36 20v40l-40 20-34-20Z" strokeWidth="6" opacity=".8"/>
      </g>}
      {shape === 'disc' && <g transform="translate(120 100) rotate(-32)">
        <ellipse rx="75" ry="59" strokeWidth="25"/>
        <ellipse rx="54" ry="39" strokeWidth="4"/>
        <path d="M-68 23Q0 91 68 23" strokeWidth="14" opacity=".65"/>
      </g>}
    </g>
  </svg>;
}

/** 可独立使用；桌面随滚动穿越弧线，触屏和 reduced-motion 用原生横向列表。 */
export default function DeveloperFloat({ developers, options = MOTION }: {
  developers: Developer[]; options?: Options;
}) {
  const scope = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const navigate = useRef<(key: string) => void>(() => {});

  useGSAP(() => {
    const section = scope.current;
    const view = viewport.current;
    if (!section || !view) return;
    const media = gsap.matchMedia();
    let disposed = false;
    // all 保证手机且未开启 reduced-motion 时也初始化原生列表与键盘操作。
    media.add({ all: 'all', desktop: '(min-width: 900px) and (hover: hover) and (pointer: fine)',
      reduce: '(prefers-reduced-motion: reduce)' }, context => {
      const { desktop, reduce } = context.conditions!;
      const cards = gsap.utils.toArray<HTMLElement>('.about-developer-card', section);
      const positions = gsap.utils.toArray<HTMLElement>('.about-card-position', section);
      const floats = gsap.utils.toArray<HTMLElement>('.about-card-float', section);
      let keyTween: gsap.core.Tween | undefined;
      let timeline: gsap.core.Timeline | undefined;
      view.scrollLeft = 0;

      if (desktop && !reduce) {
        section.classList.add('is-flight');
        view.setAttribute('aria-label', '开发者卡片，向下滚动沿弧线浏览；方向键、Home 和 End 也可控制');
        // 尺寸只在初始化与 refresh 时读取。每帧仅更新 transform，避免布局读取。
        let width = section.clientWidth;
        let height = section.clientHeight;
        const flightStates = positions.map(() => ({ progress: 0 }));
        const setters = positions.map(position => ({
          x: gsap.quickSetter(position, 'x', 'px'), y: gsap.quickSetter(position, 'y', 'px'),
        }));
        const renderFlight = (index: number) => {
          const progress = flightStates[index].progress;
          const point = flightPoint(progress, width, height, options);
          setters[index].x(point.x); setters[index].y(point.y);
          // 玻璃卡片只做平面旋转与等比缩放，避免 Y 轴透视把文字与边框压成梯形。
          // 姿态和位置共用进度，快速跳转、倒放也不会读取另一段 tween 的中间状态。
          const rotation = -options.tiltDegrees * Math.cos(Math.PI * progress);
          const scale = options.minimumScale + (1 - options.minimumScale) * Math.sin(Math.PI * progress);
          cards[index].style.transform = `rotate(${rotation}deg) scale(${scale})`;
        };
        const breath = gsap.to(floats, { y: -options.floatPixels, duration: options.floatSeconds,
          ease: 'sine.inOut', repeat: -1, yoyo: true, stagger: .28, paused: true });
        positions.forEach((_, i) => renderFlight(i));
        timeline = gsap.timeline({ scrollTrigger: {
          trigger: section, start: 'top top', end: () => `+=${window.innerHeight * options.scrollScreens}`,
          pin: true, scrub: options.scrubSeconds,
          onRefresh: () => { width = section.clientWidth; height = section.clientHeight;
            positions.forEach((_, i) => renderFlight(i)); },
          onEnter: () => breath.play(), onEnterBack: () => breath.play(),
          onLeave: () => breath.pause(), onLeaveBack: () => breath.pause(),
        } });
        // 每张卡片独立完整穿越；只动画一个进度，位置和姿态在同一帧更新。
        positions.forEach((_, index) => {
          const start = index * options.cardStagger;
          timeline!.to(flightStates[index], { progress: 1, duration: options.flightDuration,
            ease: 'none', onUpdate: () => renderFlight(index) }, start);
        });
        navigate.current = key => {
          const trigger = timeline?.scrollTrigger;
          if (!trigger) return;
          const target = key === 'Home' ? trigger.start : key === 'End' ? trigger.end :
            gsap.utils.clamp(trigger.start, trigger.end,
              trigger.scroll() + (key === 'ArrowLeft' ? -1 : 1) * (trigger.end - trigger.start) / 6);
          const smoother = ScrollSmoother.get();
          if (smoother) smoother.scrollTo(target, true);
          else window.scrollTo({ top: target, behavior: 'smooth' });
        };
      } else {
        section.classList.remove('is-flight');
        view.setAttribute('aria-label', '开发者卡片，可左右滑动，或使用方向键、Home 和 End');
        // 自由滑动，无吸附、无自动切换；触屏完全保留浏览器原生惯性与纵向手势。
        navigate.current = key => {
          keyTween?.kill();
          const x = key === 'Home' ? 0 : key === 'End' ? view.scrollWidth :
            view.scrollLeft + (key === 'ArrowLeft' ? -1 : 1) * (options.cardWidth + options.gap);
          const target = gsap.utils.clamp(0, view.scrollWidth - view.clientWidth, x);
          if (reduce) view.scrollLeft = target;
          else keyTween = gsap.to(view, { scrollLeft: target, duration: .5, ease: 'power2.out' });
        };
      }
      return () => {
        keyTween?.kill();
        section.classList.remove('is-flight');
        gsap.set([...positions, ...cards], { clearProps: 'transform' }); navigate.current = () => {};
      };
    });
    void document.fonts.ready.then(() => { if (!disposed) ScrollTrigger.refresh(); });
    return () => { disposed = true; media.revert(); };
  }, { scope, dependencies: [developers, options], revertOnUpdate: true });

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); navigate.current(event.key);
  }

  return <section className="about-developer-stage" ref={scope} id="developers" aria-labelledby={titleId}
    style={{ '--card-width': `${options.cardWidth}px`, '--card-gap': `${options.gap}px` } as CSSProperties}>
    <div className="about-stage-top"><span className="about-eyebrow">CLASSHUB / THE PEOPLE</span>
      <p>一个网站的背后，<br/>是一起把想法变成现实的人。</p></div>
    <h2 className="about-team-headline" id={titleId}>GOOD THINGS<br/>DON’T HAPPEN<br/>WITHOUT<br/>A TEAM.</h2>
    <div className="about-developer-viewport" ref={viewport} tabIndex={0} onKeyDown={handleKey} role="region"
      aria-label="开发者卡片，可左右滑动，或使用方向键、Home 和 End">
      <div className="about-developer-track">
        {developers.map((developer, index) => <div className={`about-card-position about-card-position-${index}`} key={developer.name}>
          <div className="about-card-float"><LiquidGlass as="article" optics={false} className="about-developer-card">
            <div className="about-card-top"><span>CLASSHUB / DEVELOPER</span><span>0{index + 1}</span></div>
            <Geometry shape={developer.shape} id={`about-geometry-${index}`}/>
            <div className="about-card-caption"><h3>{developer.name}</h3><p>ClassHub 开发者</p></div>
            <span className="about-placeholder-note">参与构建与运维</span>
          </LiquidGlass></div>
        </div>)}
      </div>
    </div>
    <div className="about-stage-bottom"><span>三个名字，共同构建。</span><span className="about-flight-hint">向下滚动，继续认识我们 ↓</span>
      <span className="about-touch-hint">← 左右滑动 →</span></div>
  </section>;
}
