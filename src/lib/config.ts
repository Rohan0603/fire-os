/**
 * Global Configuration Module
 * Centralizes all static endpoints, limits, cache TTLs, and goal parameters
 */

export const CONFIG = {
  // Firebase configuration
  firebaseConfig: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  },

  // API Endpoints
  api: {
    mfapiBaseUrl: 'https://api.mfapi.in/mf',
    alloriginsBaseUrl: 'https://api.allorigins.win/get?url=',
    yahooFinanceNifty: 'https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI',
    yahooFinanceEurInr: 'https://query1.finance.yahoo.com/v8/finance/chart/EURINR=X',
  },

  // Cache TTLs in milliseconds
  cacheTtl: {
    nav: 4 * 60 * 60 * 1000,        // 4 hours
    nifty: 60 * 60 * 1000,          // 1 hour
    eurInr: 24 * 60 * 60 * 1000,     // 24 hours
  },

  // Target Allocations (%)
  targetAllocation: {
    PPFCF: 40,
    NipponGrowth: 30,
    NipponSmallCap: 20,
    Gold: 10,
  } as Record<string, number>,

  // Rebalancing Threshold (%)
  driftThreshold: 5,

  // Watchdog Default Limits
  watchdog: {
    ppfcfAumLimit: 175000000000,           // ₹1.75L Cr
    nipponGrowthBlockThreshold: 14,        // 14 days
    nipponSmallCapBlockThreshold: 60,      // 60 days
  },

  // Goal Defaults
  goals: {
    fiTarget: 55000000,                    // ₹5.5Cr
    coorgTarget: 20000000,                 // ₹2Cr
    coorgSipAmount: 10000,                 // ₹10K/month
    swpMonthlyAmount: 122000,              // ₹122K/month
  },

  // Scheme Codes
  schemes: {
    ppfcf: '122639',
    nipponGrowth: '118668',
    nipponSmallCap: '118778',
    goldEtf: '135106',
  },

  // Crash Protocol Parameters
  crashProtocol: {
    drawdowns: {
      medium: 10,    // 10%
      high: 15,      // 15%
      critical: 25,  // 25%
    },
    deployments: {
      mediumPercent: 10,     // 10% of Bonds
      highPercent: 15,       // 15% of Bonds
      criticalPercent: 25,   // 25% of Bonds
    },
  },
};
