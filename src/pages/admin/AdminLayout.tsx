/**
 * AdminLayout - ClassHub console shell (sidebar + header + routed content).
 */
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bell,
  Bot,
  BookOpen,
  Archive,
  CalendarDays,
  ClipboardList,
  ExternalLink,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  Newspaper,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { clearSession } from './adminApi';
import { useAdminSession } from './adminSession';
import BrandLogo from '../../components/BrandLogo';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/admin', label: '数据概览', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { to: '/admin/roster', label: '班级名单', icon: <ClipboardList className="h-4 w-4" /> },
  { to: '/admin/members', label: '班级成员', icon: <Users className="h-4 w-4" /> },
  { to: '/admin/events', label: '活动管理', icon: <CalendarDays className="h-4 w-4" /> },
  { to: '/admin/news', label: '新闻管理', icon: <Newspaper className="h-4 w-4" /> },
  { to: '/admin/resources', label: '资源管理', icon: <BookOpen className="h-4 w-4" /> },
  { to: '/admin/quantification', label: '量化材料', icon: <Archive className="h-4 w-4" /> },
  { to: '/admin/fees', label: '班费管理', icon: <Wallet className="h-4 w-4" /> },
  { to: '/admin/gallery', label: '相册管理', icon: <Images className="h-4 w-4" /> },
  { to: '/admin/notifications', label: '通知管理', icon: <Bell className="h-4 w-4" /> },
  { to: '/admin/ai', label: 'AI 助手', icon: <Bot className="h-4 w-4" /> },
];

const Brand: React.FC = () => (
  <div className="flex items-center px-2">
    <BrandLogo
      alt="ClassHub"
      sizes="208px"
      className="block h-auto w-full max-w-[208px]"
    />
  </div>
);

const SidebarNav: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => (
  <nav className="space-y-1">
    {NAV_ITEMS.map((item) => (
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

const AdminLayout: React.FC = () => {
  const user = useAdminSession();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    clearSession();
    window.location.href = '/admin';
  };

  return (
    <div className="admin-workspace min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card px-3 py-5 lg:flex">
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

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-card/95 px-4  sm:px-6">
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

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-medium text-foreground">{user?.name || '管理员'}</p>
              <p className="text-[11px] text-muted-foreground">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-sm border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              退出
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
