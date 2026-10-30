import { useQueryClient } from '@tanstack/react-query';
import { hasPermission, roleOf } from '../../lib/roles';
import { AdminSessionContext } from './adminSession';
/** Server-verified staff gate; every API also enforces its own capability. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, LockKeyhole, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  clearSession,
  errorMessage,
  fetchMe,
  loginAsAdmin,
  readToken,
  type SessionUser,
} from './adminApi';
import { AdminButton, Field, TextInput } from './components';
import AppearanceToggle from '../../components/AppearanceToggle';
import LiquidGlass from '../../components/LiquidGlass';


type Status = 'checking' | 'anonymous' | 'denied' | 'granted';

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="admin-auth-shell flex min-h-screen items-center justify-center px-4 py-20">
    <AppearanceToggle className="appearance-toggle--floating" />
    <div className="w-full max-w-md">{children}</div>
  </div>
);

const Brand: React.FC = () => (
  <div className="mb-6 flex flex-col items-center gap-2 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-sm bg-primary/10 text-primary">
      <ShieldCheck className="h-6 w-6" />
    </span>
    <h1 className="text-xl font-semibold text-foreground">ClassHub 管理后台</h1>
    <p className="text-xs text-muted-foreground">软件工程班级信息中枢 · 班委 / 老师 / 管理员</p>
  </div>
);

const AdminLoginForm: React.FC<{ onSuccess: (user: SessionUser) => void; notice?: string }> = ({
  onSuccess,
  notice,
}) => {
  const [uniqueId, setUniqueId] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await loginAsAdmin(uniqueId.trim(), password);
      if (!hasPermission(user, 'backend')) {
        setError('当前身份没有后台访问权限。');
        return;
      }
      onSuccess(user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-material glass-material--workspace space-y-4 p-6"
    >
      {notice && (
        <p className="rounded-sm bg-primary/10 px-3 py-2 text-xs text-foreground dark:text-foreground">
          {notice}
        </p>
      )}
      <Field label="学号 / 教职工编号" required>
        <TextInput
          type="text"
          autoComplete="username"
          value={uniqueId}
          onChange={(e) => setUniqueId(e.target.value)}
          placeholder="输入学号或教职工 / 管理员编号"
          required
        />
      </Field>
      <Field label="密码" required>
        <TextInput
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
      </Field>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <AdminButton type="submit" loading={submitting} className="w-full">
        登录管理后台
      </AdminButton>
      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        班委、老师和管理员可使用自己的账号登录。
        <br />
        需要开通权限时，请联系网站负责人。
      </p>
    </form>
  );
};

const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<Status>('checking');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [notice, setNotice] = useState('');
  const cache = useQueryClient();
  const currentUser = useRef<SessionUser | null>(null);
  const currentToken = useRef<string | null>(null);
  const requestVersion = useRef(0);
  const alive = useRef(true);

  const check = useCallback(async () => {
    const version = ++requestVersion.current;
    const token = readToken();
    if (!currentUser.current || currentToken.current !== token) setStatus('checking');
    if (!token) {
      currentUser.current = null; currentToken.current = null;
      setUser(null);
      setStatus('anonymous');
      return;
    }
    try {
      const me = await fetchMe();
      if (!alive.current || version !== requestVersion.current || readToken() !== token) return;
      const before = currentUser.current;
      if (before && (before.id !== me.id || roleOf(before) !== roleOf(me) || JSON.stringify(before.permissions) !== JSON.stringify(me.permissions))) cache.clear();
      currentUser.current = me; currentToken.current = token;
      if (hasPermission(me, 'backend')) {
        setUser(me);
        setStatus('granted');
      } else {
        setUser(me);
        setStatus('denied');
      }
    } catch (error) {
      if (!alive.current || version !== requestVersion.current || readToken() !== token) return;
      setStatus('anonymous');
      setNotice(errorMessage(error));
    }
  }, [cache]);

  const stopChecking = useCallback(() => { alive.current = false; ++requestVersion.current; }, []);

  useEffect(() => {
    alive.current = true;
    void check();
    const sync = () => { void check(); };
    const visible = () => { if (!document.hidden) sync(); };
    const storage = (event: StorageEvent) => { if (event.key === null || ['token', 'authToken', 'authUser'].includes(event.key)) sync(); };
    window.addEventListener('auth:changed', sync);
    window.addEventListener('auth:permissions-changed', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visible);
    return () => {
      stopChecking();
      window.removeEventListener('auth:changed', sync);
      window.removeEventListener('auth:permissions-changed', sync);
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [check, stopChecking]);

  if (status === 'checking') {
    return (
      <div className="admin-auth-shell flex min-h-screen items-center justify-center gap-3 text-sm text-muted-foreground">
        <AppearanceToggle className="appearance-toggle--floating"/>
        <Loader2 className="h-5 w-5 animate-spin" />
        正在校验后台访问权限…
      </div>
    );
  }

  if (status === 'granted' && user) {
    return <AdminSessionContext.Provider key={`${user.id || user.uniqueId}:${roleOf(user)}:${user.permissions?.join(",")}`} value={user}>{children}</AdminSessionContext.Provider>;
  }

  if (status === 'denied') {
    return (
      <Shell>
        <Brand />
        <LiquidGlass as="section" density="workspace" className="p-6 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-sm bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <h2 className="text-base font-semibold text-foreground">无后台访问权限</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {user?.uniqueId || user?.name || '当前账号'} 当前身份没有后台访问权限，学生可使用班级前台功能。
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <AdminButton
              variant="secondary"
              onClick={() => {
                clearSession();
                setUser(null);
                setNotice('');
                setStatus('anonymous');
              }}
            >
              切换账号
            </AdminButton>
            <AdminButton variant="ghost" onClick={() => void check()}>
              重新校验
            </AdminButton>
          </div>
        </LiquidGlass>
      </Shell>
    );
  }

  return (
    <Shell>
      <Brand />
      <div className="mb-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <LockKeyhole className="h-3.5 w-3.5" />
        班委、老师和管理员可访问
      </div>
      <AdminLoginForm notice={notice} onSuccess={(next) => {
        currentUser.current = next; currentToken.current = readToken();
        setUser(next);
        setNotice('');
        setStatus('granted');
      }} />
    </Shell>
  );
};

export default AdminGuard;
