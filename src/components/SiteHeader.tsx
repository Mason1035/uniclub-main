import { useRef } from 'react';
import { useHeaderMorph } from '../hooks/useHeaderMorph';
import { useLocation, Link } from 'react-router-dom';
import { Search, Bell, UserRound } from 'lucide-react';
import { sectionFor } from '../lib/navigationState';
import BrandLogo from './BrandLogo';
import './navigation.css';

export default function SiteHeader({ onSearch, onProfile, name, isAuthenticated }: {
  onSearch: () => void;
  onProfile: () => void;
  name: string;
  isAuthenticated: boolean;
}) {
  const { pathname } = useLocation();
  const scope = useRef<HTMLDivElement>(null);
  useHeaderMorph(scope);

  return (
    <div ref={scope} className="header-reserve">
      <header className="masthead">
        <div className="masthead-paper" aria-hidden="true" />
        <div className="site-container">
          <div className="masthead-inner">
            <Link className="masthead-brand" to="/" aria-label="ClassHub 首页">
              <BrandLogo
                className="masthead-logo"
                alt="ClassHub 软件工程班级信息平台"
                sizes="(max-width: 767px) 184px, (max-width: 1090px) 240px, (max-width: 1309px) 22vw, 288px"
                fetchPriority="high"
                decoding="async"
              />
            </Link>
            <div className="masthead-actions">
              {isAuthenticated ? <>
              <button
                type="button"
                className="icon-control"
                onClick={onSearch}
                aria-haspopup="dialog"
                aria-label="搜索，快捷键 Ctrl 或 Command K"
                aria-keyshortcuts="Control+K Meta+K"
              >
                <Search aria-hidden="true" />
              </button>
              <Link className="icon-control" to="/notifications" aria-label="通知">
                <Bell aria-hidden="true" />
              </Link>
              <button
                type="button"
                className="icon-control"
                onClick={onProfile}
                aria-haspopup="dialog"
                aria-label={`${name || '我的'}个人资料`}
              >
                <UserRound aria-hidden="true" />
              </button>
              </> : <Link className="masthead-login" to="/auth" state={{ from: pathname }}>登录</Link>}
            </div>
          </div>
          <nav className="masthead-nav" aria-label="主导航">
            {[
              ['/', '首页'], ['/announcements', '公告'], ['/news', '新闻'],
              ['/events', '活动'], ['/resources', '资源'], ['/social', '班级动态'],
              ['/functions', '功能'],
            ].map(([url, label]) => (
              <Link
                key={url}
                to={url}
                aria-current={sectionFor(pathname) === url ? 'page' : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
    </div>
  );
}
