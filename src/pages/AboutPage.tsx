import { useRef } from 'react';
import { Link } from 'react-router-dom';
import DeveloperFloat, { type Developer, Geometry } from './about/DeveloperFloat';
import AboutBackground from './about/AboutBackground';
import { useAboutMotion } from './about/useAboutMotion';
import './about/about.css';

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

/** 公开介绍：沿用原文与链接，不读取成员或其他班级私有记录。 */
export default function AboutPage() {
  const scope = useRef<HTMLDivElement>(null);
  useAboutMotion(scope);
  return <div className="about-experience" ref={scope}>
    <AboutBackground/>
        <section className="about-intro">
          <div className="about-intro-meta"><div><span className="about-eyebrow">CLASSHUB · ABOUT</span><h1>关于 ClassHub</h1><Link className="about-people-link" to="/about#developers">认识开发者 ↓</Link></div>
            <p>把班级消息、学习资料与日常事务，放在同一个地方。</p></div>
          <p className="about-intro-title">CLASS NEWS,<br/>LEARNING RESOURCES<br/>AND EVERYDAY LIFE.<br/>ALL IN ONE PLACE.</p>
          <div className="about-intro-object"><Geometry shape="orbit" id="intro-orbit"/></div>

        </section>
        <div className="about-content">
          <section className="about-chapter about-story-chapter" id="overview" aria-labelledby="overview-title">
            <div className="about-chapter-heading"><h2 id="overview-title" className="about-chapter-label">ClassHub 是什么？</h2>
              <p className="about-story-statement">FROM CLASS UPDATES<br/>TO SHARED MEMORIES,<br/>WE BRING OUR<br/>EVERYDAY TOGETHER.</p></div>
            <div className="about-chapter-body"><p className="about-lead-copy">ClassHub 是面向四川师范大学 2025 级软件工程 3 班的班级信息平台。它把通知、新闻、活动、资源与成员交流集中起来，方便同学查找信息、参与活动和处理班级事务。</p>
              <p>首页、项目介绍和隐私说明可以直接浏览。班级具体内容和操作需要成员登录；管理后台仅向经过身份验证的管理员开放。</p></div>
          </section>
          <section className="about-chapter" aria-labelledby="features-title">
            <div className="about-chapter-heading"><span className="about-eyebrow">POSSIBILITIES</span><h2 id="features-title">可以用它做什么？</h2><p className="about-chapter-english">A PLACE<br/>FOR THE<br/>EVERYDAY.</p></div>
            <div className="about-chapter-body"><ul className="about-features-list">{FEATURES.map((feature, index) => <li key={feature.title}>
              <span className="about-feature-number" aria-hidden="true">0{index + 1}</span><div><h3>{feature.title}</h3><p>{feature.text}</p></div>
            </li>)}</ul><p className="about-content-note">AI 回答与生成内容需要核实。实际可用内容取决于班级已发布的信息、账号权限和相关服务状态。</p></div>
          </section>
          <section className="about-chapter" aria-labelledby="scenarios-title">
            <div className="about-chapter-heading"><span className="about-eyebrow">03 / EVERYDAY</span><h2 id="scenarios-title">适合什么场景？</h2></div>
            <div className="about-chapter-body"><p className="about-lead-copy">同学可以集中查看班级消息、查找学习资料、分享日常和提交材料；班级管理员可以维护通知、活动、资源与事务记录。ClassHub 当前服务于本班级，这些班级功能需要登录使用。</p></div>
          </section>
          <section className="about-chapter" aria-labelledby="start-title">
            <div className="about-chapter-heading"><span className="about-eyebrow">04 / GET STARTED</span><h2 id="start-title">如何开始使用？</h2></div>
            <div className="about-chapter-body"><p className="about-lead-copy">先浏览首页，再使用班级管理员开通的账号登录。登录后，从顶部导航进入公告、新闻、活动、资源、班级动态或功能页面。账号或访问权限有问题时，请联系班级管理员。</p>
              <p>“功能”页面提供材料提交、班费缴纳与随机点名入口。AI 新闻问答位于新闻详情页，管理类 AI 功能位于管理员后台。</p>
              <Link className="about-text-link" to="/auth">登录 ClassHub <span aria-hidden="true">→</span></Link></div>
          </section>
          <section className="about-chapter about-developer-copy" aria-labelledby="people-title">
            <div className="about-chapter-heading"><span className="about-eyebrow">05 / THE PEOPLE</span><h2 id="people-title">关于开发者</h2></div>
            <div className="about-chapter-body"><p className="about-lead-copy">项目公开代码仓库由 GitHub: Mason1035 等账号维护，参与构建、运维的成员包括<a className="about-developer-name" href="mqqapi://card/show_pslcard?src_type=internal&version=1&uin=1942526314&card_type=person&source=qrcode" target="_blank" rel="noopener noreferrer">何宇轩</a>、<a className="about-developer-name" href="mqqapi://card/show_pslcard?src_type=internal&version=1&uin=3057143042&card_type=person&source=qrcode" target="_blank" rel="noopener noreferrer">李青原</a>、<a className="about-developer-name" href="mqqapi://card/show_pslcard?src_type=internal&version=1&uin=1405937768&card_type=person&source=qrcode" target="_blank" rel="noopener noreferrer">张鹏飞</a>。</p>
              <p>项目代码与使用文档可以在仓库中查看；仓库信息不代表学校官方组织身份。该网站已申请软件著作权并完成 ICP 备案。</p>
              <a className="about-text-link" href="https://github.com/Mason1035/uniclub-main" target="_blank" rel="noopener noreferrer">查看项目仓库与文档 <span aria-hidden="true">→</span></a></div>
          </section>
        </div>
        <DeveloperFloat developers={DEVELOPERS}/>
        <section className="about-end" aria-labelledby="privacy-title"><div className="about-end-copy">
          <span className="about-eyebrow">06 / CONTENT & PRIVACY</span><h2 id="privacy-title">内容与隐私</h2>
          <p>本介绍只说明产品用途，不展示成员个人资料、内部公告、缴费记录或其他班级私有数据。登录、浏览器存储与第三方服务的具体说明，请查看<Link className="about-inline-link" to="/privacy">隐私与网站存储</Link>。</p>
          <Link className="about-text-link" to="/">返回公开首页 <span aria-hidden="true">→</span></Link></div>
        </section>
  </div>;
}
