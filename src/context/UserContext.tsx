import { useEffect, useState, useSyncExternalStore, type ReactNode, type SetStateAction } from 'react';
import { normalizeAccess } from '../lib/roles';
import { readToken } from '../lib/session';
import { saveAuthIdentity } from '../lib/authIdentity';
import { useAuth, type User as Identity } from './authContextState';
import { UserContext, type User, type AuthUser } from './userContextState';
import { hasConsent, subscribeConsent } from '../lib/privacy/consent';

const defaultUser: User = {
  id: '', email: '', name: '', uniqueId: '',
  profile: { bio: '', location: '', website: '', interests: [] },
  major: '', year: '', memberId: '', profileImage: null, ...normalizeAccess(null),
};
const profileUser = (identity: Identity | null): User => identity ? {
  ...defaultUser, ...normalizeAccess(identity), id: identity.id, email: identity.email || '',
  name: identity.name, displayName: identity.displayName, uniqueId: identity.uniqueId,
  memberId: identity.uniqueId, profile: identity.profile || defaultUser.profile,
  profileImage: identity.avatarUrl || identity.avatar?.data || null,
} : { ...defaultUser };

/** Profile edits stay local; authentication and verification belong to AuthProvider. */
export const UserProvider = ({ children }: { children: ReactNode }) => {
  const auth = useAuth();
  const preferencesAllowed = useSyncExternalStore(subscribeConsent, () => hasConsent('preferences'), () => false);
  type Edits = { token: string | null; baseline: User; user: User };
  const [edited, setEdited] = useState<Edits | null>(null);
  const mergeEdits = (identity: Identity | null, changes: Edits | null): User => {
    const current = profileUser(identity);
    if (!identity || !changes || changes.token !== readToken() || changes.user.id !== identity.id) return current;
    // Keep an edit when a check started before the save returns the old field.
    // A genuinely newer server value wins; permissions always come from identity.
    for (const key of ['name', 'displayName', 'email', 'profile', 'profileImage', 'major', 'year'] as const) {
      if (JSON.stringify(current[key]) === JSON.stringify(changes.baseline[key])) {
        Object.assign(current, { [key]: changes.user[key] });
      }
    }
    return current;
  };
  const user = mergeEdits(auth.user, edited);
  const setUser = (action: SetStateAction<User>) => {
    setEdited(previous => {
      if (!auth.user) return null;
      const current = mergeEdits(auth.user, previous);
      const next = typeof action === 'function' ? action(current) : action;
      // Local profile setters cannot alter a verified role or another account.
      return { token: readToken(), baseline: profileUser(auth.user), user: { ...next, id: auth.user.id,
        uniqueId: auth.user.uniqueId, ...normalizeAccess(auth.user) } };
    });
  };
  useEffect(() => {
    if (!auth.user || !readToken()) return;
    saveAuthIdentity({ ...auth.user, name: user.name, displayName: user.displayName, email: user.email,
      avatarUrl: user.profileImage && !user.profileImage.startsWith('data:') ? user.profileImage : undefined,
      avatar: user.profileImage?.startsWith('data:') ? { data: user.profileImage, contentType: 'image/webp' } : undefined });
    if (!preferencesAllowed || !hasConsent('preferences')) return;
    try {
      if (user.profileImage) localStorage.setItem('userProfileImage', user.profileImage);
      else localStorage.removeItem('userProfileImage');
    } catch { /* Optional avatar storage never controls authentication. */ }
  }, [auth.user, preferencesAllowed, user.name, user.displayName, user.email, user.profileImage]);
  const login = (token: string, identity: AuthUser) => auth.establishSession(token, {
    ...identity, id: (identity as AuthUser & { id?: string }).id || identity.uniqueId,
  });
  const logout = () => { void auth.logout(); };
  const setAuthUser = (identity: AuthUser | null) => {
    if (!identity) { logout(); return; }
    setUser(previous => ({ ...previous, name: identity.name, displayName: identity.displayName, email: identity.email }));
  };
  return <UserContext.Provider value={{ user, authUser: auth.user, isAuthenticated: !!auth.user,
    isLoading: auth.loading, setUser, setAuthUser,
    updateProfileImage: async image => { setUser(previous => ({ ...previous, profileImage: image })); },
    login, logout }}>{children}</UserContext.Provider>;
};
