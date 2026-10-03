import { Navigate } from 'react-router-dom';
import { useUser } from '../context/userContextState';
import SignInForm from './SignInForm';
import RisoArtwork from '../components/RisoArtwork';

export default function AuthPage() {
  const { isAuthenticated } = useUser();
  if (isAuthenticated) return <Navigate to="/" replace/>;
  return <main className="auth-layout">
    <section className="auth-brand">
      <img
        className="auth-logo"
        src="/branding/classhub-logo.png"
        alt="ClassHub 软件工程班级信息平台"
        width={1949}
        height={807}
        decoding="async"
      />
      <h1>班级日常，<br/>一起记录。</h1>
      <p>软件工程班级信息平台<br/>查公告、找资料、参与活动。</p>
      <RisoArtwork/>
    </section>
    <section className="auth-form">
      <h2>欢迎回来</h2>
      <p className="text-sm text-muted-foreground mb-6">账号由管理员统一开通，使用学号和密码登录。新建学生账号的初始密码为学号。</p>
      <SignInForm/>
    </section>
  </main>;
}
