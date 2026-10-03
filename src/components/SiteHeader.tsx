import { useEffect, useRef, useState } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';
import { useLocation, Link } from 'react-router-dom';
import { Search, Bell, UserRound } from 'lucide-react';
import { sectionFor } from '../lib/navigationState';

export default function SiteHeader({ onSearch, onProfile, name }: {
  onSearch: () => void;
  onProfile: () => void;
  name: string;
}) {
  const { pathname } = useLocation();
  const [compact, setCompact] = useState(false);
  const scope = useRef<HTMLDivElement>(null);
  const currentCompact = useRef(compact);
  currentCompact.current = compact;
  const motion = useRef<gsap.core.Timeline>();
  const transition = useRef<gsap.core.Tween>();

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add({ desktop: '(min-width: 768px)', mobile: '(max-width: 767px)', reduce: '(prefers-reduced-motion: reduce)' }, ({ conditions }) => {
      const select = gsap.utils.selector(scope);
      const brand = select('.masthead-brand')[0] as HTMLElement;
      const desktop = conditions?.desktop;
      motion.current = gsap.timeline({ paused: true, defaults: { duration: 0.26, ease: 'power2.out' } })
        .to(brand, { scale: desktop ? 0.66 : 0.94, y: desktop ? -brand.offsetHeight * 0.17 : 0, transformOrigin: desktop ? 'center center' : 'left center' }, 0)
        .to(select('.masthead-edition'), { autoAlpha: 0 }, 0)
        .to(select('.masthead-nav'), { y: desktop ? -42 : 0 }, 0)
        .to(select('.masthead-paper'), { scaleY: desktop ? () => {
          const height = select('.masthead')[0].getBoundingClientRect().height;
          return (height - 42) / height;
        } : 1, transformOrigin: 'center top' }, 0);
      // The current logo embeds its caption in the bitmap; don't crop or replace it.
      const caption = select('.brand-caption');
      if (caption.length) motion.current.to(caption, { autoAlpha: 0 }, 0);
      motion.current.progress(currentCompact.current ? 1 : 0);
      scope.current?.setAttribute('data-reduced-motion', String(!!conditions?.reduce));
      return () => { transition.current?.kill(); motion.current = undefined; };
    }, scope);
    return () => media.revert();
  }, { scope });
  useGSAP(() => {
    transition.current?.kill();
    const timeline = motion.current;
    if (!timeline) return;
    if (scope.current?.getAttribute('data-reduced-motion') === 'true') timeline.progress(compact ? 1 : 0);
    else transition.current = timeline.tweenTo(compact ? timeline.duration() : 0, { duration: 0.26 });
  }, { scope, dependencies: [compact] });

  useEffect(() => {
    const update = () => setCompact(window.scrollY > 80);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <div ref={scope} className="header-reserve">
      <header className="masthead" data-compact={compact}>
        <div className="masthead-paper" aria-hidden="true" />
        <div className="site-container">
          <div className="masthead-inner">
            <div className="masthead-edition">
              班级信息平台
              <time dateTime={new Date().toISOString().slice(0, 10)}>
                {new Date().toLocaleDateString('zh-CN', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </time>
            </div>
            <Link className="masthead-brand" to="/" aria-label="ClassHub 首页">
              <img
                className="masthead-logo"
                src="/branding/classhub-logo.png"
                alt="ClassHub 软件工程班级信息平台"
                width={1949}
                height={807}
              />
            </Link>
            <div className="masthead-actions">
              <button
                className="icon-control"
                onClick={onSearch}
                aria-label="搜索，快捷键 Ctrl 或 Command K"
                aria-keyshortcuts="Control+K Meta+K"
              >
                <Search />
              </button>
              <Link className="icon-control" to="/notifications" aria-label="通知">
                <Bell />
              </Link>
              <button
                className="icon-control"
                onClick={onProfile}
                aria-label={`${name || '我的'}个人资料`}
              >
                <UserRound />
              </button>
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
