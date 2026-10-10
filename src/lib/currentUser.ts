import type { User as AuthUser } from '../context/authContextState';
import type { User } from '../context/userContextState';
import { clearSession, readToken } from './session';

export interface CurrentUser extends AuthUser {
  uniqueId: string;
  isAdmin: boolean;
  profile?: User['profile'];
}

// Both providers need the same verified account. Share only requests in flight;
// completed responses are not retained across account or profile changes.
const pending = new Map<string, Promise<CurrentUser>>();

export function loadCurrentUser(token: string): Promise<CurrentUser> {
  const existing = pending.get(token);
  if (existing) return existing;

  const request = (async () => {
    const headers = { Authorization: `Bearer ${token}` };
    const response = await fetch('/api/auth/me', { headers });
    if (!response.ok) {
      if (response.status === 401 && readToken() === token) clearSession();
      throw new Error(`Current user request failed: ${response.status}`);
    }
    const data = await response.json();
    if (!data.user?.id || !data.user.name || !data.user.uniqueId) {
      throw new Error('Invalid current user response');
    }
    const user: CurrentUser = data.user;

    // Compatibility with a backend that has not yet added profile to auth/me.
    if (!user.profile && readToken() === token) {
      try {
        const profileResponse = await fetch('/api/users/me', { headers });
        if (profileResponse.status === 401 && readToken() === token) clearSession();
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          if (profileData.success && profileData.user?.id === user.id) {
            user.profile = profileData.user.profile;
            user.avatar = profileData.user.avatar || profileData.user.profile?.avatar || user.avatar;
          }
        }
      } catch { /* Identity remains verified if only the old profile endpoint fails. */ }
    }
    return user;
  })();
  pending.set(token, request);
  void request.finally(() => {
    if (pending.get(token) === request) pending.delete(token);
  }).catch(() => { /* The providers handle the original request failure. */ });
  return request;
}
