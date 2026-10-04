import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Cookie, ArrowLeft, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getConsent, saveConsent, subscribeConsent } from '@/lib/privacy/consent';
import CookieIllustration from './CookieIllustration';
import './cookie-consent.css';

type View = 'intro' | 'settings' | 'closed';

function useDesktop() {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const update = () => setDesktop(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return desktop;
}

export default function CookieConsent() {
  const consent = useSyncExternalStore(subscribeConsent, getConsent, getConsent);
  const desktop = useDesktop();
  const [view, setView] = useState<View>(() => getConsent() ? 'closed' : 'intro');
  const [preferences, setPreferences] = useState(false);
  const [statistics, setStatistics] = useState(false);
  const [sessionOnly, setSessionOnly] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const controlRef = useRef<HTMLButtonElement>(null);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const focusHeading = useRef(false);
  const focusControl = useRef(false);
  const focusChoice = useRef(false);

  useEffect(() => {
    // React to consent changes in another tab without resetting a manually opened view.
    setView(current => consent ? (current === 'intro' ? 'closed' : current) : 'intro');
  }, [consent]);

  useEffect(() => {
    if (!desktop) return;
    if (view === 'settings' && focusHeading.current) {
      headingRef.current?.focus();
      focusHeading.current = false;
    }
    if (view === 'closed' && focusControl.current) {
      controlRef.current?.focus();
      focusControl.current = false;
    }
    if (view === 'intro' && focusChoice.current) {
      chooseRef.current?.focus();
      focusChoice.current = false;
    }
  }, [desktop, view]);

  const openSettings = () => {
    setPreferences(consent?.preferences ?? false);
    setStatistics(consent?.statistics ?? false);
    focusHeading.current = true;
    setView('settings');
  };

  const close = () => {
    focusControl.current = true;
    setView('closed');
  };

  const choose = (allowPreferences: boolean, allowStatistics: boolean) => {
    const persisted = saveConsent({ preferences: allowPreferences, statistics: allowStatistics });
    setSessionOnly(!persisted);
    close();
  };

  const back = () => {
    if (consent) close();
    else {
      focusChoice.current = true;
      setView('intro');
    }
  };

  if (!desktop) return null;

  return (
    <div className="cookie-consent">
      {view === 'closed' ? (
        <>
          {sessionOnly && <p className="cookie-consent__storage-notice" role="status">选择已用于本次访问，浏览器未能记住它。</p>}
          <button ref={controlRef} className="cookie-consent__control" type="button" aria-label="Cookie 设置" onClick={openSettings}>
            <Cookie size={22} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </>
      ) : (
        <section
          className="cookie-consent__card"
          aria-labelledby="classhub-cookie-title"
          onKeyDown={event => {
            if (event.key === 'Escape' && view === 'settings') {
              event.preventDefault();
              back();
            }
          }}
        >
          {view === 'intro' ? (
            <div className="cookie-consent__body cookie-consent__intro">
              <header className="cookie-consent__header">
                <div>
                  <p className="cookie-consent__hello">嗨，我们是 ClassHub</p>
                  <h2 id="classhub-cookie-title">关于 Cookies</h2>
                </div>
                <CookieIllustration />
              </header>
              <p className="cookie-consent__description">我们用浏览器存储维持登录与必要功能。其他用途由你决定，未选择时不会启用。</p>
              <div className="cookie-consent__why">
                <h3>为什么使用浏览器存储</h3>
                <ul>
                  <li>保持登录与请求验证</li>
                  <li>按你的选择记住界面偏好</li>
                  <li>按你的选择记录资源使用次数</li>
                </ul>
              </div>
              <p className="cookie-consent__privacy"><Link to="/privacy">隐私与 Cookie 说明</Link></p>
            </div>
          ) : (
            <div className="cookie-consent__body cookie-consent__settings">
              <header className="cookie-consent__settings-header">
                <button className="cookie-consent__back" type="button" aria-label={consent ? '收起 Cookie 设置' : '返回 Cookie 说明'} onClick={back}>
                  <ArrowLeft size={18} aria-hidden="true" />
                </button>
                <h2 id="classhub-cookie-title" ref={headingRef} tabIndex={-1}>Cookie 设置</h2>
              </header>
              <p className="cookie-consent__description">必要功能始终开启。其他用途可随时调整。</p>
              <div className="cookie-consent__categories">
                <div className="cookie-consent__category">
                  <div><h3>必要功能</h3><p>维持登录、验证身份，并保存本次选择。</p></div>
                  <span className="cookie-consent__necessary"><Check size={12} aria-hidden="true" />始终开启</span>
                </div>
                <label className="cookie-consent__category" htmlFor="classhub-cookie-preferences">
                  <div><span className="cookie-consent__category-title">记住偏好</span><p>记住头像缓存、列表筛选、浏览位置和桌宠位置。</p></div>
                  <input className="cookie-consent__switch" id="classhub-cookie-preferences" type="checkbox" role="switch" checked={preferences} onChange={event => setPreferences(event.target.checked)} />
                </label>
                <label className="cookie-consent__category" htmlFor="classhub-cookie-statistics">
                  <div><span className="cookie-consent__category-title">资源使用统计</span><p>记录打开、预览与下载次数；登录后会关联你的账号。</p></div>
                  <input className="cookie-consent__switch" id="classhub-cookie-statistics" type="checkbox" role="switch" checked={statistics} onChange={event => setStatistics(event.target.checked)} />
                </label>
              </div>
              <p className="cookie-consent__privacy"><Link to="/privacy">了解这些选择</Link></p>
            </div>
          )}
          {view === 'intro' ? (
            <footer className="cookie-consent__footer">
              <button type="button" onClick={() => choose(false, false)}>仅必要</button>
              <button ref={chooseRef} type="button" onClick={openSettings}>我来选择</button>
              <button type="button" className="cookie-consent__accept" onClick={() => choose(true, true)}>全部接受</button>
            </footer>
          ) : (
            <footer className="cookie-consent__footer cookie-consent__footer--settings">
              <button type="button" onClick={back}>返回</button>
              <button type="button" className="cookie-consent__accept" onClick={() => choose(preferences, statistics)}>保存我的选择</button>
            </footer>
          )}
        </section>
      )}
    </div>
  );
}
