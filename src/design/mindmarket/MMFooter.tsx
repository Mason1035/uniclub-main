import { Link } from 'react-router-dom';
import { ArrowUpRight, Github } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import AnimatedTerminalText from '../../components/AnimatedTerminalText';
import './navigation.css';

const PROJECT_URL = 'https://github.com/Mason1035/uniclub-main';
const footerPhrases = ['learning from it.', 'imagining beyond it.', 'connecting through it.'] as const;
const columns = [
  { title: '我们的班级', links: [['/announcements', '班级公告'], ['/news', '新闻资讯'], ['/events', '班级活动'], ['/social', '班级动态']] },
  { title: '学习与事务', links: [['/resources', '学习资源'], ['/quantification', '量化材料'], ['/fees', '班费缴纳'], ['/functions/random-call', '随机点名']] },
  { title: '保持联系', links: [['/about', '关于我们'], ['/notifications', '我的通知'], ['/saved-posts', '我的收藏'], ['/settings', '个人设置']] },
];

export function MMFooter() {
  return <footer className="mm-footer">
    <div className="mm-footer-content">
      <div className="mm-footer-top">
        <div className="mm-footer-invitation"><p>把每一个你，<br/>连成我们的班级。</p><Link to="/social">分享你的日常<span><ArrowUpRight aria-hidden="true"/></span></Link></div>
        <nav className="mm-footer-grid" aria-label="页脚导航">{columns.map(column => <div key={column.title}><h2>{column.title}</h2>{column.links.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}</div>)}</nav>
      </div>
      <div className="mm-footer-terminal" lang="en">
        <p>The future isn't <span className="mm-footer-terminal__ending">writing code.</span></p>
        <p className="mm-footer-terminal__completion"><span>It's&nbsp;</span><AnimatedTerminalText phrases={footerPhrases}/></p>
      </div>
      <div className="mm-footer-bottom">
        <Link className="mm-footer-logo" to="/" aria-label="ClassHub 首页"><BrandLogo variant="mark" sizes="42px" alt="" loading="lazy" decoding="async"/></Link>
        <p>2026 ClassHub<br/><span>四川师范大学 · 2025级 · 软件工程3班</span><small className="mm-footer-font-credit">中文字体：MiSans · 得意黑</small></p>
        <nav className="mm-footer-legal" aria-label="网站信息" lang="en"><Link to="/about">About</Link><Link to="/privacy">Privacy</Link><Link to="/privacy#cookies">Cookies</Link><a href={`${PROJECT_URL}#readme`} target="_blank" rel="noopener noreferrer">Docs<ArrowUpRight aria-hidden="true"/></a><a href={PROJECT_URL} target="_blank" rel="noopener noreferrer"><Github aria-hidden="true"/>Source code</a></nav>
      </div>
    </div>
  </footer>;
}
