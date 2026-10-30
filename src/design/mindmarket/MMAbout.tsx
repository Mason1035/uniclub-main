import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { gsap, useGSAP } from '../../lib/gsap';
import { PRELOADER_DONE } from '../../lib/preloader';
import { MMRiveScene } from './MMRiveScene';
import { scrollMindMarketTo } from './MMScrollCoordinator';
import './about.css';

gsap.registerPlugin(ScrollTrigger);

const FEATURES = [
  { title: '查公告与读新闻', text: '查看班级通知和新闻，围绕当前新闻向 AI 提问，帮助理解正文与背景。' },
  { title: '参与活动与保存回忆', text: '查看活动安排、参与方式和往期活动记录。' },
  { title: '共享学习资源', text: '查找班级共享的资料、文件和资源链接。' },
  { title: '交流与查找', text: '发布班级动态、参与讨论，通过站内搜索查找有权访问的内容。' },
  { title: '办理班级事务', text: '按收集期提交量化材料，提交班费支付凭证，以及从有效班级成员中随机点名。' },
  { title: '管理与 AI 辅助', text: '管理员管理班级内容和事务，使用 AI 助手整理发布草稿、生成每日新闻。' },
];

const DEVELOPERS = [
  { name: '何宇轩', contact: '1942526314', shape: 'orbit' },
  { name: '张鹏飞', contact: '1405937768', shape: 'frame' },
  { name: '李青原', contact: '3057143042', shape: 'disc' },
];

const CHAPTERS = [
  { id: 'overview', name: '关于平台' },
  { id: 'possibilities', name: '日常功能' },
  { id: 'get-started', name: '开始使用' },
  { id: 'developers', name: '开发者' },
  { id: 'content-privacy', name: '内容与隐私' },
];

