import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../context/userContextState';
import { usePopup } from '../context/popupContextState';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import BottomNavigation from './BottomNavigation';
import ContentState from './ContentState';
import { useAuth } from '../context/authContextState';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { SearchContext } from '../context/searchContextState';

const SearchDialog = lazy(() => import('./SearchDialog'));
const UserProfile = lazy(() => import('./UserProfile'));

/** Reuse the shared dialog already loaded by navigation while optional chunks load. */
function ModalLoading({ label, onClose, restoreFocusRef, isOpenRef }: {
  label: string; onClose: () => void; restoreFocusRef: RefObject<HTMLElement>; isOpenRef: RefObject<boolean>;
}) {
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent aria-describedby={undefined} onCloseAutoFocus={event => {
      event.preventDefault();
      // Resolution opens the real dialog; only a cancelled load returns focus.
      if (!isOpenRef.current && restoreFocusRef.current?.isConnected) restoreFocusRef.current.focus({ preventScroll: true });
    }}>
      <DialogTitle>正在加载{label}</DialogTitle>
      <p role="status">请稍候…</p>
      <button type="button" className="ed-button secondary mt-4" onClick={onClose}>关闭</button>
    </DialogContent>
  </Dialog>;
}

export default function Layout({ children, notFound = false }: { children: ReactNode; notFound?: boolean }) {
  const { user, isAuthenticated, isLoading } = useUser();
  const { showUserProfile, openUserProfile, closeUserProfile } = usePopup();
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const checking = isLoading || auth.loading;
  const member = !checking && isAuthenticated && !!auth.user;
  const normalizedPath = pathname.replace(/\/+$/, '').toLowerCase() || '/';
  const publicPage = notFound || normalizedPath === '/' || normalizedPath === '/privacy' || normalizedPath === '/about';
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchActivated, setSearchActivated] = useState(false);
  const [profileActivated, setProfileActivated] = useState(false);
  const searchOpener = useRef<HTMLElement | null>(null);
  const profileOpener = useRef<HTMLElement | null>(null);
  const searchOpenRef = useRef(searchOpen);
  const profileOpenRef = useRef(showUserProfile);
  searchOpenRef.current = searchOpen;
  profileOpenRef.current = showUserProfile;
  const openSearch = () => {
    // Search is already member-only. Guests keep the existing login/return flow.
    if (!member) {
      navigate('/auth', { state: { from: pathname + search + hash } });
      return;
    }
    if (!searchOpen) searchOpener.current = document.activeElement as HTMLElement | null;
    setSearchOpen(true);
  };
  const openProfile = () => {
    if (!showUserProfile) profileOpener.current = document.activeElement as HTMLElement | null;
    openUserProfile();
  };
  // Keep each dialog mounted after first use so its close/reset/focus lifecycle runs.
  useEffect(() => { if (searchOpen) setSearchActivated(true); }, [searchOpen]);
  useEffect(() => { if (showUserProfile) setProfileActivated(true); }, [showUserProfile]);
  // Keep the accepted home presentation; shared neutral tokens serve all routes.
  useLayoutEffect(() => {
    if (pathname !== '/') return;
    const root = document.documentElement;
    root.setAttribute('data-classhub-page', 'home');
    return () => root.removeAttribute('data-classhub-page');
  }, [pathname]);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && member) {
        event.preventDefault();
        if (!searchOpen) searchOpener.current = document.activeElement as HTMLElement | null;
        setSearchOpen(open => !open);
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [member, searchOpen]);
  useEffect(() => { if (!member) setSearchOpen(false); }, [member]);
  if (normalizedPath === '/auth') return <>{children}</>;
  if (!publicPage && checking) return <div className="site-container py-12"><ContentState loading/></div>;
  if (!publicPage && !member) return <Navigate to="/auth" replace state={{ from: pathname + search + hash }}/>;
  return <SearchContext.Provider value={{ openSearch }}><div className="site-shell">
    <a className="skip-link" href="#main-content">跳到正文</a>
    <SiteHeader isAuthenticated={member} name={member ? user.displayName || user.name : ''} onSearch={openSearch} onProfile={openProfile}/>
    <main id="main-content" tabIndex={-1} className="site-main site-container">{children}</main>
    <SiteFooter/>
    <BottomNavigation onNavigate={closeUserProfile}/>
    {member && <>
      {(searchOpen || searchActivated) && <Suspense fallback={searchOpen ? <ModalLoading label="搜索" onClose={() => setSearchOpen(false)} restoreFocusRef={searchOpener} isOpenRef={searchOpenRef}/> : null}>
        <SearchDialog isOpen={searchOpen} onClose={() => setSearchOpen(false)} restoreFocusRef={searchOpener}/>
      </Suspense>}
      {(showUserProfile || profileActivated) && <Suspense fallback={showUserProfile ? <ModalLoading label="个人资料" onClose={closeUserProfile} restoreFocusRef={profileOpener} isOpenRef={profileOpenRef}/> : null}>
        <UserProfile isOpen={showUserProfile} onClose={closeUserProfile} restoreFocusRef={profileOpener}/>
      </Suspense>}
    </>}
  </div></SearchContext.Provider>;
}
