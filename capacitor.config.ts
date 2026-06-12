import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pipilikaslab.shomiti',
  appName: 'remix-shomiti',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
