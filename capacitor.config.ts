import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uniclub.app',
  appName: 'Uniclub',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
