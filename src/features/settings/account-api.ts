import api from '../../lib/axios';
import { readToken } from '../../lib/session';
import type { AccountProfile, AccountSecurity } from './types';
async function ownedRequest<T>(operation: () => Promise<{ data: T }>): Promise<T> {
  const token = readToken();
  const { data } = await operation();
  if (!token || readToken() !== token) throw new Error('当前账号已变化，请重新登录后操作。');
  return data;
}
export const saveProfile = (displayName: string, bio: string) => ownedRequest<{ profile: AccountProfile }>(() => api.put('/api/users/profile', { displayName, bio }));
export const saveEmail = (email: string) => ownedRequest<{ security: AccountSecurity }>(() => api.patch('/api/users/me/email', { email: email.trim() || null }));
export const changePassword = (body: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
  ownedRequest<{ success: boolean; requiresLogin: boolean }>(() => api.post('/api/auth/change-password', body));
export function accountError(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { error?: unknown } }; message?: string };
  return typeof candidate.response?.data?.error === 'string' ? candidate.response.data.error : candidate.message === '当前账号已变化，请重新登录后操作。' ? candidate.message : fallback;
}
