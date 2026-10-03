import { useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { sectionFor } from '../lib/navigationState';
import { Home, Megaphone, CalendarDays, FolderOpen, Menu } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
export default function BottomNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const {pathname} = useLocation();
  const [more, setMore] = useState(false);
  const navigating = useRef(false);
  const items = [{ url:'/',label:'首页',Icon:Home },{ url:'/announcements',label:'公告',Icon:Megaphone },{ url:'/events',label:'活动',Icon:CalendarDays },{ url:'/resources',label:'资源',Icon:FolderOpen }];
  return <><nav className="mobile-nav" aria-label="移动端导航">{items.map(({url,label,Icon}) => <Link key={url} to={url} aria-current={sectionFor(pathname)===url?'page':undefined} onClick={onNavigate}><Icon/><span>{label}</span></Link>)}<button aria-current={!items.some(i=>i.url===sectionFor(pathname))?'page':undefined} onClick={() => { navigating.current = false; setMore(true); }} aria-expanded={more} aria-label="更多页面"><Menu/><span>更多</span></button></nav><Dialog open={more} onOpenChange={setMore}><DialogContent onCloseAutoFocus={event => { if (navigating.current) event.preventDefault(); navigating.current = false; }}><DialogTitle>更多页面</DialogTitle><DialogDescription>查看班级内容和个人信息。</DialogDescription><nav className="mobile-menu" aria-label="更多导航">{[['/news','新闻'],['/social','班级动态'],['/functions','功能'],['/saved-posts','我的收藏'],['/notifications','通知'],['/settings','个人设置']].map(([url,label]) => <Link key={url} to={url} onClick={() => { navigating.current = true; setMore(false); onNavigate?.(); }}>{label}</Link>)}</nav></DialogContent></Dialog></>;
}