/** Public product introduction only. No member records or business requests. */
export default function MMAbout() {
  const scope = useRef<HTMLDivElement>(null);
  const [activeFeature, setActiveFeature] = useState<number | null>(0);
  const [activeChapter, setActiveChapter] = useState('overview');
  const { hash, key } = useLocation();

  useGSAP(() => {
    const root = scope.current;
    if (!root) return;
    let disposed = false;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      root.querySelectorAll<HTMLElement>('[data-mm-about-reveal]').forEach(section => {
        gsap.from(section, { y: 38, opacity: 0, duration: 0.85, ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 92%', once: true },
        });
      });
      gsap.from('.mm-about-hero__line > span', { yPercent: 105, rotation: 3,
        duration: 1.2, stagger: 0.12, ease: 'power4.out', clearProps: 'transform',
      });
      gsap.from('.mm-about-collage__tile', { y: 70, scale: 0.85, opacity: 0,
        duration: 1.75, stagger: 0.08, ease: 'elastic.out(1, 0.75)',
        clearProps: 'transform,opacity',
      });
      root.querySelectorAll<HTMLElement>('[data-mm-about-drift]').forEach((tile, index) => {
        gsap.to(tile, { y: index % 2 === 0 ? -65 : 55, ease: 'none',
          scrollTrigger: { trigger: '.mm-about-hero', start: 'top top', end: 'bottom top', scrub: 0.7 },
        });
      });
      const path = root.querySelector<SVGPathElement>('.mm-about-journey__path');
      if (path) {
        const length = path.getTotalLength();
        gsap.fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, {
          strokeDashoffset: 0, ease: 'none',
          scrollTrigger: { trigger: '.mm-about-journey', start: 'top 75%', end: 'bottom 65%', scrub: 0.8 },
        });
      }
    });
    const refresh = () => { if (!disposed) ScrollTrigger.refresh(); };
    void document.fonts.ready.then(refresh);
    window.addEventListener(PRELOADER_DONE, refresh);
    return () => {
      disposed = true;
      window.removeEventListener(PRELOADER_DONE, refresh);
      media.revert();
    };
  }, { scope });

  useEffect(() => {
    const root = scope.current;
    if (!root) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActiveChapter(visible.target.id);
    }, { rootMargin: '-15% 0px -60% 0px', threshold: 0 });
    CHAPTERS.forEach(chapter => {
      const section = root.querySelector(`#${chapter.id}`);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hash) return;
    let disposed = false;
    const jump = async () => {
      await document.fonts.ready;
      if (disposed) return;
      const id = hash.slice(1).replace(/[^a-zA-Z0-9_-]/g, '');
      // Older links to the developer and getting-started chapters remain valid.
      const aliases: Record<string, string> = { start: 'get-started', 'start-title': 'get-started', 'features-title': 'possibilities', 'people-title': 'developers', 'privacy-title': 'content-privacy', 'scenarios-title': 'everyday' };
      const target = scope.current?.querySelector<HTMLElement>(`[id="${aliases[id] || id}"]`);
      if (target) scrollMindMarketTo(target, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };
    const onReady = () => { void jump(); };
    const boot = window.__classhubPreloader;
    if (boot && boot.state !== 'done') window.addEventListener(PRELOADER_DONE, onReady, { once: true });
    else onReady();
    return () => { disposed = true; window.removeEventListener(PRELOADER_DONE, onReady); };
  }, [hash, key]);

  useEffect(() => {
    const timer = window.setTimeout(() => ScrollTrigger.refresh(), 450);
    return () => window.clearTimeout(timer);
  }, [activeFeature]);

  return <div className="mm-about" ref={scope}>
    <section className="mm-about-hero" aria-labelledby="mm-about-title">
      <span className="mm-about-kicker">CLASSHUB · ABOUT US</span>
      <h1 id="mm-about-title">
        <span className="mm-about-hero__line"><span>We are</span></span>
        <span className="mm-about-hero__line"><span>ClassHub<span className="mm-about-hero__dot">.</span></span></span>
      </h1>
      <p className="mm-about-hero__intro">把班级消息、学习资料与日常事务，<br/>放在同一个地方。</p>
      <div className="mm-about-collage" aria-hidden="true">
        <div className="mm-about-collage__tile mm-about-collage__tile--one" data-mm-about-drift>
          <MMRiveScene src="/mindmarket/rive/scientist.riv" className="mm-about-collage__rive"/>
        </div>
        <div className="mm-about-collage__tile mm-about-collage__tile--two" data-mm-about-drift>
          <img src="/mindmarket/timeline/folder.svg" alt="" width="160" height="160"/>
          <span>SHARE<br/>SOMETHING<br/>GOOD.</span>
        </div>
        <div className="mm-about-collage__tile mm-about-collage__tile--three" data-mm-about-drift>
          <img src="/mindmarket/timeline/joystick.svg" alt="" width="140" height="140"/>
        </div>
        <div className="mm-about-collage__tile mm-about-collage__tile--four" data-mm-about-drift>
          <MMRiveScene src="/mindmarket/rive/binoculars.riv" className="mm-about-collage__rive"/>
        </div>
        <div className="mm-about-collage__tile mm-about-collage__tile--five" data-mm-about-drift>
          <img src="/mindmarket/timeline/plane-1.svg" alt="" width="130" height="130"/>
          <span>EVERYDAY,<br/>TOGETHER.</span>
        </div>
        <div className="mm-about-collage__tile mm-about-collage__tile--six" data-mm-about-drift>
          <img src="/mindmarket/timeline/soccer-circle.svg" alt="" width="110" height="110"/>
        </div>
      </div>
      <Link className="mm-about-scroll" to="/about#overview"><span>认识我们的班级平台</span><span aria-hidden="true">↓</span></Link>
    </section>

    <nav className="mm-about-chapters" aria-label="关于页面章节">
      {CHAPTERS.map((chapter, index) => <Link key={chapter.id} to={`/about#${chapter.id}`}
        className={activeChapter === chapter.id ? 'is-active' : ''}
        aria-current={activeChapter === chapter.id ? 'location' : undefined}>
        <span aria-hidden="true">0{index + 1}</span>{chapter.name}
      </Link>)}
    </nav>

    <section className="mm-about-overview mm-about-section" id="overview" aria-labelledby="mm-overview-title">
      <div data-mm-about-reveal>
        <span className="mm-about-kicker">01 / OUR EVERYDAY</span>
        <h2 id="mm-overview-title">从班级消息，<br/>到共同<span className="mm-about-mark">回忆。</span></h2>
        <p className="mm-about-english">OUR EVERYDAY.<br/>ALL IN ONE PLACE.</p>
      </div>
      <div className="mm-about-body" data-mm-about-reveal>
        <p className="mm-about-lead">ClassHub 是面向四川师范大学 2025 级软件工程 3 班的班级信息平台。</p>
        <p>它把通知、新闻、活动、资源与成员交流集中起来，方便同学查找信息、参与活动和处理班级事务。</p>
        <p>首页、项目介绍和隐私说明可以直接浏览。班级具体内容和操作需要成员登录；管理后台仅向经过身份验证的管理员开放。</p>
        <Link className="mm-about-link" to="/auth">登录 ClassHub <span aria-hidden="true">↗</span></Link>
      </div>
    </section>

    <section className="mm-about-features mm-about-section" id="possibilities" aria-labelledby="mm-features-title">
      <div className="mm-about-features__intro" data-mm-about-reveal>
        <span className="mm-about-kicker">02 / POSSIBILITIES</span>
        <h2 id="mm-features-title">让日常，<br/>更有<span className="mm-about-mark mm-about-mark--pink">联系。</span></h2>
        <p>可以用它做什么？</p>
        <MMRiveScene src="/mindmarket/rive/research.riv" className="mm-about-features__character"/>
      </div>
      <div className="mm-about-feature-list" data-mm-about-reveal>
        {FEATURES.map((feature, index) => <article key={feature.title} className={`mm-about-feature ${activeFeature === index ? 'is-open' : ''}`}>
          <h3><button type="button" aria-expanded={activeFeature === index} aria-controls={`mm-feature-panel-${index}`}
            id={`mm-feature-button-${index}`} onClick={() => setActiveFeature(current => current === index ? null : index)}>
            <span className="mm-about-feature__number">0{index + 1}</span>
            <span>{feature.title}</span><span className="mm-about-feature__toggle" aria-hidden="true">+</span>
          </button></h3>
          <div className="mm-about-feature__panel" id={`mm-feature-panel-${index}`} role="region"
            aria-labelledby={`mm-feature-button-${index}`} aria-hidden={activeFeature !== index}>
            <div><p>{feature.text}</p></div>
          </div>
        </article>)}
        <p className="mm-about-note">AI 回答与生成内容需要核实。实际可用内容取决于班级已发布的信息、账号权限和相关服务状态。</p>
      </div>
    </section>

    <section className="mm-about-everyday mm-about-section" id="everyday" aria-labelledby="mm-everyday-title">
      <div data-mm-about-reveal><span className="mm-about-kicker">03 / A PLACE FOR THE EVERYDAY</span>
        <h2 id="mm-everyday-title">同学的日常，<br/>班级的<span className="mm-about-mark">连接。</span></h2></div>
      <div className="mm-about-body" data-mm-about-reveal>
        <p className="mm-about-lead">同学可以集中查看班级消息、查找学习资料、分享日常和提交材料；班级管理员可以维护通知、活动、资源与事务记录。</p>
        <p>ClassHub 当前服务于本班级，这些班级功能需要登录使用。</p>
      </div>
    </section>

    <section className="mm-about-journey" id="get-started" aria-labelledby="mm-start-title">
      <div className="mm-about-journey__heading" data-mm-about-reveal>
        <span className="mm-about-kicker">04 / GET STARTED</span>
        <h2 id="mm-start-title">一起，<br/>从这里<span className="mm-about-mark mm-about-mark--pink">开始。</span></h2>
      </div>
      <svg className="mm-about-journey__drawing" viewBox="0 0 1100 700" fill="none" aria-hidden="true" preserveAspectRatio="none">
        <path className="mm-about-journey__path" d="M140 30C100 170 440 80 410 245S1010 210 890 405 360 420 410 660" stroke="currentColor" strokeWidth="3"/>
      </svg>
      <div className="mm-about-steps">
        <article data-mm-about-reveal><span className="mm-about-step__number">01</span><h3>先认识，再加入。</h3><p>先浏览首页，再使用班级管理员开通的账号登录。账号或访问权限有问题时，请联系班级管理员。</p><Link className="mm-about-link" to="/">浏览公开首页 <span aria-hidden="true">↗</span></Link></article>
        <article data-mm-about-reveal><span className="mm-about-step__number">02</span><h3>找到你关心的。</h3><p>登录后，从顶部导航进入公告、新闻、活动、资源、班级动态或功能页面。</p><img src="/mindmarket/timeline/folder.svg" alt="" width="130" height="130" loading="lazy"/></article>
        <article data-mm-about-reveal><span className="mm-about-step__number">03</span><h3>一起处理日常。</h3><p>“功能”页面提供材料提交、班费缴纳与随机点名入口。AI 新闻问答位于新闻详情页，管理类 AI 功能位于管理员后台。</p><Link className="mm-about-link" to="/auth">登录 ClassHub <span aria-hidden="true">↗</span></Link></article>
      </div>
    </section>

    <section className="mm-about-developers" id="developers" aria-labelledby="mm-people-title">
      <div className="mm-about-developers__heading" data-mm-about-reveal>
        <span className="mm-about-kicker">05 / THE PEOPLE</span>
        <h2 id="mm-people-title">一起构建，<br/>一起<span className="mm-about-mark mm-about-mark--pink">成长。</span></h2>
        <p>关于开发者</p>
      </div>
      <div className="mm-about-developer-grid">
        {DEVELOPERS.map(developer => <a key={developer.name}
          href={`mqqapi://card/show_pslcard?src_type=internal&version=1&uin=${developer.contact}&card_type=person&source=qrcode`}
          target="_blank" rel="noopener noreferrer" className={`mm-about-developer mm-about-developer--${developer.shape}`} data-mm-about-reveal>
          <div className="mm-about-developer__art" aria-hidden="true"><span/><span/><span/></div>
          <div className="mm-about-developer__name"><h3>{developer.name}</h3><span aria-hidden="true">↗</span></div>
          <span className="mm-about-developer__contact">构建与运维 · QQ 联系</span>
        </a>)}
      </div>
      <div className="mm-about-developer-copy" data-mm-about-reveal>
        <p>项目公开代码仓库由 GitHub: Mason1035 等账号维护，参与构建、运维的成员包括何宇轩、李青原、张鹏飞。项目代码与使用文档可以在仓库中查看；仓库信息不代表学校官方组织身份。该网站已申请软件著作权并完成 ICP 备案。</p>
        <a className="mm-about-link" href="https://github.com/Mason1035/uniclub-main" target="_blank" rel="noopener noreferrer">查看项目仓库与文档 <span aria-hidden="true">↗</span></a>
      </div>
    </section>

    <section className="mm-about-privacy" id="content-privacy" aria-labelledby="mm-privacy-title">
      <div data-mm-about-reveal><span className="mm-about-kicker">06 / CONTENT & PRIVACY</span>
        <h2 id="mm-privacy-title">属于班级的，<br/>妥善<span className="mm-about-mark mm-about-mark--pink">保留。</span></h2>
        <p>本介绍只说明产品用途，不展示成员个人资料、内部公告、缴费记录或其他班级私有数据。登录、浏览器存储与第三方服务的具体说明，请查看隐私与网站存储。</p>
        <Link className="mm-about-link" to="/privacy">隐私与网站存储 <span aria-hidden="true">↗</span></Link>
      </div>
      <MMRiveScene src="/mindmarket/rive/binoculars.riv" className="mm-about-privacy__rive"/>
    </section>

    <section className="mm-about-end" aria-labelledby="mm-about-end-title">
      <span className="mm-about-kicker">SOMETHING GOOD STARTS HERE.</span>
      <h2 id="mm-about-end-title">班级日常，<br/>一起<span>记录。</span></h2>
      <Link className="mm-about-end__button" to="/auth">进入 ClassHub <span aria-hidden="true">↗</span></Link>
      <Link className="mm-about-end__home" to="/">返回公开首页 →</Link>
    </section>
  </div>;
}
