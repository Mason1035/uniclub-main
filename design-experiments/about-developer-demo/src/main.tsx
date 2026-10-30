import { StrictMode, useRef, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import DeveloperFloat, { Developer, Geometry } from './DeveloperFloat';
import { MOTION, ScrollSmoother, ScrollTrigger, gsap, useGSAP } from './motion';
import AmbientBackground from './AmbientBackground';
import './styles.css';

const DEVELOPERS: Developer[] = [
  { name: '何宇轩', shape: 'orbit' },
  { name: '张鹏飞', shape: 'frame' },
  { name: '李青原', shape: 'disc' },
];
// 介绍文案集中在此处；只描述已有功能，不读取班级私有数据。
const FEATURES = [
  { title: '查公告与读新闻', text: '查看班级通知和新闻，围绕当前新闻向 AI 提问，帮助理解正文与背景。' },
  { title: '参与活动与保存回忆', text: '查看活动安排、参与方式和往期活动记录。' },
  { title: '共享学习资源', text: '查找班级共享的资料、文件和资源链接。' },
  { title: '交流与查找', text: '发布班级动态、参与讨论，通过站内搜索查找有权访问的内容。' },
  { title: '办理班级事务', text: '按收集期提交量化材料，提交班费支付凭证，以及从有效班级成员中随机点名。' },
  { title: '管理与 AI 辅助', text: '管理员管理班级内容和事务，使用 AI 助手整理发布草稿、生成每日新闻。' },
];
function App() {
  const wrapper = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const media = gsap.matchMedia();
    // 只在桌面启用平滑滚动；手机和 reduced-motion 保持浏览器原生行为。
    media.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
      const smoother = ScrollSmoother.create({ wrapper: wrapper.current!, content: content.current!,
        smooth: MOTION.smoothSeconds, smoothTouch: 0, effects: false });
      return () => smoother.kill();
    });
    // 正文进入仅做轻微位移和透明度变化，不固定、不截断长文。
    // 参数：22px / 0.75秒 / power2.out；matchMedia 在卸载或减少动态效果时还原样式。
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const chapters = content.current?.querySelectorAll<HTMLElement>('.about-chapter, .demo-end') ?? [];
      chapters.forEach(chapter => {
        gsap.from(chapter.querySelectorAll('.chapter-heading, .chapter-body > *, .end-copy > *'), {
          y: 22, opacity: 0.72, duration: 0.75, stagger: 0.06, ease: 'power2.out',
          scrollTrigger: { trigger: chapter, start: 'top 85%', once: true },
        });
      });
    });
    ScrollTrigger.refresh();
    return () => media.revert();
  }, { scope: content });
  // 桌面内容被平滑滚动层接管，锚点必须使用同一实例；手机继续原生滚动。
  const openSection = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const target = event.currentTarget.hash;
    const smoother = ScrollSmoother.get();
    if (smoother) {
      smoother.scrollTo(target, true, target === '#developers' ? 'top top' : 'top 110px');
    } else {
      document.querySelector(target)?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  };
  return <>
    <AmbientBackground/>
    <header className="demo-header"><a href="http://localhost:8081/about" aria-label="返回现有 ClassHub About">
      <img src="/branding/classhub-logo-384-d01f9050a1.webp" width="144" alt="ClassHub"/></a>
      <a className="people-link" href="#developers" onClick={openSection}>认识开发者 ↓</a><a className="original-link" href="http://localhost:8081/about">现有 About ↗</a></header>
    <div ref={wrapper} id="demo-smooth-wrapper"><div ref={content} id="demo-smooth-content">
      <main>
        <section className="demo-intro">
          <div className="intro-meta"><div><span className="eyebrow">CLASSHUB · ABOUT DEMO</span><h1>关于 ClassHub</h1></div>
            <p>把班级消息、学习资料与日常事务，放在同一个地方。</p></div>
          <p className="intro-title">CLASS NEWS,<br/>LEARNING RESOURCES<br/>AND EVERYDAY LIFE.<br/>ALL IN ONE PLACE.</p>
          <div className="intro-object"><Geometry shape="orbit" id="intro-orbit"/></div>

        </section>
        <div className="about-content">
          <section className="about-chapter story-chapter" id="overview" aria-labelledby="overview-title">
            <div className="chapter-heading"><h2 id="overview-title" className="chapter-label">ClassHub 是什么？</h2>
              <p className="story-statement">FROM CLASS UPDATES<br/>TO SHARED MEMORIES,<br/>WE BRING OUR<br/>EVERYDAY TOGETHER.</p></div>
            <div className="chapter-body"><p className="lead-copy">ClassHub 是面向四川师范大学 2025 级软件工程 3 班的班级信息平台。它把通知、新闻、活动、资源与成员交流集中起来，方便同学查找信息、参与活动和处理班级事务。</p>
              <p>首页、项目介绍和隐私说明可以直接浏览。班级具体内容和操作需要成员登录；管理后台仅向经过身份验证的管理员开放。</p></div>
          </section>
          <section className="about-chapter" aria-labelledby="features-title">
            <div className="chapter-heading"><span className="eyebrow">POSSIBILITIES</span><h2 id="features-title">可以用它<br/>做什么？</h2><p className="chapter-english">A PLACE<br/>FOR THE<br/>EVERYDAY.</p></div>
            <div className="chapter-body"><ul className="features-list">{FEATURES.map((feature, index) => <li key={feature.title}>
              <span className="feature-number" aria-hidden="true">0{index + 1}</span><div><h3>{feature.title}</h3><p>{feature.text}</p></div>
            </li>)}</ul><p className="content-note">AI 回答与生成内容需要核实。实际可用内容取决于班级已发布的信息、账号权限和相关服务状态。</p></div>
          </section>
          <section className="about-chapter" aria-labelledby="scenarios-title">
            <div className="chapter-heading"><span className="eyebrow">03 / EVERYDAY</span><h2 id="scenarios-title">适合什么<br/>场景？</h2></div>
            <div className="chapter-body"><p className="lead-copy">同学可以集中查看班级消息、查找学习资料、分享日常和提交材料；班级管理员可以维护通知、活动、资源与事务记录。ClassHub 当前服务于本班级，这些班级功能需要登录使用。</p></div>
          </section>
          <section className="about-chapter" aria-labelledby="start-title">
            <div className="chapter-heading"><span className="eyebrow">04 / GET STARTED</span><h2 id="start-title">如何开始<br/>使用？</h2></div>
            <div className="chapter-body"><p className="lead-copy">先浏览首页，再使用班级管理员开通的账号登录。登录后，从顶部导航进入公告、新闻、活动、资源、班级动态或功能页面。账号或访问权限有问题时，请联系班级管理员。</p>
              <p>“功能”页面提供材料提交、班费缴纳与随机点名入口。AI 新闻问答位于新闻详情页，管理类 AI 功能位于管理员后台。</p>
              <a className="text-link" href="https://csrg3b.top/auth">登录 ClassHub <span aria-hidden="true">→</span></a></div>
          </section>
          <section className="about-chapter developer-copy" aria-labelledby="people-title">
            <div className="chapter-heading"><span className="eyebrow">05 / THE PEOPLE</span><h2 id="people-title">关于<br/>开发者</h2></div>
            <div className="chapter-body"><p className="lead-copy">项目公开代码仓库由 GitHub: Mason1035 等账号维护，参与构建、运维的成员包括何宇轩、李青原、张鹏飞。</p>
              <p>项目代码与使用文档可以在仓库中查看；仓库信息不代表学校官方组织身份。该网站已申请软件著作权并完成 ICP 备案。</p>
              <a className="text-link" href="https://github.com/Mason1035/uniclub-main">查看项目仓库与文档 <span aria-hidden="true">→</span></a></div>
          </section>
        </div>
        <DeveloperFloat developers={DEVELOPERS}/>
        <section className="demo-end" aria-labelledby="privacy-title"><div className="end-copy">
          <span className="eyebrow">06 / CONTENT & PRIVACY</span><h2 id="privacy-title">内容与隐私</h2>
          <p>本介绍只说明产品用途，不展示成员个人资料、内部公告、缴费记录或其他班级私有数据。登录、浏览器存储与第三方服务的具体说明，请查看<a className="inline-link" href="https://csrg3b.top/privacy">隐私与网站存储</a>。</p>
          <a className="text-link" href="https://csrg3b.top/">返回公开首页 <span aria-hidden="true">→</span></a></div>
        </section>
      </main>
      <footer>ClassHub / 独立动效预览 · 原创几何占位</footer>
    </div></div>
  </>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);
