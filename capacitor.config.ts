import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kccobranzas.app',
  appName: 'KC Cobranzas',
  webDir: 'www',
  server: {
    url: 'https://kc-cobranzas.vercel.app',
    cleartext: true,
    allowNavigation: ['kc-cobranzas.vercel.app'],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
    },
  },
};

export default config;
