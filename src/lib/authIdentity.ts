import type { User } from '../context/authContextState';
import { normalizeAccess } from './roles';
import { readToken } from './session';

let scopedToken: string | null = null;
let scopeSequence = 0;
export function sessionScope(token: string | null): string {
  if (token !== scopedToken) { scopedToken = token; scopeSequence++; }
  return token ? `session-${scopeSequence}` : 'guest';
}

export interface AuthSnapshot {
  scope: string;
  token: string | null;
  user: User | null;
  verified: boolean;
  verifying: boolean;
}

/** Cache is presentation only. Privileged controls wait for server permissions. */
export function readAuthSnapshot(): AuthSnapshot {
  const token = readToken();
  let user: User | null = null;
  if (token) {
    try {
      const cached = JSON.parse(localStorage.getItem('authUser') || 'null');
      if (typeof cached?.name === 'string' && cached.name && typeof cached.uniqueId === 'string' && cached.uniqueId) {
        user = {
          id: typeof cached.id === 'string' ? cached.id : cached.uniqueId,
          uniqueId: cached.uniqueId, name: cached.name,
          displayName: typeof cached.displayName === 'string' ? cached.displayName : null,
          email: typeof cached.email === 'string' ? cached.email : '',
          avatarUrl: typeof cached.avatarUrl === 'string' ? cached.avatarUrl : undefined,
          avatar: cached.avatar && typeof cached.avatar.data === 'string' ? cached.avatar : undefined,
          ...normalizeAccess(null),
        };
      }
    } catch { /* A damaged/missing display cache never invalidates a token. */ }
  }
  return { scope: sessionScope(token), token, user, verified: false, verifying: !!token };
}

export function saveAuthIdentity(user: User): void {
  // Do not persist authorization, business data or the full profile response.
  const serialized = JSON.stringify({ id: user.id, uniqueId: user.uniqueId, name: user.name,
    displayName: user.displayName, email: user.email, avatarUrl: user.avatarUrl || null,
    ...(!user.avatarUrl && user.avatar?.data ? { avatar: user.avatar } : {}) });
  try {
    if (localStorage.getItem('authUser') !== serialized) localStorage.setItem('authUser', serialized);
  } catch { /* Identity remains usable when optional browser writes fail. */ }
}
