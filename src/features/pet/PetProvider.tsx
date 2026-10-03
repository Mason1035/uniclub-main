import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useAuth } from '../../context/authContextState';
import { readToken } from '../../lib/session';
import { ClassHubPetConfigStore } from './pet-config';
import { PetContext } from './PetContext';
import type { PetAPI, PetHandle } from './types';

// AuthProvider verifies this identity with the server. The payload comparison
// only prevents a previous account's user object from being paired with a new
// token while an auth:changed request is still in progress.
function matchesIdentity(token: string, userId: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.userId === userId;
  } catch { return false; }
}

export default function PetProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  let token: string | null = null;
  try { token = readToken(); } catch { /* optional pet must not break the app */ }
  const userId = !loading && token && user?.id && matchesIdentity(token, user.id) ? user.id : undefined;
  const store = useMemo(() => userId && token ? new ClassHubPetConfigStore(userId, token) : null, [userId, token]);
  const handle = useRef<PetHandle | null>(null);
  const pet = useMemo<PetAPI>(() => ({
    poke: () => handle.current?.poke(),
    celebrate: () => handle.current?.celebrate(),
    say: message => handle.current?.say(message),
    setBusy: (busy, message) => handle.current?.setBusy(busy, message),
    perform: action => handle.current?.perform(action),
    resetPosition: () => handle.current?.resetPosition(),
  }), []);
  const context = useMemo(() => ({ store, pet, register: (next: PetHandle | null) => { handle.current = next; } }), [store, pet]);
  useEffect(() => store?.start(), [store]);
  return <PetContext.Provider value={context}>{children}</PetContext.Provider>;
}
