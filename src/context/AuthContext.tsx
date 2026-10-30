import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { AuthContext, type User } from './authContextState';
import { readToken, clearSession, authHeaders } from '../lib/session';
import { normalizeAccess } from '../lib/roles';
import { loadCurrentUser } from '../lib/currentUser';
import { readAuthSnapshot, saveAuthIdentity, sessionScope } from '../lib/authIdentity';

/** One session owner. UserProvider only adapts this identity for profile consumers. */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState(readAuthSnapshot);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    // The HTML shell hides its anonymous SSR placeholders until this first commit.
    document.documentElement.removeAttribute('data-classhub-session-pending');
  }, []);

  useEffect(() => {
    let active = true;
    let request = 0;
    let lastVerifiedAt = 0;
    const checkAuth = async () => {
      const current = ++request;
      const initial = readAuthSnapshot();
      const token = initial.token;
      if (!token) {
        setSession(initial);
        setError(null);
        return;
      }
      setSession(previous => previous.token === token
        ? { ...previous, verifying: true }
        : initial);
      try {
        const user = await loadCurrentUser(token);
        if (!active || current !== request || readToken() !== token) return;
        saveAuthIdentity(user);
        lastVerifiedAt = Date.now();
        setSession(previous => ({ ...previous, token, user, verified: true, verifying: false }));
        setError(null);
      } catch {
        if (!active || current !== request || readToken() !== token) return;
        // Only a confirmed 401 clears storage (inside loadCurrentUser). Network
        // failures keep the already painted identity and never masquerade as guests.
        setSession(previous => ({ ...previous, verifying: false }));
        setError('暂时无法确认登录状态，请检查网络后重试。');
      }
    };
    const refresh = () => { void checkAuth(); };
    const focused = () => { if (!document.hidden && Date.now() - lastVerifiedAt > 30000) refresh(); };
    refresh();
    window.addEventListener('auth:changed', refresh);
    window.addEventListener('auth:permissions-changed', refresh);
    window.addEventListener('focus', focused);
    document.addEventListener('visibilitychange', focused);
    // App translates cross-tab storage changes into auth:changed once.
    return () => {
      active = false;
      window.removeEventListener('auth:changed', refresh);
      window.removeEventListener('auth:permissions-changed', refresh);
      window.removeEventListener('focus', focused);
      document.removeEventListener('visibilitychange', focused);
    };
  }, []);

  const establishSession = useCallback((token: string, identity: User) => {
    if (!token || !identity.name || !identity.uniqueId) return;
    clearSession();
    localStorage.setItem('token', token);
    const user = { ...identity, id: identity.id || identity.uniqueId, ...normalizeAccess(identity) };
    saveAuthIdentity(user);
    setSession({ scope: sessionScope(token), token, user, verified: true, verifying: true });
    setError(null);
    window.dispatchEvent(new Event('auth:changed'));
  }, []);

  const login = async (uniqueId: string, password: string) => {
    try {
      setError(null);
      const response = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uniqueId: uniqueId.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');
      establishSession(data.token, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    }
  };
  const logout = useCallback(async () => {
    clearSession();
    setSession({ scope: 'guest', token: null, user: null, verified: false, verifying: false });
  }, []);
  const loading = !!session.token && !session.user;
  const status = session.user ? 'member' : session.token ? 'checking' : 'guest';
  return <AuthContext.Provider value={{ user: session.user, loading, error, login, logout,
    verifying: session.verifying, verified: session.verified, hasToken: !!session.token,
    status, accountKey: session.scope, establishSession, getAuthHeaders: authHeaders }}>{children}</AuthContext.Provider>;
};
