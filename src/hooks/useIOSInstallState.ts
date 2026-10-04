import { useEffect, useState } from 'react';
import { canOfferIOSInstall, IOS_INSTALL_MOBILE_QUERY, IOS_INSTALL_STANDALONE_QUERY } from '../lib/iosInstall';

function readEligibility(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  const iosNavigator = window.navigator as Navigator & { standalone?: boolean };
  return canOfferIOSInstall({
    userAgent: iosNavigator.userAgent || '',
    maxTouchPoints: iosNavigator.maxTouchPoints || 0,
    mobile: window.matchMedia(IOS_INSTALL_MOBILE_QUERY).matches,
    standalone: iosNavigator.standalone === true || window.matchMedia(IOS_INSTALL_STANDALONE_QUERY).matches,
  });
}

/** Session-only eligibility. Dismissing the teaching sheet never hides the card. */
export function useIOSInstallState(): boolean {
  const [eligible, setEligible] = useState(readEligibility);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const update = () => setEligible(readEligibility());
    const queries = [IOS_INSTALL_MOBILE_QUERY, IOS_INSTALL_STANDALONE_QUERY].map(query => window.matchMedia(query));
    queries.forEach(query => {
      if (typeof query.addEventListener === 'function') query.addEventListener('change', update);
      else query.addListener(update);
    });
    window.addEventListener('pageshow', update);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      queries.forEach(query => {
        if (typeof query.removeEventListener === 'function') query.removeEventListener('change', update);
        else query.removeListener(update);
      });
      window.removeEventListener('pageshow', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return eligible;
}
