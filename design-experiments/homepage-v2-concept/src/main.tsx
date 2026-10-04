import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { events, moments, nav, resources, timeline, todayStory, type Detail } from './content';
import './styles.css';

type Theme = 'light' | 'dark';
type Motion = 'full' | 'reduced';
type Panel = 'menu' | 'review' | Detail | null;
const themeKey = 'classhub-homepage-concept-theme';
const motionKey = 'classhub-homepage-concept-motion';

function savedMotion(): Motion {
  try { return localStorage.getItem(motionKey) === 'reduced' ? 'reduced' : 'full'; }
  catch { return 'full'; }
}

function Dialog({ title, children, onClose, kind }: { title: string; children: ReactNode; onClose: () => void; kind: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} className={`dialog dialog-${kind}`} aria-labelledby="dialog-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onKeyDown={(event) => {
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')].filter(element => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog-shell">
      <div className="dialog-top"><span className="meta">ClassHub / 概念首页</span><button autoFocus className="close-button" onClick={onClose} aria-label="关闭对话框">关闭 <span aria-hidden="true">×</span></button></div>
      <h2 id="dialog-title">{title}</h2>
      {children}
    </div>
  </dialog>;
}

function Arrow({ direction = 'down' }: { direction?: 'down' | 'right' }) {
  return <svg className={`arrow arrow-${direction}`} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v17m-6-6 6 6 6-6" stroke="currentColor" strokeWidth="1.25" /></svg>;
}

