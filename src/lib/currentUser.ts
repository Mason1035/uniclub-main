import { normalizeAccess } from './roles';
import type { User as AuthUser } from '../context/authContextState';
import type { User } from '../context/userContextState';
import { clearSession, readToken } from './session';

export interface CurrentUser extends AuthUser {
  uniqueId: string;
  isAdmin: boolean;
  profile?: User['profile'];
}

// StrictMode and explicit revalidation share requests in flight;
// completed responses are not retained across account or profile changes.
const pending = new Map<string, Promise<CurrentUser>>();

export function loadCurrentUser(token: string): Promise<CurrentUser> {
  const existing = pending.get(token);
  if (existing) return existing;

  const request = (async () => {
    const headers = { Authorization: `Bearer ${token}` };
    // Retry transport errors once, with a bounded timeout; HTTP denial is final.
    let response: Response;
    let data: { user?: CurrentUser } | undefined;
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        response = await fetch('/api/auth/me', { headers, signal: controller.signal });
        if (response.ok) data = await response.json();
        break;
      } catch (error) {
        if (attempt >= 1 || readToken() !== token) throw error;
      } finally { clearTimeout(timeout); }
    }
    if (!response.ok) {
      if (response.status === 401 && readToken() === token) clearSession();
      throw new Error(`Current user request failed: ${response.status}`);
    }
    if (!data?.user?.id || !data.user.name || !data.user.uniqueId) {
      throw new Error('Invalid current user response');
    }
    const user: CurrentUser = { ...data.user, ...normalizeAccess(data.user) };

    user.profile ||= { bio: '', location: '', website: '', interests: [] };
    return user;
  })();
  pending.set(token, request);
  void request.finally(() => {
    if (pending.get(token) === request) pending.delete(token);
  }).catch(() => { /* The providers handle the original request failure. */ });
  return request;
}
