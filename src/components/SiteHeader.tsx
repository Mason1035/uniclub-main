import { hasPermission } from '../lib/roles';
import { useMindMarketDesign } from '../design/mindmarket/DesignContext';
import { MMHeader } from '../design/mindmarket/MMHeader';
import AIEntryButton from './AIEntryButton';
import AppearanceToggle from './AppearanceToggle';
import { useTheme } from '../context/themeContextState';
import { useUser } from '../context/userContextState';
import { useRef } from 'react';
import { useHeaderMorph } from '../hooks/useHeaderMorph';
import { useLocation, Link } from 'react-router-dom';
import { Bell, UserRound } from 'lucide-react';
import { sectionFor } from '../lib/navigationState';
import BrandLogo from './BrandLogo';
import './navigation.css';

function LegacySiteHeader({ onSearch, onProfile, name, isAuthenticated, checking = false }: {
  onSearch: () => void;
  onProfile: () => void;
  name: string;
  isAuthenticated: boolean;
  checking?: boolean;
}) {
  const { pathname } = useLocation();
  const { user } = useUser();
  const { isDarkMode } = useTheme();
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
              {isDarkMode && <span className="masthead-logo-contrast" aria-hidden="true">
                <BrandLogo className="masthead-logo" alt="" sizes="(max-width: 767px) 184px, (max-width: 1090px) 240px, (max-width: 1309px) 22vw, 288px" decoding="async"/>
              </span>}
            </Link>
            <div className="masthead-actions">
              <AppearanceToggle/>
              {isAuthenticated ? <>
              <AIEntryButton onClick={onSearch}/>
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
              </> : checking ? <><span className="icon-control" aria-hidden="true" data-auth-placeholder/><span className="icon-control" aria-hidden="true" data-auth-placeholder/><span className="icon-control" aria-hidden="true" data-auth-placeholder/></> : <Link data-auth-guest className="masthead-login" to="/auth" state={{ from: pathname }}>登录</Link>}
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
            {isAuthenticated && hasPermission(user, 'backend') && <Link to="/admin">管理后台</Link>}
          </nav>
        </div>
      </header>
    </div>
  );
}

export default function SiteHeader(props: Parameters<typeof LegacySiteHeader>[0]) {
  const mindmarket = useMindMarketDesign();
  const { user } = useUser();
  return mindmarket ? <MMHeader {...props} access={props.isAuthenticated ? user : null} avatarSrc={props.isAuthenticated ? user.profileImage : null} avatarIdentity={props.isAuthenticated ? user.id || user.uniqueId : null}/> : <LegacySiteHeader {...props}/>;
}
