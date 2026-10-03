/**
 * Legacy portfolio-demo session cleanup.
 *
 * The original Uniclub build auto-signed-in every visitor with a hard-coded
 * `portfolio-demo-token` so that recruiters could browse the app without an
 * account. ClassHub is a real platform, so that behaviour has been removed.
 *
 * This module now only makes sure a previously stored demo session can no
 * longer keep anyone signed in as a fake user.
 */

export const LEGACY_DEMO_TOKEN = 'portfolio-demo-token';

const SESSION_KEYS = ['token', 'authToken', 'authUser', 'user'];

/** True when this browser still holds the retired demo session. */
export const hasLegacyDemoSession = (): boolean => {
  try {
    return [window.localStorage, window.sessionStorage].some(
      (store) =>
        store.getItem('token') === LEGACY_DEMO_TOKEN ||
        store.getItem('authToken') === LEGACY_DEMO_TOKEN
    );
  } catch {
    return false;
  }
};

/** Drop any leftover portfolio-demo session so the user lands on the sign-in page. */
export const cleanupLegacyDemoSession = (): void => {
  try {
    [window.localStorage, window.sessionStorage].forEach((store) => {
      const isDemo =
        store.getItem('token') === LEGACY_DEMO_TOKEN ||
        store.getItem('authToken') === LEGACY_DEMO_TOKEN;
      if (isDemo) {
        SESSION_KEYS.forEach((key) => store.removeItem(key));
      }
    });
  } catch (error) {
    console.warn('Failed to clear legacy demo session:', error);
  }
};
