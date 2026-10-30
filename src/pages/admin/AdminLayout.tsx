import { backendPermissionFor, hasPermission, roleOf, ROLE_LABELS } from '../../lib/roles';
/**
 * AdminLayout - ClassHub console shell (sidebar + header + routed content).
 */
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Bell,
  Bot,
  BookOpen,
  Archive,
  CalendarDays,
  ExternalLink,
  Images,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Newspaper,
  Users,
  Wallet,
} from 'lucide-react';
import { clearSession } from './adminApi';
import { useAdminSession } from './adminSession';
import BrandLogo from '../../components/BrandLogo';
import AppearanceToggle from '../../components/AppearanceToggle';
import { useTheme } from '../../context/themeContextState';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/admin', label: '数据概览', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { to: '/admin/members', label: '班级成员', icon: <Users className="h-4 w-4" /> },
  { to: '/admin/events', label: '活动管理', icon: <CalendarDays className="h-4 w-4" /> },
  { to: '/admin/news', label: '新闻管理', icon: <Newspaper className="h-4 w-4" /> },
  { to: '/admin/resources', label: '资源管理', icon: <BookOpen className="h-4 w-4" /> },
  { to: '/admin/quantification', label: '量化材料', icon: <Archive className="h-4 w-4" /> },
  { to: '/admin/fees', label: '班费管理', icon: <Wallet className="h-4 w-4" /> },
  { to: '/admin/gallery', label: '相册管理', icon: <Images className="h-4 w-4" /> },
  { to: '/admin/notifications', label: '通知管理', icon: <Bell className="h-4 w-4" /> },
  { to: '/admin/ai', label: 'AI 助手', icon: <Bot className="h-4 w-4" /> },
  { to: '/admin/feedback', label: '反馈收件箱', icon: <Inbox className="h-4 w-4" /> },
];

const Brand: React.FC = () => {
  const { isDarkMode } = useTheme();
  return (
    <div className="flex items-center px-2">
      <span className="admin-brand relative block w-full max-w-[208px]">
        <BrandLogo alt="ClassHub" sizes="208px" className="block h-auto w-full" />
        {isDarkMode && <span className="masthead-logo-contrast" aria-hidden="true">
          <BrandLogo alt="" sizes="208px" className="block h-auto w-full" />
        </span>}
      </span>
    </div>
  );
};

const SidebarNav: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const user = useAdminSession();
  return (
  <nav className="space-y-1">
    {NAV_ITEMS.filter(item => hasPermission(user, backendPermissionFor(item.to))).map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        className={({ isActive }) =>
          `flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground'
          }`
        }
      >
        {item.icon}
        {item.label}
      </NavLink>
    ))}
  </nav>
  );
};

const AdminLayout: React.FC = () => {
  const user = useAdminSession();
  const location = useLocation();
  const permitted = hasPermission(user, backendPermissionFor(location.pathname));
  const [mobileOpen, setMobileOpen] = useState(false);
  const isOverview = permitted && location.pathname.replace(/\/+$/, '') === '/admin';

  const handleLogout = () => {
    clearSession();
    window.location.href = '/admin';
  };

  return (
    <div className={`admin-workspace min-h-screen${isOverview ? ' admin-workspace--overview' : ''}`}>
      {/* Desktop sidebar */}
      <aside className="admin-sidebar fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card px-3 py-5 lg:flex">
        <Brand />
        <div className="mt-7 flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <NavLink
            to="/"
            className="flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            返回前台
          </NavLink>
        </div>
      </aside>

      {/* Mobile drawer */}
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}><DialogContent className="admin-menu"><DialogTitle>管理导航</DialogTitle><DialogDescription>选择需要管理的班级内容。</DialogDescription><div className="mt-4"><SidebarNav onNavigate={() => setMobileOpen(false)} /></div></DialogContent></Dialog>

      <div className="admin-workspace__body lg:pl-64">
        <header className="admin-topbar sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="打开菜单"
              onClick={() => setMobileOpen(true)}
              className="icon-control text-muted-foreground hover:bg-accent/10 hover:text-foreground lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-foreground">管理控制台</p>
              <p className="text-[11px] text-muted-foreground">ClassHub 管理后台</p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <AppearanceToggle />
            <div className="min-w-0 max-w-[8rem] text-right sm:max-w-none">
              <p className="truncate text-xs font-medium text-foreground">{user?.name || '班级成员'}</p>
              <p className="truncate text-[11px] text-muted-foreground">{ROLE_LABELS[roleOf(user)]}{user?.email ? ` · ${user.email}` : ''}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex shrink-0 items-center gap-2 rounded-sm border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              退出
            </button>
          </div>
        </header>

        <main className="admin-main mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          {permitted ? <Outlet/> : <section role="alert" className="rounded-2xl border border-border bg-card p-6"><h1 className="text-xl font-semibold">当前身份无法访问此栏目</h1><p className="mt-3 text-sm text-muted-foreground">当前身份：{ROLE_LABELS[roleOf(user)]}。系统设置、AI 助手和名单维护仅向具有相应权限的管理员开放。</p><NavLink className="ed-button mt-5" to="/admin">返回后台首页</NavLink></section>}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
