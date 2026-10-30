import { useEffect, useState } from 'react';

// Like the HTML brand preloader, the home entrance belongs to a tab session.
// Keep a separate key: the preloader claims its own key before React renders.
const HOME_ENTRY_SEEN = 'classhub-home-entry-seen';
let seenInDocument = false;

function hasSeenHomeEntry(): boolean {
  if (seenInDocument || typeof window === 'undefined') return true;
  try {
    if (window.sessionStorage.getItem(HOME_ENTRY_SEEN) === '1') return true;
  } catch { /* In-memory route visits still work when storage is unavailable. */ }
  // A reload should expose the complete composition even if storage is blocked
  // or this tab was open before the session marker was introduced.
  const navigation = window.performance?.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
  return navigation?.type === 'reload' || navigation?.type === 'back_forward';
}

/** Freeze one decision per mount; render never consumes the first entrance.
 * React StrictMode can render/replay effects twice without changing that decision.
 * Every homepage participant rendered in the same commit receives the same result. */
export function useHomeEntryAnimation(): boolean {
  const [animate] = useState(() => !hasSeenHomeEntry());
  useEffect(() => {
    seenInDocument = true;
    try { window.sessionStorage.setItem(HOME_ENTRY_SEEN, '1'); }
    catch { /* Keep this document's in-memory session. */ }
  }, []);
  return animate;
}
