import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/userContextState';
import { usePopup } from '../context/popupContextState';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import BottomNavigation from './BottomNavigation';
import SearchDialog from './SearchDialog';
import UserProfile from './UserProfile';
import ContentState from './ContentState';
export default function Layout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useUser();
  const { showUserProfile, openUserProfile, closeUserProfile } = usePopup();
  const { pathname } = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => { const handle = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && isAuthenticated) { event.preventDefault(); setSearchOpen(open => !open); } }; window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle); }, [isAuthenticated]);
  if (pathname === '/auth') return <>{children}</>;
  if (isLoading) return <div className="site-container py-12"><ContentState loading/></div>;
  if (!isAuthenticated) return <Navigate to="/auth" replace state={{ from: pathname }}/>;
  return <div className="site-shell"><a className="skip-link" href="#main-content">跳到正文</a><SiteHeader name={user.displayName || user.name} onSearch={() => setSearchOpen(true)} onProfile={openUserProfile}/><main id="main-content" tabIndex={-1} className="site-main site-container">{children}</main><SiteFooter/><BottomNavigation onNavigate={closeUserProfile}/><SearchDialog isOpen={searchOpen} onClose={() => setSearchOpen(false)}/><UserProfile isOpen={showUserProfile} onClose={closeUserProfile}/></div>;
}
