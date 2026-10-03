import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { StatusBar, Style } from '@capacitor/status-bar';

export const initializeMobileFeatures = async () => {
  if (!Capacitor.isNativePlatform()) return;
  // Initialize Status Bar
  await StatusBar.setBackgroundColor({ color: '#ffffff' });
  await StatusBar.setStyle({ style: Style.Dark });

  // Initialize Push Notifications
  await PushNotifications.requestPermissions();
  await PushNotifications.register();

  // Add push notification listeners
  PushNotifications.addListener('registration', (token) => {
    void 0;
  });

  PushNotifications.addListener('registrationError', (error) => {
    console.error('Push registration failed:', error);
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    void 0;
  });

  // Add app state listeners
  App.addListener('appStateChange', ({ isActive }) => {
    void 0;
  });

  App.addListener('appUrlOpen', (data) => {
    void 0;
  });
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