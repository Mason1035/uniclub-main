import { hasPermission, ROLE_LABELS, roleOf, type RoleIdentity } from '../../lib/roles';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, ArrowUpRight, Bell, ChevronDown, Menu, UserRound, X } from 'lucide-react';
import AIEntryButton from '../../components/AIEntryButton';
import BrandLogo from '../../components/BrandLogo';
import LiquidGlass from '../../components/LiquidGlass';
import AppearanceToggle from '../../components/AppearanceToggle';
import { sectionFor } from '../../lib/navigationState';
import { MMRiveScene } from './MMRiveScene';
import UserAvatarImage from '../../components/UserAvatarImage';
import './navigation.css';

type NavLink = { to: string; label: string; description?: string };
const groups: { id: string; label: string; lead: string; scene: string; links: NavLink[] }[] = [
  { id: 'news', label: '班级消息', lead: '每一件小事，都与你有关。', scene: 'shrug', links: [
    { to: '/announcements', label: '班级公告', description: '重要安排与班级通知' },
    { to: '/news', label: '新闻资讯', description: '看看最近发生了什么' },
    { to: '/notifications', label: '我的通知', description: '查看与你有关的提醒' },
  ] },
  { id: 'together', label: '一起参与', lead: '在一起，让日常更有意思。', scene: 'basketball_player', links: [
    { to: '/events', label: '班级活动', description: '活动报名与往期回顾' },
    { to: '/social', label: '班级动态', description: '分享我们的校园生活' },
  ] },
  { id: 'learning', label: '学习与事务', lead: '把琐事办妥，把时间留给热爱。', scene: 'composer', links: [
    { to: '/resources', label: '学习资源', description: '查找与下载共享资料' },
    { to: '/quantification', label: '量化材料', description: '提交材料并查看提交结果' },
    { to: '/fees', label: '班费缴纳', description: '查看缴费说明并提交凭证' },
    { to: '/functions/random-call', label: '随机点名', description: '从全班成员中随机抽取' },
    { to: '/functions', label: '全部功能', description: '班级事务的统一入口' },
  ] },
];
const accountLinks: NavLink[] = [
  { to: '/saved-posts', label: '我的收藏' },
  { to: '/settings', label: '个人设置与外观' },
];

export type MMHeaderProps = {
  access?: RoleIdentity | null;
  onSearch: () => void;
  onProfile: () => void;
  name: string;
  isAuthenticated: boolean;
  checking?: boolean;
  avatarSrc?: string | null;
  avatarIdentity?: string | null;
};