function App() {
  const [theme, setTheme] = useState<Theme>(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  const [motion, setMotion] = useState<Motion>(savedMotion);
  const [osReduced, setOsReduced] = useState(matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [grid, setGrid] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [year, setYear] = useState(0);
  const [greeting, setGreeting] = useState(false);
  const [fontState, setFontState] = useState('正在加载');
  const [viewport, setViewport] = useState(window.innerWidth);
  const arrival = useRef<HTMLHeadingElement>(null);
  const mascot = useRef<HTMLButtonElement>(null);
  const played = useRef(false);
  const reduced = osReduced || motion === 'reduced';

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setOsReduced(media.matches);
    media.addEventListener('change', changed);
    const resized = () => setViewport(window.innerWidth);
    window.addEventListener('resize', resized);
    return () => { media.removeEventListener('change', changed); window.removeEventListener('resize', resized); };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#F1F0E9' : '#212622');
    try { localStorage.setItem(themeKey, theme); } catch { /* Optional preference. */ }
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full';
    try { localStorage.setItem(motionKey, motion); } catch { /* Optional preference. */ }
    if (reduced) document.getAnimations().forEach(animation => animation.cancel());
  }, [motion, reduced]);

  useEffect(() => {
    let disposed = false;
    Promise.all([
      document.fonts.load('500 48px "Concept Han Serif"', '在一起在发生'),
      document.fonts.load('400 16px "Concept Han Sans"', '班级共学'),
      document.fonts.load('400 24px "Concept Smiley"', '明天见'),
      document.fonts.load('600 32px "Concept Grotesk"', 'ClassHub 2026'),
    ]).then(results => { if (!disposed) setFontState(results.every(result => result.length > 0) ? '4 / 4 本地字体已加载' : '字体加载不完整'); });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const animations: Animation[] = [];
    document.fonts.ready.then(() => {
      if (cancelled || reduced || played.current) return;
      played.current = true;
      arrival.current?.querySelectorAll('.arrival-line').forEach((line, index) => {
        animations.push(line.animate([
          { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' },
        ], { duration: 650, delay: index * 90, easing: 'cubic-bezier(.16,1,.3,1)' }));
      });
    });
    return () => { cancelled = true; animations.forEach(animation => animation.cancel()); };
  }, [reduced]);

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const visible = new Map<number, number>();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const index = Number((entry.target as HTMLElement).dataset.timelineIndex);
        if (entry.isIntersecting) visible.set(index, entry.boundingClientRect.top);
        else visible.delete(index);
      });
      const next = [...visible].sort((a, b) => a[1] - b[1])[0];
      if (next) setYear(next[0]);
    }, { rootMargin: '-12% 0px -38% 0px', threshold: 0 });
    document.querySelectorAll('[data-timeline-index]').forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const openEvent = (index: number) => {
    const event = events[index];
    setPanel({ title: event.title, meta: `2026.10.${event.day} / ${event.time} / ${event.category} / 示例安排`, paragraphs: event.paragraphs });
  };

  const greet = () => {
    setGreeting(value => !value);
    if (!reduced) mascot.current?.querySelector('svg')?.animate([
      { transform: 'rotate(0deg)' }, { transform: 'rotate(-9deg)' }, { transform: 'rotate(5deg)' }, { transform: 'rotate(0deg)' },
    ], { duration: 450, easing: 'ease-in-out' });
  };

  return <>
    <a className="skip-link" href="#main">跳到正文</a>
    <header className="site-header wrap" id="top">
      <a href="#top" className="wordmark" aria-label="ClassHub 首页">CLASSHUB</a>
      <span className="prototype-label">概念首页 <span>本地示例</span></span>
      <nav aria-label="首页导航" className="desktop-nav">{nav.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav>
      <button className="menu-button" aria-haspopup="dialog" onClick={() => setPanel('menu')}>目录 <span aria-hidden="true">+</span></button>
    </header>

    <main id="main" tabIndex={-1}>
      <section className="arrival wrap" id="arrival" aria-labelledby="arrival-title" data-beat="Arrival">
        <div className="arrival-identity grid"><p>软件工程班级<br /><span className="muted">一个真正活着的数字班级。</span></p><p className="edition meta">秋季 / 2026<br />Homepage concept</p></div>
        <div className="arrival-composition">
          <h1 ref={arrival} id="arrival-title"><span className="arrival-line">在一起。</span><span className="arrival-line">在发生。</span></h1>
          <p className="arrival-latin" lang="en">a class, <br />in time.</p>
        </div>
        <div className="arrival-bottom grid">
          <div className="arrival-date"><span className="day">03</span><div><span>十月 / 2026</span><span className="meta muted">原型日期</span></div></div>
          <p className="arrival-intro">今天的相聚，<br />会成为明天的记忆。</p>
          <a className="today-link" href="#now">从今天开始 <Arrow /></a>
        </div>
      </section>

      <section id="now" className="now" aria-labelledby="now-title" data-beat="NOW">
        <div className="now-heading grid wrap">
          <div className="now-date"><span className="meta">此刻 / Now</span><time dateTime="2026-10-03">10.03</time><span className="meta muted">星期六 / 示例记录</span></div>
          <h2 id="now-title">下课以后，<br />把秋天多留<br />了一会儿。</h2>
          <div className="now-note"><span className="meta muted">一段课表之外的时间</span><p>没有特别的目的地。<br />只是想和大家，<br />再走一会儿。</p></div>
        </div>
        <figure className="now-image">
          <img src="/images/light.svg" width="2400" height="1350" alt="窗格、光线与大片留白的中性构图，作为课后班级活动的全宽影像占位" />
          <figcaption className="image-caption wrap"><span>影像占位 A / 光线经过</span><span>班级摄影待确认</span></figcaption>
        </figure>
        <div className="now-after wrap grid"><p>有些日常，值得被留下来。</p><button className="text-link" onClick={() => setPanel(todayStory)}>读这段故事 <Arrow direction="right" /></button></div>
      </section>

      <section id="pulse" className="pulse wrap" aria-labelledby="pulse-title" data-beat="Class Pulse">
        <div className="pulse-header grid"><h2 id="pulse-title">班级的脉搏。</h2><p className="meta muted">十月，正在积累。<br />原型样本统计 / 非实时班级数据</p></div>
        <div className="pulse-composition grid">
          <div className="pulse-number pulse-events"><span className="number">{String(events.length).padStart(2, '0')}</span><span className="pulse-description">次即将到来的相聚<span lang="en">coming together</span></span></div>
          <div className="pulse-number pulse-moments"><span className="number">{moments.length}</span><span className="pulse-description">段可以留下的日常<span lang="en">moments to keep</span></span></div>
          <div className="pulse-number pulse-resources"><span className="number">{String(resources.length).padStart(2, '0')}</span><span className="pulse-description">份一起分享的知识<span lang="en">learning together</span></span></div>
          <p className="pulse-aside">事情在发生。<br />我们在其中。</p>
        </div>
      </section>

      <section id="upcoming" className="upcoming wrap grid" aria-labelledby="upcoming-title" data-beat="Upcoming">
        <div className="upcoming-intro"><span className="meta">下一次 / Upcoming</span><h2 id="upcoming-title">再见面的<br />时间。</h2><p className="month"><span>10</span>月</p><p className="meta muted">2026 / 示例安排</p></div>
        <ol className="event-list">{events.map((event, index) => <li key={event.day}>
          <button className="event-row" onClick={() => openEvent(index)} aria-label={`查看十月${event.day}日，${event.title}`}>
            <time dateTime={`2026-10-${event.day}`}><span>{event.day}</span><span className="meta">{event.month}</span></time>
            <span className="event-content"><span className="meta muted">{event.category}</span><span className="event-title">{event.title}</span><span className="event-note muted">{event.note}</span></span>
            <span className="event-time meta">{event.time}<Arrow direction="right" /></span>
          </button>
        </li>)}</ol>
      </section>

      <section id="life" className="life wrap" aria-labelledby="life-title" data-beat="Class Life">
        <div className="life-title grid"><span className="meta">日常 / Class life</span><h2 id="life-title">不只在<br />教室里。</h2><p>那些没有出现在课表上的，<br />也是班级的一部分。</p></div>
        <div className="life-images grid">
          <figure className="life-main"><img src="/images/steps.svg" width="1000" height="1400" alt="光线落在层叠台阶上的中性构图，作为班级日常的横向影像占位" /><figcaption><span>影像占位 B / 相聚的空间</span><span>日常样本 01</span></figcaption></figure>
          <figure className="life-detail"><img src="/images/light.svg" width="2400" height="1350" alt="窗格与光的竖向细节裁切，作为班级日常的影像占位" /><figcaption>换一个角度，留住一小段光。</figcaption></figure>
          <div className="life-story"><p>一起走过的路，<br />聊到一半的话。<br />小事，慢慢成了故事。</p><span className="meta muted">日常文案示例 / 非真实同学投稿</span></div>
          <figure className="life-small"><img src="/images/notes.svg" width="1500" height="1000" alt="几张纸与窗影组成的中性构图，作为课后笔记的影像占位" /><figcaption>影像占位 C / 桌上的片段</figcaption></figure>
        </div>
      </section>

      <section id="knowledge" className="knowledge wrap grid" aria-labelledby="knowledge-title" data-beat="Knowledge">
        <div className="knowledge-intro"><span className="meta">共学 / Knowledge</span><h2 id="knowledge-title">把知道的，<br />分享出来。</h2><p>一份笔记。一个方法。<br />下一位同学少绕的一段路。</p><span className="meta muted">08 份本地示例 / 点击读摘要</span></div>
        <div className="resource-directory"><div className="directory-heading meta muted"><span>目录 / 内容</span><span>类型</span><span>日期</span></div>
          <ol>{resources.map((resource, index) => <li key={resource.title}><button className="resource-row" onClick={() => setPanel({ title: resource.title, meta: `${resource.type} / 2026.${resource.date} / 示例摘要`, paragraphs: [resource.summary, '把自己的理解写清楚，也把还没弄明白的地方留下来。下一位同学从这里接着往下走。'] })}>
            <span className="resource-title"><span className="resource-index meta muted">{String(index + 1).padStart(2, '0')}</span>{resource.title}</span><span className="resource-type meta muted">{resource.type}</span><time className="resource-date meta" dateTime={`2026-${resource.date.replace('.', '-')}`}>{resource.date}</time><span className="sr-only">，读摘要</span>
          </button></li>)}</ol>
        </div>
      </section>

      <section id="timeline" className="timeline" aria-labelledby="timeline-title" data-beat="Living Timeline">
        <div className="timeline-heading wrap grid"><div><span className="meta">留下来 / Living timeline</span><h2 id="timeline-title">时间，<br />把我们连起来。</h2></div><p>今天正在发生的事，<br />有一天会成为：<br />“记得那时候吗？”</p></div>
        <div className="timeline-layout wrap grid">
          <aside className="year-rail" aria-label="时间位置"><div className="year-sticky"><span className="meta muted">记忆的年份 / 示例时间</span><div className="sticky-year" aria-hidden="true" key={year}>{timeline[year].year}</div><nav className="year-steps" aria-label="浏览时间记录">{timeline.map((entry, index) => <a key={index} href={`#memory-${index}`} aria-current={year === index ? 'step' : undefined}><span>{index === 2 ? '今天' : `${entry.year}.${entry.date.slice(0, 2)}`}</span><span className="step-mark" aria-hidden="true" /></a>)}</nav><p className="meta muted">这里只是时间叙事样本。<br />入学、活动与班级历史均待确认。</p></div></aside>
          <div className="memory-sequence">{timeline.map((entry, index) => <article key={index} id={`#memory-${index}`.slice(1)} className={`memory memory-${index}`} data-timeline-index={index} aria-labelledby={`memory-title-${index}`}>
            <div className="memory-date"><span className="mobile-year" aria-hidden="true">{index === 2 ? '今天' : entry.year}</span><time className="meta accent" dateTime={`${entry.year}-${entry.date.slice(0, 2)}`} aria-label={`${entry.year}年${entry.date.slice(0, 2)}月，${entry.date.slice(5)}`}>{entry.date}</time><span className="meta muted">记忆样本</span></div>
            <h3 id={`memory-title-${index}`}>{entry.title}</h3><p className="memory-text">{entry.text}</p>
            {entry.image ? <figure className={entry.imageClass}><img src={entry.image} width={index === 0 ? 1000 : 1500} height={index === 0 ? 1400 : 1000} alt={entry.alt} /><figcaption>{entry.caption}</figcaption></figure> : <div className="open-memory"><span className="open-mark" aria-hidden="true">＋</span><p>给下一段故事，<br />留一页空白。</p><time className="meta muted" dateTime="2026-10-03">03 October 2026 / 原型日期</time></div>}
          </article>)}</div>
        </div>
      </section>

      <section id="people" className="people wrap" aria-labelledby="people-title" data-beat="People">
        <div className="people-heading grid"><span className="meta">我们 / People</span><h2 id="people-title">从“同班”，<br />到“我们”。</h2></div>
        <div className="people-relations grid"><p className="people-lead">一个班级，<br />是许多段关系<br />慢慢靠近。</p><div className="relations-list"><p>一起赶过截止日期的人。</p><p>借过一支笔的人。</p><p>在路上互相等过的人。</p><p>愿意再讲一遍的人。</p><p>写在同一页里的，我们。</p></div><p className="people-note meta muted">班级，由每一次相互照应组成。<br />关系文案为概念示例。</p></div>
      </section>

      <section id="ending" className="ending wrap" aria-labelledby="ending-title" data-beat="Ending">
        <div className="ending-top grid"><p className="meta">今天，先记到这里。</p><time className="meta muted" dateTime="2026-10-03">03 / 10 / 2026</time></div>
        <h2 id="ending-title">这一页，<br />还在继续。</h2>
        <div className="ending-bottom grid"><p>下一次见面，<br />又会有新的故事。</p><div className="mascot-moment"><span className="signature" aria-live="polite">{greeting ? '明天见。' : '留个页角，明天再来。'}</span><button ref={mascot} className="mascot-button" onClick={greet} aria-label="让页角伙伴打个招呼" aria-pressed={greeting}>
          <svg viewBox="0 0 72 72" fill="none" aria-hidden="true"><path d="M14 10h30l14 14v34H14z" fill="var(--field)" stroke="currentColor" strokeWidth="1.2" /><path d="M44 10v14h14M25 54l-3 8m21-8 3 8" stroke="currentColor" strokeWidth="1.2" /><path d={greeting ? 'M25 33l3-2 3 2m9 0 3-2 3 2' : 'M28 31v5m15-5v5'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M31 43q5 5 10 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
        </button></div></div>
      </section>
    </main>

    <footer className="site-footer wrap"><a href="#top" className="wordmark">CLASSHUB</a><p className="meta muted">一个真正活着的数字班级。<br />独立视觉实验 / 所有内容为本地示例</p><a href="#top" className="footer-top">回到开头 <Arrow /></a></footer>
    <button className="review-trigger" aria-haspopup="dialog" onClick={() => setPanel('review')}>评审</button>
    {grid && <div className="grid-overlay" aria-hidden="true"><div className="overlay-margin left" /><div className="overlay-columns wrap">{Array.from({ length: viewport < 600 ? 4 : viewport < 1200 ? 8 : 12 }, (_, index) => <span key={index}><i>{index + 1}</i></span>)}</div><div className="overlay-margin right" /><span className="grid-legend">{viewport}px / {viewport < 600 ? '4' : viewport < 1200 ? '8' : '12'} columns / grid</span></div>}

    {panel && <Dialog key={typeof panel === 'string' ? panel : 'story'} title={panel === 'menu' ? '这一页的目录。' : panel === 'review' ? 'Art direction review' : panel.title} kind={typeof panel === 'string' ? panel : 'story'} onClose={() => setPanel(null)}>
      {panel === 'menu' ? <><nav className="menu-nav" aria-label="完整首页目录">{nav.map(([label, href]) => <a key={href} href={href} onClick={(event) => {
        event.preventDefault(); setPanel(null);
        requestAnimationFrame(() => { const target = document.querySelector(href) as HTMLElement; target.scrollIntoView({ behavior: 'instant' }); target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); history.replaceState(null, '', href); });
      }}>{label}<span lang="en">{href.slice(1)}</span></a>)}</nav><button className="text-link menu-review" onClick={() => setPanel('review')}>打开评审设置</button></> : panel === 'review' ? <div className="review-controls">
        <p className="review-note">独立首页原型。调整主题、动效与网格以检查构图。</p>
        <fieldset><legend>主题 / Theme</legend><div className="radio-row">{(['light', 'dark'] as const).map(value => <label key={value}><input type="radio" name="theme" value={value} checked={theme === value} onChange={() => setTheme(value)} />{value === 'light' ? 'Light / 纸色' : 'Dark / 夜间'}</label>)}</div></fieldset>
        <fieldset><legend>动效 / Motion</legend><div className="radio-row">{(['full', 'reduced'] as const).map(value => <label key={value}><input type="radio" name="motion" value={value} checked={motion === value} onChange={() => setMotion(value)} />{value === 'full' ? 'Full' : 'Reduced'}</label>)}</div><p className="meta muted">当前：{reduced ? 'Reduced' : 'Full'}{osReduced ? ' / 遵循系统减少动态效果' : ''}</p></fieldset>
        <fieldset><legend>网格 / Grid overlay</legend><label className="checkbox-label"><input type="checkbox" checked={grid} onChange={event => setGrid(event.target.checked)} />显示栏位、边距与 gutter</label></fieldset>
        <dl className="review-facts"><div><dt>Viewport</dt><dd>{viewport}px / {viewport < 600 ? '4' : viewport < 1200 ? '8' : '12'} columns</dd></div><div><dt>Fonts</dt><dd>{fontState}</dd></div><div><dt>Content</dt><dd>9 段叙事 / 本地静态样本</dd></div><div><dt>Status</dt><dd>等待人工 Art Direction Review</dd></div></dl>
      </div> : <article className="story-content"><p className="story-meta meta accent">{panel.meta}</p>{panel.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</article>}
    </Dialog>}
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
