import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/userContextState';
import { usePopup } from '../context/popupContextState';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import BottomNavigation from './BottomNavigation';
import SearchDialog from './SearchDialog';
import UserProfile from './UserProfile';
import ContentState from './ContentState';
import { useAuth } from '../context/authContextState';
export default function Layout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useUser();
  const { showUserProfile, openUserProfile, closeUserProfile } = usePopup();
  const { pathname, search, hash } = useLocation();
  const auth = useAuth();
  const checking = isLoading || auth.loading;
  const member = !checking && isAuthenticated && !!auth.user;
  const publicPage = pathname === '/' || pathname === '/privacy';
  const [searchOpen, setSearchOpen] = useState(false);
  // Keep the accepted home presentation; shared neutral tokens serve all routes.
  useLayoutEffect(() => {
    if (pathname !== '/') return;
    const root = document.documentElement;
    root.setAttribute('data-classhub-page', 'home');
    return () => root.removeAttribute('data-classhub-page');
  }, [pathname]);
  useEffect(() => { const handle = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && member) { event.preventDefault(); setSearchOpen(open => !open); } }; window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle); }, [member]);
  useEffect(() => { if (!member) setSearchOpen(false); }, [member]);
  if (pathname === '/auth') return <>{children}</>;
  if (!publicPage && checking) return <div className="site-container py-12"><ContentState loading/></div>;
  if (!publicPage && !member) return <Navigate to="/auth" replace state={{ from: pathname + search + hash }}/>;
  return <div className="site-shell"><a className="skip-link" href="#main-content">跳到正文</a><SiteHeader isAuthenticated={member} name={member ? user.displayName || user.name : ''} onSearch={() => setSearchOpen(true)} onProfile={openUserProfile}/><main id="main-content" tabIndex={-1} className="site-main site-container">{children}</main><SiteFooter/><BottomNavigation onNavigate={closeUserProfile}/>{member && <><SearchDialog isOpen={searchOpen} onClose={() => setSearchOpen(false)}/><UserProfile isOpen={showUserProfile} onClose={closeUserProfile}/></>}</div>;
}