/** A disclosure navigation, with the original React routes and member dialogs intact. */
export function MMHeader({ access, onSearch, onProfile, name, isAuthenticated, checking = false, avatarSrc, avatarIdentity }: MMHeaderProps) {
  const location = useLocation();
  const canBackend = isAuthenticated && hasPermission(access, 'backend');
  const current = sectionFor(location.pathname);
  const currentGroup = groups.find(group => group.links.some(item => sectionFor(item.to) === current))?.id ?? null;
  const moreIsCurrent = !currentGroup && current !== '/' && current !== '/about';
  const [desktopOpen, setDesktopOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [materialMoving, setMaterialMoving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const scope = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTrigger = useRef<HTMLButtonElement | null>(null);
  const mobileReturnFocus = useRef<HTMLElement | null>(null);
  const dialogFrame = useRef<number | null>(null);
  const dropdownFrame = useRef<number | null>(null);
  const desktopState = useRef<{ id: string | null; source: 'hover' | 'activation' | null }>({ id: null, source: null });
  const mobileCloseReason = useRef<'navigation' | 'dialog' | 'resize' | null>(null);
  const returnTo = location.pathname + location.search + location.hash;
  const stopCloseTimer = useCallback(() => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = null; }, []);
  const closeDesktop = useCallback(() => { stopCloseTimer(); desktopState.current = { id: null, source: null }; setDesktopOpen(null); }, [stopCloseTimer]);
  const closeMenus = () => { closeDesktop(); setMobileOpen(false); };
  const closeForRoute = () => { mobileCloseReason.current = 'navigation'; closeMenus(); };
  const openOnHover = (id: string) => {
    stopCloseTimer();
    if (desktopState.current.id !== id) desktopState.current = { id, source: 'hover' };
    setDesktopOpen(id);
  };
  const toggleDropdown = (id: string, trigger: HTMLButtonElement) => {
    stopCloseTimer();
    activeTrigger.current = trigger;
    // The first click commits a hover-open panel; subsequent activations toggle it.
    if (desktopState.current.id === id && desktopState.current.source === 'activation') closeDesktop();
    else { desktopState.current = { id, source: 'activation' }; setDesktopOpen(id); }
  };
  const dropdownKey = (event: ReactKeyboardEvent<HTMLButtonElement>, id: string) => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    stopCloseTimer();
    activeTrigger.current = event.currentTarget;
    desktopState.current = { id, source: 'activation' };
    setDesktopOpen(id);
    if (dropdownFrame.current !== null) cancelAnimationFrame(dropdownFrame.current);
    dropdownFrame.current = requestAnimationFrame(() => { dropdownFrame.current = null; document.getElementById(`mm-desktop-${id}`)?.querySelector<HTMLElement>('a')?.focus(); });
  };
  const openMemberDialog = (callback: () => void) => {
    const opener = mobileOpen ? mobileReturnFocus.current ?? menuButton.current : document.activeElement as HTMLElement | null;
    mobileCloseReason.current = 'dialog';
    closeMenus();
    // Let the menu release its focus trap before the member dialog records its opener.
    if (dialogFrame.current !== null) cancelAnimationFrame(dialogFrame.current);
    dialogFrame.current = requestAnimationFrame(() => {
      dialogFrame.current = null;
      (opener?.isConnected && opener.offsetParent ? opener : scope.current?.querySelector<HTMLElement>('.mm-header-cta'))?.focus({ preventScroll: true });
      callback();
    });
  };
  useEffect(() => { closeForRoute(); setExpanded(currentGroup); }, [location.pathname, location.search, location.hash]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('classhub:navigation-state', { detail: { open: mobileOpen } }));
  }, [mobileOpen]);
  useEffect(() => {
    const outside = (event: Event) => {
      if (event.target instanceof Node && !scope.current?.contains(event.target)) closeDesktop();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !desktopState.current.id || !(event.target instanceof Node) || !scope.current?.contains(event.target)) return;
      event.preventDefault();
      closeDesktop();
      activeTrigger.current?.focus({ preventScroll: true });
    };
    const desktop = window.matchMedia('(min-width: 1000px)');
    const resize = () => { closeDesktop(); mobileCloseReason.current = 'resize'; setMobileOpen(false); };
    const openNavigation = (event: Event) => {
      if (desktop.matches) return;
      const opener = (event as CustomEvent<{ opener?: HTMLElement }>).detail?.opener;
      mobileReturnFocus.current = opener ?? menuButton.current;
      mobileCloseReason.current = null;
      setExpanded(currentGroup);
      setMobileOpen(true);
      closeDesktop();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    document.addEventListener('keydown', keyboard);
    window.addEventListener('classhub:open-navigation', openNavigation);
    desktop.addEventListener('change', resize);
    return () => {
      stopCloseTimer();
      if (dialogFrame.current !== null) cancelAnimationFrame(dialogFrame.current);
      if (dropdownFrame.current !== null) cancelAnimationFrame(dropdownFrame.current);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      document.removeEventListener('keydown', keyboard);
      window.removeEventListener('classhub:open-navigation', openNavigation);
      desktop.removeEventListener('change', resize);
    };
  }, [currentGroup, closeDesktop, stopCloseTimer]); // Route-group changes refresh the menu opener's initial accordion.

  // Native events also cover interrupted CSS transitions in React 18.
  // Suspend refraction while opening/open; restore it after the shell closes.
  useEffect(()=>{
    const material=scope.current?.querySelector<HTMLElement>('.mm-navigation-glass');
    if(!material)return;
    const begin=(event:TransitionEvent)=>{if(event.target===material&&event.propertyName==='height')setMaterialMoving(true);};
    const finish=(event:TransitionEvent)=>{if(event.target===material&&event.propertyName==='height')setMaterialMoving(false);};
    material.addEventListener('transitionrun',begin);
    material.addEventListener('transitionend',finish);
    material.addEventListener('transitioncancel',finish);
    return()=>{
      material.removeEventListener('transitionrun',begin);
      material.removeEventListener('transitionend',finish);
      material.removeEventListener('transitioncancel',finish);
    };
  },[]);

  // One continuous optical surface includes the bar and the active panel.
  // Only content resizing/opening measures geometry, never a scroll frame.
  useLayoutEffect(() => {
    const header=scope.current;
    const material=header?.querySelector<HTMLElement>('.mm-navigation-glass');
    const bar=header?.querySelector<HTMLElement>('.mm-header-bar');
    const panel=desktopOpen ? document.getElementById(`mm-desktop-${desktopOpen}`) : null;
    if(!material || !bar)return;
    const measure=()=>{
      const barHeight=bar.getBoundingClientRect().height;
      const panelHeight=panel && !panel.hidden ? panel.offsetHeight : 0;
      material.style.setProperty('--mm-navigation-bar-height',`${barHeight}px`);
      material.style.setProperty('--mm-navigation-height',`${barHeight+panelHeight}px`);
    };
    measure();
    if(typeof ResizeObserver!=='function'){
      window.addEventListener('resize',measure);
      return()=>window.removeEventListener('resize',measure);
    }
    const observer=new ResizeObserver(measure);
    observer.observe(bar);
    if(panel)observer.observe(panel);
    return()=>observer.disconnect();
  },[desktopOpen]);

  const navLink = (item: NavLink, tabIndex?: number) => <Link key={item.to} to={item.to}
    className="mm-menu-link" tabIndex={tabIndex} onClick={closeForRoute}
    aria-current={location.pathname === item.to || (['/news', '/events', '/resources', '/social'].includes(item.to) && current === item.to) ? 'page' : undefined}>
    <span><span className="mm-menu-link-label">{item.label}</span>{item.description && <small>{item.description}</small>}</span>
    <ArrowUpRight aria-hidden="true"/>
  </Link>;
  const memberActions = <>
    {isAuthenticated ? <>
      <AIEntryButton onClick={() => openMemberDialog(onSearch)}/>
      <Link className="mm-icon-button" to="/notifications" onClick={closeForRoute} aria-label="通知"><Bell aria-hidden="true"/></Link>
    </> : checking && <><span className="mm-icon-button" aria-hidden="true" data-auth-placeholder/><span className="mm-icon-button" aria-hidden="true" data-auth-placeholder/></>}
    <AppearanceToggle className="mm-appearance"/>
  </>;

  return <header ref={scope} className="mm-header" onMouseEnter={stopCloseTimer} onMouseLeave={() => {
    if (desktopState.current.source === 'hover' || !scope.current?.contains(document.activeElement)) closeTimer.current = setTimeout(closeDesktop, 150);
  }}>
    <LiquidGlass className="mm-navigation-glass" data-expanded={desktopOpen !== null} optics={desktopOpen === null && !materialMoving} refraction><div className="mm-header-bar">
      <Link className="mm-header-brand" to="/" onClick={closeForRoute} aria-label="ClassHub 首页">
        <BrandLogo alt="ClassHub 软件工程班级信息平台" sizes="(max-width: 999px) 144px, 174px" fetchPriority="high" decoding="async"/>
      </Link>
      <nav className="mm-desktop-nav" aria-label="主导航">
        {groups.map(group => <div className="mm-desktop-item" key={group.id} onMouseEnter={() => openOnHover(group.id)}>
          <button type="button" className="mm-nav-pill" aria-expanded={desktopOpen === group.id} aria-controls={`mm-desktop-${group.id}`}
            aria-current={currentGroup === group.id ? 'true' : undefined} aria-label={`${group.label}${currentGroup === group.id ? '，当前栏目' : ''}`}
            onFocus={event => { activeTrigger.current = event.currentTarget; if (desktopState.current.id && desktopState.current.id !== group.id) closeDesktop(); }}
            onClick={event => toggleDropdown(group.id, event.currentTarget)} onKeyDown={event => dropdownKey(event, group.id)}>
            {group.label}<ChevronDown aria-hidden="true"/>
          </button>
          <div id={`mm-desktop-${group.id}`} className="mm-desktop-dropdown" hidden={desktopOpen !== group.id}>
            <div className="mm-dropdown-promo"><p>{group.lead}</p><div aria-hidden="true"><MMRiveScene src={`/mindmarket/rive/${group.scene}.riv`} className="mm-dropdown-scene" autoplay={desktopOpen === group.id}/></div></div>
            <div className="mm-dropdown-links">{group.links.map(item => navLink(item))}</div>
          </div>
        </div>)}
        <Link className="mm-nav-pill" to="/about" aria-current={current === '/about' ? 'page' : undefined} onFocus={closeDesktop} onMouseEnter={closeDesktop} onClick={closeForRoute}>关于我们</Link>
        <div className="mm-desktop-item" onMouseEnter={() => openOnHover('more')}>
          <button type="button" className="mm-nav-pill mm-nav-more" aria-label={`更多页面${moreIsCurrent ? '，当前栏目' : ''}`} aria-current={moreIsCurrent ? 'true' : undefined} aria-expanded={desktopOpen === 'more'} aria-controls="mm-desktop-more"
            onFocus={event => { activeTrigger.current = event.currentTarget; if (desktopState.current.id && desktopState.current.id !== 'more') closeDesktop(); }} onClick={event => toggleDropdown('more', event.currentTarget)} onKeyDown={event => dropdownKey(event, 'more')}><Menu aria-hidden="true"/></button>
          <div id="mm-desktop-more" className="mm-desktop-dropdown mm-desktop-dropdown--more" hidden={desktopOpen !== 'more'}>
            <div className="mm-dropdown-links">{navLink({ to: '/', label: '班级首页' })}{isAuthenticated && accountLinks.map(item => navLink(item))}{navLink({ to: '/privacy', label: '隐私与 Cookies' })}{canBackend && navLink({ to: '/admin', label: '管理后台', description: `${ROLE_LABELS[roleOf(access)]} · 管理获授权的班级事务` })}</div>
          </div>
        </div>
      </nav>
      <div className="mm-header-actions" onFocusCapture={closeDesktop} onMouseEnter={closeDesktop}>{memberActions}</div>
      {isAuthenticated ? <button type="button" className="mm-header-cta" aria-haspopup="dialog" onFocus={closeDesktop} onClick={() => openMemberDialog(onProfile)} aria-label={`${name || '我的'}个人资料，${ROLE_LABELS[roleOf(access)]}`}><span>个人资料</span><span className="mm-cta-face" aria-hidden="true"><UserAvatarImage key={avatarIdentity || 'guest'} src={avatarSrc} identity={avatarIdentity} alt="" decoding="async"/></span></button> : checking ? <span className="mm-header-cta mm-auth-placeholder" aria-hidden="true" data-auth-placeholder><span>个人资料</span><span className="mm-cta-face"/></span> :
        <Link data-auth-guest className="mm-header-cta" to="/auth" state={{ from: returnTo }} onFocus={closeDesktop} onClick={closeForRoute}><span>成员登录</span><span className="mm-cta-face" aria-hidden="true"><UserRound aria-hidden="true"/></span></Link>}
      <Dialog.Root open={mobileOpen} onOpenChange={next => {
        mobileCloseReason.current = null;
        if (next) { mobileReturnFocus.current = menuButton.current; setExpanded(currentGroup); }
        setMobileOpen(next); closeDesktop();
      }}>
        <Dialog.Trigger asChild><button ref={menuButton} type="button" className="mm-mobile-trigger" aria-label="打开导航菜单" aria-controls="mm-mobile-menu"><span>菜单</span><Menu aria-hidden="true"/></button></Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="mm-mobile-overlay"/>
          <Dialog.Content id="mm-mobile-menu" className="mm-mobile-panel" onCloseAutoFocus={event => {
            const reason = mobileCloseReason.current;
            mobileCloseReason.current = null;
            if (reason === 'navigation') { event.preventDefault(); document.getElementById('main-content')?.focus({ preventScroll: true }); }
            else if (reason === 'dialog') event.preventDefault();
            else if (reason === 'resize') { event.preventDefault(); scope.current?.querySelector<HTMLElement>('.mm-header-brand')?.focus({ preventScroll: true }); }
            else if (mobileReturnFocus.current?.isConnected) { event.preventDefault(); mobileReturnFocus.current.focus({ preventScroll: true }); }
          }}>
            <div className="mm-mobile-panel-head"><Dialog.Title>一起，成为我们。</Dialog.Title><Dialog.Close className="mm-icon-button" aria-label="关闭菜单"><X aria-hidden="true"/></Dialog.Close></div>
            <Dialog.Description className="mm-sr-only">浏览班级消息、活动与学习资源，管理个人设置。</Dialog.Description>
            <div className="mm-mobile-shortcuts">
              {isAuthenticated ? <><AIEntryButton onClick={() => openMemberDialog(onSearch)}/><Link to="/notifications" onClick={closeForRoute} aria-current={current === '/notifications' ? 'page' : undefined}><Bell aria-hidden="true"/>通知</Link><button type="button" onClick={() => openMemberDialog(onProfile)} aria-label={`${name || '我的'}个人资料，${ROLE_LABELS[roleOf(access)]}`} aria-haspopup="dialog"><UserRound aria-hidden="true"/>个人资料</button></> : checking ? <span className="mm-icon-button" aria-hidden="true" data-auth-placeholder/> : <Link data-auth-guest to="/auth" state={{ from: returnTo }} onClick={closeForRoute}>成员登录<ArrowRight aria-hidden="true"/></Link>}
            </div>
            <nav aria-label="移动端导航" className="mm-mobile-nav">
              <Link to="/" className="mm-mobile-home" onClick={closeForRoute} aria-current={current === '/' ? 'page' : undefined}>班级首页<ArrowUpRight aria-hidden="true"/></Link>
              {groups.map(group => <div className="mm-mobile-group" key={group.id}>
                <button type="button" className="mm-mobile-group-trigger" aria-expanded={expanded === group.id} aria-controls={`mm-mobile-${group.id}`} aria-current={currentGroup === group.id ? 'true' : undefined} aria-label={`${group.label}${currentGroup === group.id ? '，当前栏目' : ''}`} onClick={() => setExpanded(value => value === group.id ? null : group.id)}>{group.label}<ChevronDown aria-hidden="true"/></button>
                <div id={`mm-mobile-${group.id}`} className="mm-mobile-accordion" data-open={expanded === group.id} aria-hidden={expanded !== group.id}><div>{group.links.map(item => navLink(item, expanded === group.id ? 0 : -1))}</div></div>
              </div>)}
              <div className="mm-mobile-secondary">{isAuthenticated && accountLinks.map(item => navLink(item))}{navLink({ to: '/about', label: '关于我们' })}{navLink({ to: '/privacy', label: '隐私与 Cookies' })}{canBackend && navLink({ to: '/admin', label: '管理后台' })}</div>
            </nav>
            <div className="mm-mobile-account"><AppearanceToggle className="mm-appearance"/><span>切换外观</span></div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div></LiquidGlass>
  </header>;
}
