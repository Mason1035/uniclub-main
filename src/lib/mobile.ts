import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { StatusBar, Style } from '@capacitor/status-bar';

export const initializeMobileFeatures = async (signal?: AbortSignal) => {
  if (!Capacitor.isNativePlatform() || signal?.aborted) return () => {};
  const listeners: PluginListenerHandle[] = [];
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    signal?.removeEventListener('abort', stop);
    void Promise.allSettled(listeners.splice(0).map(handle => handle.remove()));
  };
  const retain = async (pending: Promise<PluginListenerHandle>) => {
    const handle = await pending;
    if (stopped) await handle.remove();
    else listeners.push(handle);
  };
  signal?.addEventListener('abort', stop, { once: true });

  try {
    await StatusBar.setBackgroundColor({ color: '#ffffff' });
    if (stopped) return stop;
    await StatusBar.setStyle({ style: Style.Dark });
    if (stopped) return stop;

    // Install listeners before registration can emit the token/error event.
    await Promise.all([
      retain(PushNotifications.addListener('registration', () => {})),
      retain(PushNotifications.addListener('registrationError', error => {
        console.error('Push registration failed:', error);
      })),
      retain(PushNotifications.addListener('pushNotificationReceived', () => {})),
      retain(App.addListener('appStateChange', () => {})),
      retain(App.addListener('appUrlOpen', () => {})),
    ]);
    if (stopped) return stop;
    const permission = await PushNotifications.requestPermissions();
    if (!stopped && permission.receive === 'granted') await PushNotifications.register();
    return stop;
  } catch (error) {
    stop();
    throw error;
  }
};

export const triggerHapticFeedback = async (type: 'light' | 'medium' | 'heavy' = 'light') => {
  try {
    switch (type) {
      case 'light':
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'medium':
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'heavy':
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
    }
  } catch (error) {
    console.error('Haptic feedback failed:', error);
  }
};
