import { useEffect, useState, useSyncExternalStore } from 'react';
import { hasConsent, subscribeConsent } from '../lib/privacy/consent';
// A session retains filters and list modes when returning from a detail page.
export function usePageViewState<T>(key: string, initial: T): [T, (value: T) => void] {
  const storageKey = `classhub:view:${key}`;
  const preferencesAllowed = useSyncExternalStore(subscribeConsent, () => hasConsent('preferences'), () => false);
  const [value, setValue] = useState<T>(() => {
    if (!hasConsent('preferences')) return initial;
    try { const saved = sessionStorage.getItem(storageKey); return saved ? JSON.parse(saved) as T : initial; } catch { return initial; }
  });
  useEffect(() => {
    if (!preferencesAllowed || !hasConsent('preferences')) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* Storage may be unavailable in private mode. */ }
  }, [preferencesAllowed, storageKey, value]);
  const update = (next: T) => { setValue(next); };
  return [value, update];
}
