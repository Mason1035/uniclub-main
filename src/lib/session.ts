export const readToken = (): string | null =>
  localStorage.getItem('token') || sessionStorage.getItem('authToken') || localStorage.getItem('authToken');

export const clearSession = (): void => {
  for (const storage of [localStorage, sessionStorage]) {
    for (const key of ['token', 'authToken', 'authUser', 'user', 'userProfileImage']) storage.removeItem(key);
  }
  window.dispatchEvent(new Event('auth:changed'));
};

export const authHeaders = (): Record<string, string> => {
  const token = readToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
