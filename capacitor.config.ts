import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dhananjaytech.pdfchef',
  appName: 'PDF Chef',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  cordova: {
    accessOrigins: [],
  },
};

export default config;
