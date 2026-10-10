import React, { useState, useEffect } from 'react';
import { AuthContext, type User } from './authContextState';
import { readToken, clearSession, authHeaders } from '../lib/session';
import { loadCurrentUser } from '../lib/currentUser';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let request = 0;
    const checkAuth = async () => {
      const current = ++request;
      const token = readToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setUser(null);
      try {
        const verifiedUser = await loadCurrentUser(token);
        if (!active || current !== request || readToken() !== token) return;
        setUser(verifiedUser);
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        if (active && current === request) setLoading(false);
      }
    };
    void checkAuth();
    window.addEventListener('auth:changed', checkAuth);
    return () => {
      active = false;
      window.removeEventListener('auth:changed', checkAuth);
    };
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
      clearSession();
      localStorage.setItem('token', data.token);
      localStorage.setItem('authUser', JSON.stringify(data.user));
      setUser(data.user);
      window.dispatchEvent(new Event('auth:changed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    }
  };

  const logout = async () => {
    clearSession();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, getAuthHeaders: authHeaders }}>
      {children}
    </AuthContext.Provider>
  );
};
