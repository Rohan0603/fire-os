/**
 * Global Configuration Module
 * Centralizes the static endpoints, cache TTLs, and Firebase settings. Dead
 * fields are gone: watchdog limits, scheme codes, FI/SWP goal defaults, crash
 * protocol, and the rebalancing allocation (now user-owned fund buckets) all
 * carried owner-specific values and had no place here.
 */

export const CONFIG = {
  // Firebase configuration
  firebaseConfig: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  },

  // API Endpoints
  api: {
    mfapiBaseUrl: 'https://api.mfapi.in/mf',
  },

  // Cache TTLs in milliseconds
  cacheTtl: {
    nav: 4 * 60 * 60 * 1000,        // 4 hours
    nifty: 60 * 60 * 1000,          // 1 hour
    currencyRate: 24 * 60 * 60 * 1000, // 24 hours
  },
};

