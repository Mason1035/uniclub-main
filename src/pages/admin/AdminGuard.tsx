import { AdminSessionContext } from './adminSession';
/**
 * AdminGuard - gates every /admin route.
 *
 * Flow:
 *   1. read the stored JWT
 *   2. GET /api/auth/me
 *   3. not logged in / invalid token  -> inline admin sign-in
 *      logged in but isAdmin !== true -> "无管理员权限"
 *      isAdmin === true               -> render the console
 *
 * This is a UX gate only. Real enforcement happens on the server through
 * `requireAdmin` (User.isAdmin === true in MongoDB) on every /api/admin/* route.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
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


type Status = 'checking' | 'anonymous' | 'denied' | 'granted';

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
    <div className="w-full max-w-md">{children}</div>
  </div>
);

const Brand: React.FC = () => (
  <div className="mb-6 flex flex-col items-center gap-2 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-sm bg-primary/10 text-primary">
      <ShieldCheck className="h-6 w-6" />
    </span>
    <h1 className="text-xl font-semibold text-foreground">ClassHub 管理后台</h1>
    <p className="text-xs text-muted-foreground">软件工程班级信息中枢 · 管理员专用</p>
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
      if (user.isAdmin !== true) {
        setError('该账号不是管理员，无法进入后台。');
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
      className="space-y-4 rounded-sm border border-border bg-card p-6 "
    >
      {notice && (
        <p className="rounded-sm bg-primary/10 px-3 py-2 text-xs text-foreground dark:text-foreground">
          {notice}
        </p>
      )}
      <Field label="管理员学号 / 编号" required>
        <TextInput
          type="text"
          autoComplete="username"
          value={uniqueId}
          onChange={(e) => setUniqueId(e.target.value)}
          placeholder="输入学号或管理员编号"
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
        请使用具有管理员权限的账号登录。
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

  const check = useCallback(async () => {
    setStatus('checking');
    const token = readToken();
    if (!token) {
      setStatus('anonymous');
      return;
    }
    try {
      const me = await fetchMe();
      if (me.isAdmin === true) {
        setUser(me);
        setStatus('granted');
      } else {
        setUser(me);
        setStatus('denied');
      }
    } catch (error) {
      setStatus('anonymous');
      setNotice('当前会话无效或已过期，请重新登录管理员账号。');
      void error;
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-background text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        正在校验管理员权限…
      </div>
    );
  }

  if (status === 'granted' && user) {
    return <AdminSessionContext.Provider value={user}>{children}</AdminSessionContext.Provider>;
  }

  if (status === 'denied') {
    return (
      <Shell>
        <Brand />
        <div className="rounded-sm border border-border bg-card p-6 text-center ">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-sm bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <h2 className="text-base font-semibold text-foreground">无管理员权限</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {user?.uniqueId || user?.name || '当前账号'} 没有管理员权限，无法查看后台数据。
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
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Brand />
      <div className="mb-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <LockKeyhole className="h-3.5 w-3.5" />
        仅管理员可访问
      </div>
      <AdminLoginForm notice={notice} onSuccess={(next) => {
        setUser(next);
        setNotice('');
        setStatus('granted');
      }} />
    </Shell>
  );
};

export default AdminGuard;
