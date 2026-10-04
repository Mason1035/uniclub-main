export const readToken = (): string | null => {
  try { return localStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('authToken'); }
  catch { return null; }
};

export const clearSession = (): void => {
  for (const area of ['localStorage', 'sessionStorage'] as const) {
    try {
      for (const key of ['token', 'authToken', 'authUser', 'user', 'userProfileImage']) window[area].removeItem(key);
    } catch { /* A guest can still browse when browser storage is disabled. */ }
  }
  window.dispatchEvent(new Event('auth:changed'));
};

export const authHeaders = (): Record<string, string> => {
  const token = readToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
