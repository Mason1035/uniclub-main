export const CONSENT_VERSION = 1 as const;
export const CONSENT_STORAGE_KEY = 'classhub_cookie_consent';

export interface ConsentRecord {
  version: typeof CONSENT_VERSION;
  necessary: true;
  preferences: boolean;
  statistics: boolean;
  updatedAt: string;
}
type OptionalConsent = Pick<ConsentRecord, 'preferences' | 'statistics'>;
const listeners = new Set<() => void>();
let initialized = false;
let current: ConsentRecord | null = null;

function readStoredConsent(): ConsentRecord | null {
  try {
    const value = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY) || 'null');
    if (value?.version !== CONSENT_VERSION || value.necessary !== true ||
        typeof value.preferences !== 'boolean' || typeof value.statistics !== 'boolean' ||
        typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))) return null;
    return { version: CONSENT_VERSION, necessary: true, preferences: value.preferences,
      statistics: value.statistics, updatedAt: value.updatedAt };
  } catch { return null; }
}

export function getConsent(): ConsentRecord | null {
  if (!initialized) { initialized = true; current = readStoredConsent(); }
  return current;
}

export function hasConsent(category: keyof OptionalConsent): boolean {
  return getConsent()?.[category] === true;
}

// Revoking preferences removes optional caches, never tokens or account settings.
function removePreferences(): void {
  for (const area of ['localStorage', 'sessionStorage'] as const) {
    try {
      const storage = window[area];
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
      for (const key of keys) {
        if (key && (['theme', 'userProfileImage'].includes(key) ||
          ['classhub:view:', 'classhub:scroll:', 'classhub:pet-position:'].some(prefix => key.startsWith(prefix)))) {
          storage.removeItem(key);
        }
      }
    } catch { /* Storage can be unavailable; in-memory UI remains usable. */ }
  }
  try {
    if (typeof document !== 'undefined') document.cookie = 'sidebar:state=; path=/; max-age=0; SameSite=Lax';
  } catch { /* Cookie storage can also be disabled. */ }
}

function notify(): void { listeners.forEach(listener => listener()); }

export function saveConsent(choice: OptionalConsent): boolean {
  current = { version: CONSENT_VERSION, necessary: true, preferences: choice.preferences,
    statistics: choice.statistics, updatedAt: new Date().toISOString() };
  initialized = true;
  let persisted = false;
  try { localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(current)); persisted = true; } catch {
    // A failed rejection must not leave a previous persistent grant behind.
    try { localStorage.removeItem(CONSENT_STORAGE_KEY); } catch { /* Session-only choice; storage unavailable. */ }
  }
  if (!choice.preferences) removePreferences();
  notify();
  return persisted;
}

function onStorage(event: StorageEvent): void {
  if (event.key !== CONSENT_STORAGE_KEY && event.key !== null) return;
  current = readStoredConsent();
  initialized = true;
  if (!current?.preferences) removePreferences();
  notify();
}

export function subscribeConsent(listener: () => void): () => void {
  if (!listeners.size) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener('storage', onStorage);
  };
}
