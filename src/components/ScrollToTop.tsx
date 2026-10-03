import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
export default function ScrollToTop() {
  const { key, pathname, hash } = useLocation(); const navigation = useNavigationType();
  useEffect(() => { const previous = window.history.scrollRestoration; window.history.scrollRestoration = 'manual'; return () => { window.history.scrollRestoration = previous; }; }, []);
  useEffect(() => {
    // Hash navigation owns its scroll target; route restoration must not undo it.
    if (hash) return;
    const storageKey = `classhub:scroll:${pathname}:${key}`;
    let target = 0; try { if (navigation === 'POP') target = Number(sessionStorage.getItem(storageKey) || 0); } catch { /* Optional session storage. */ }
    let stopped = false; let last = target;
    const save = () => { last = window.scrollY; try { sessionStorage.setItem(storageKey, String(last)); } catch { /* Private mode may disable storage. */ } };
    const scroll = () => { if (stopped || Math.abs(window.scrollY - target) < 2) save(); };
    const cancel = () => { stopped = true; save(); };
    const cancelKey = (event: KeyboardEvent) => { if (!event.ctrlKey && !event.metaKey && !event.altKey && ['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key) && !(event.target instanceof Element && event.target.closest('input,textarea,[contenteditable], [role=dialog]'))) cancel(); };
    const timers = [0,100,350,750,1500].map(delay => window.setTimeout(() => { if (!stopped) window.scrollTo({ top: target, behavior:'instant' }); },delay));
    window.addEventListener('scroll',scroll,{passive:true}); window.addEventListener('wheel',cancel,{passive:true}); window.addEventListener('touchstart',cancel,{passive:true}); window.addEventListener('click',save,true); window.addEventListener('pagehide',save); window.addEventListener('keydown',cancelKey);
    return () => { timers.forEach(clearTimeout); try { sessionStorage.setItem(storageKey,String(last)); } catch { /* Optional session storage. */ } window.removeEventListener('scroll',scroll); window.removeEventListener('wheel',cancel); window.removeEventListener('touchstart',cancel); window.removeEventListener('click',save,true); window.removeEventListener('pagehide',save); window.removeEventListener('keydown',cancelKey); };
  }, [key,pathname,hash,navigation]);
  return null;
}
