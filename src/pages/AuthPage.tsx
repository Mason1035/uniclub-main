import LiquidGlass from '../components/LiquidGlass';
import { useTheme } from '../context/themeContextState';
import { Navigate, Link, useLocation } from 'react-router-dom';
import { useUser } from '../context/userContextState';
import SignInForm from './SignInForm';
import Illustration from '../components/Illustration';
import { useAuth } from '../context/authContextState';
import BrandLogo from '../components/BrandLogo';
import { useMindMarketDesign } from '../design/mindmarket/DesignContext';
import { MMRiveScene } from '../design/mindmarket/MMRiveScene';
import '../design/mindmarket/about.css';

export default function AuthPage() {
  const mindmarket = useMindMarketDesign();
  const { isAuthenticated, isLoading } = useUser();
  const auth = useAuth();
  const { isDarkMode } = useTheme();
  const { state } = useLocation();
  const from = state?.from;
  const destination = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && from !== '/auth' ? from : '/';
  if (!isLoading && !auth.loading && isAuthenticated && auth.user) return <Navigate to={destination} replace/>;
  if (mindmarket) return <main className="mm-auth">
    <section className="mm-auth__brand">
      <BrandLogo className="auth-logo" alt="ClassHub 软件工程班级信息平台" sizes="(max-width: 767px) 136px, 210px" decoding="async"/>
      <span className="mm-auth__kicker">OUR EVERYDAY. ALL IN ONE PLACE.</span>
      <h1>班级日常，<br/>一起记录。</h1>
      <p>软件工程班级信息平台<br/>查公告、找资料、参与活动。</p>
      <MMRiveScene src="/mindmarket/rive/scientist.riv" className="mm-auth__character"/>
    </section>
    <section className="mm-auth__form" aria-labelledby="mm-auth-heading">
      <span className="mm-about-kicker">HELLO AGAIN / 欢迎回来</span>
      <h2 id="mm-auth-heading">从这里，回到班级。</h2>
      <p>账号由管理员统一开通，使用学号或教职工编号和密码登录。新建学生账号的初始密码为学号。</p>
      <SignInForm/>
      <Link className="mm-auth__back" to="/">先浏览公开首页 <span aria-hidden="true">↗</span></Link>
    </section>
  </main>;
  return <main className="auth-layout">
    <section className="auth-brand">
      <div className="auth-logo-wrap">
      <BrandLogo
        className="auth-logo"
        alt="ClassHub 软件工程班级信息平台"
        sizes="(max-width: 767px) 256px, 320px"
        decoding="async"
      />
      {isDarkMode && <span className="masthead-logo-contrast" aria-hidden="true"><BrandLogo className="auth-logo" alt="" sizes="(max-width: 767px) 256px, 320px"/></span>}
      </div>
      <h1>班级日常，<br/>一起记录。</h1>
      <p>软件工程班级信息平台<br/>查公告、找资料、参与活动。</p>
      <Illustration kind="gallery" size="large" className="auth-illustration"/>
    </section>
    <LiquidGlass as="section" density="workspace" className="auth-form">
      <h2>欢迎回来</h2>
      <p className="text-sm text-muted-foreground mb-6">账号由管理员统一开通，使用学号或教职工编号和密码登录。新建学生账号的初始密码为学号。</p>
      <SignInForm/>
      <Link className="text-link inline-flex min-h-11 items-center mt-4 text-sm" to="/">先浏览公开首页 →</Link>
    </LiquidGlass>
  </main>;
}
