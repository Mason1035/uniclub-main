import { useEffect, useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { sectionFor } from '../lib/navigationState';
import { Home, Megaphone, CalendarDays, FolderOpen, Menu, ArrowUpRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import './navigation.css';

const items = [
  { url: '/', label: '首页', Icon: Home },
  { url: '/announcements', label: '公告', Icon: Megaphone },
  { url: '/events', label: '活动', Icon: CalendarDays },
  { url: '/resources', label: '资源', Icon: FolderOpen },
];
const moreItems = [
  ['/news', '新闻'], ['/social', '班级动态'], ['/functions', '功能'],
  ['/saved-posts', '我的收藏'], ['/notifications', '通知'], ['/settings', '个人设置'],
];

export default function BottomNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const [more, setMore] = useState(false);
  const closeReason = useRef<'navigation' | 'desktop' | null>(null);
  const previousPath = useRef(pathname);
  const currentSection = sectionFor(pathname);

  useEffect(() => {
    // The portal must close when its mobile trigger leaves the visible layout.
    const mobile = window.matchMedia('(max-width: 767px)');
    const resize = () => {
      if (mobile.matches) return;
      closeReason.current = 'desktop';
      setMore(false);
    };
    mobile.addEventListener('change', resize);
    return () => mobile.removeEventListener('change', resize);
  }, []);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    closeReason.current = 'navigation';
    setMore(false);
  }, [pathname]);

  const closeForNavigation = () => {
    closeReason.current = 'navigation';
    setMore(false);
    onNavigate?.();
  };

  return <>
    <nav className="mobile-nav" aria-label="移动端导航">
      {items.map(({ url, label, Icon }) => <Link key={url} to={url}
        aria-current={currentSection === url ? 'page' : undefined} onClick={onNavigate}>
        <Icon aria-hidden="true"/><span>{label}</span>
      </Link>)}
      <button type="button" aria-current={!items.some(item => item.url === currentSection) ? 'page' : undefined}
        onClick={() => { closeReason.current = null; setMore(true); }}
        aria-expanded={more} aria-haspopup="dialog" aria-label="更多页面">
        <Menu aria-hidden="true"/><span>更多</span>
      </button>
    </nav>
    <Dialog open={more} onOpenChange={setMore}>
      <DialogContent className="mobile-menu-panel" onCloseAutoFocus={event => {
        const reason = closeReason.current;
        closeReason.current = null;
        if (!reason) return;
        event.preventDefault();
        const target = reason === 'desktop'
          ? (document.querySelector<HTMLElement>('.masthead-nav [aria-current="page"]') ?? document.querySelector<HTMLElement>('.masthead-brand'))
          : document.getElementById('main-content');
        target?.focus({ preventScroll: true });
      }}>
        <DialogTitle>更多页面</DialogTitle>
        <DialogDescription>查看班级内容和个人信息。</DialogDescription>
        <nav className="mobile-menu" aria-label="更多导航">
          {moreItems.map(([url, label]) => <Link key={url} to={url}
            aria-current={currentSection === url ? 'page' : undefined} onClick={closeForNavigation}>
            <span>{label}</span><ArrowUpRight aria-hidden="true"/>
          </Link>)}
        </nav>
      </DialogContent>
    </Dialog>
  </>;
}
