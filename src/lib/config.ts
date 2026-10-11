/**
 * Global Configuration Module
 * Centralizes the static endpoints, cache TTLs, Firebase settings, and the
 * rebalancing allocation used by `portfolio-rebalancing.ts`. Dead fields are
 * gone: watchdog limits, scheme codes, FI/SWP goal defaults, and crash
 * protocol carried owner-specific values and had no consumers.
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

  // Consumed by `src/modules/calculators/portfolio-rebalancing.ts` (destructures
  // both fields). Kept only because that consumer exists; the allocation
  // percentages remain personal-plan debt pending a fund-layer generalization
  // (see the p-config-fix sweep report).
  targetAllocation: {
    PPFCF: 40,
    NipponGrowth: 30,
    NipponSmallCap: 20,
    Gold: 10,
  } as Record<string, number>,
  driftThreshold: 5,
};
