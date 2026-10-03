export type BrowserNotificationState = NotificationPermission | 'unsupported';
export function browserNotificationState(): BrowserNotificationState {
  try { return typeof window !== 'undefined' && 'Notification' in window && window.isSecureContext ? Notification.permission : 'unsupported'; }
  catch { return 'unsupported'; }
}
// Called exclusively by the user's switch interaction, never on mount.
export async function enableBrowserNotifications(): Promise<BrowserNotificationState> {
  const state = browserNotificationState();
  if (state === 'unsupported' || state === 'denied' || state === 'granted') return state;
  try { return await Notification.requestPermission(); } catch { return browserNotificationState(); }
}
