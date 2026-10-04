import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { hasConsent, subscribeConsent } from '../lib/privacy/consent';

// Navigation stays usable in this tab even when optional storage is disabled.
const positions = new Map<string, number>();
export default function ScrollToTop() {
  const { key, pathname, hash } = useLocation(); const navigation = useNavigationType();
  useEffect(() => { const previous = window.history.scrollRestoration; window.history.scrollRestoration = 'manual'; return () => { window.history.scrollRestoration = previous; }; }, []);
  useEffect(() => {
    // Hash navigation owns its scroll target; route restoration must not undo it.
    if (hash) return;
    const storageKey = `classhub:scroll:${pathname}:${key}`;
    let target = navigation === 'POP' ? positions.get(storageKey) || 0 : 0;
    try { if (navigation === 'POP' && hasConsent('preferences')) target = Number(sessionStorage.getItem(storageKey) || target); } catch { /* Optional session storage. */ }
    let stopped = false; let last = target;
    const remember = () => {
      positions.set(storageKey, last);
      if (!hasConsent('preferences')) return;
      try { sessionStorage.setItem(storageKey, String(last)); } catch { /* Private mode may disable storage. */ }
    };
    const save = () => { last = window.scrollY; remember(); };
    const unsubscribe = subscribeConsent(() => { if (hasConsent('preferences')) save(); });
    const scroll = () => { if (stopped || Math.abs(window.scrollY - target) < 2) save(); };
    const cancel = () => { stopped = true; save(); };
    const cancelKey = (event: KeyboardEvent) => { if (!event.ctrlKey && !event.metaKey && !event.altKey && ['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key) && !(event.target instanceof Element && event.target.closest('input,textarea,[contenteditable], [role=dialog]'))) cancel(); };
    const timers = [0,100,350,750,1500].map(delay => window.setTimeout(() => { if (!stopped) window.scrollTo({ top: target, behavior:'instant' }); },delay));
    window.addEventListener('scroll',scroll,{passive:true}); window.addEventListener('wheel',cancel,{passive:true}); window.addEventListener('touchstart',cancel,{passive:true}); window.addEventListener('click',save,true); window.addEventListener('pagehide',save); window.addEventListener('keydown',cancelKey);
    return () => { timers.forEach(clearTimeout); unsubscribe(); remember(); window.removeEventListener('scroll',scroll); window.removeEventListener('wheel',cancel); window.removeEventListener('touchstart',cancel); window.removeEventListener('click',save,true); window.removeEventListener('pagehide',save); window.removeEventListener('keydown',cancelKey); };
  }, [key,pathname,hash,navigation]);
  return null;
}
