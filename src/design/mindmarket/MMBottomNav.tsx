import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CalendarDays, FolderOpen, Home, Menu, Megaphone } from 'lucide-react';
import { sectionFor } from '../../lib/navigationState';
import './navigation.css';

const items = [
  { to: '/', label: '首页', Icon: Home },
  { to: '/announcements', label: '公告', Icon: Megaphone },
  { to: '/events', label: '活动', Icon: CalendarDays },
  { to: '/resources', label: '资源', Icon: FolderOpen },
];

/** Keeps the original one-tap member routes and .mobile-nav pet clearance contract. */
export function MMBottomNav({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const current = sectionFor(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const sync = (event: Event) => setMenuOpen((event as CustomEvent<{ open: boolean }>).detail.open);
    window.addEventListener('classhub:navigation-state', sync);
    return () => window.removeEventListener('classhub:navigation-state', sync);
  }, []);
  return <nav className="mobile-nav mm-bottom-nav" aria-label="常用页面" data-pet-avoid>
    {items.map(({ to, label, Icon }) => <Link key={to} to={to} onClick={onNavigate} aria-current={current === to ? 'page' : undefined}><Icon aria-hidden="true"/><span>{label}</span></Link>)}
    <button type="button" aria-haspopup="dialog" aria-controls="mm-mobile-menu" aria-expanded={menuOpen}
      aria-current={!items.some(item => item.to === current) ? 'page' : undefined} onClick={event => {
        onNavigate?.();
        window.dispatchEvent(new CustomEvent('classhub:open-navigation', { detail: { opener: event.currentTarget } }));
      }}><Menu aria-hidden="true"/><span>更多</span></button>
  </nav>;
}
