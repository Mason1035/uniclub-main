import { Navigate, Link, useLocation } from 'react-router-dom';
import { useUser } from '../context/userContextState';
import SignInForm from './SignInForm';
import Illustration from '../components/Illustration';
import { useAuth } from '../context/authContextState';
import BrandLogo from '../components/BrandLogo';

export default function AuthPage() {
  const { isAuthenticated, isLoading } = useUser();
  const auth = useAuth();
  const { state } = useLocation();
  const from = state?.from;
  const destination = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && from !== '/auth' ? from : '/';
  if (!isLoading && !auth.loading && isAuthenticated && auth.user) return <Navigate to={destination} replace/>;
  return <main className="auth-layout">
    <section className="auth-brand">
      <BrandLogo
        className="auth-logo"
        alt="ClassHub 软件工程班级信息平台"
        sizes="(max-width: 767px) 256px, 320px"
        decoding="async"
      />
      <h1>班级日常，<br/>一起记录。</h1>
      <p>软件工程班级信息平台<br/>查公告、找资料、参与活动。</p>
      <Illustration kind="gallery" size="large" className="auth-illustration"/>
    </section>
    <section className="auth-form">
      <h2>欢迎回来</h2>
      <p className="text-sm text-muted-foreground mb-6">账号由管理员统一开通，使用学号和密码登录。新建学生账号的初始密码为学号。</p>
      <SignInForm/>
      <Link className="text-link inline-flex min-h-11 items-center mt-4 text-sm" to="/">先浏览公开首页 →</Link>
    </section>
  </main>;
}
