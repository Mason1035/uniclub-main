import { useState } from 'react';
// A session retains filters and list modes when returning from a detail page.
export function usePageViewState<T>(key: string, initial: T): [T, (value: T) => void] {
  const storageKey = `classhub:view:${key}`;
  const [value, setValue] = useState<T>(() => { try { const saved = sessionStorage.getItem(storageKey); return saved ? JSON.parse(saved) as T : initial; } catch { return initial; } });
  const update = (next: T) => { setValue(next); try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Storage may be unavailable in private mode. */ } };
  return [value, update];
}
