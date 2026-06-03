/**
 * Global application state type definitions
 * Defines the complete FireOSState interface and initialization logic
 */

import type { PortfolioProfile, Holdings, DematHoldings, AlphaTrackerDataCollection, SIPFunds } from './portfolio';
import type { NiftyData, EURINRData, NAVCacheMap } from './api';
import type { SyncMetadata, FirebaseUser } from './firebase';

// Firebase User type - Firebase authenticated user or null
export type FirebaseUserType = FirebaseUser | null;

/** Complete global application state */
export interface FireOSState {
  // User Profile
  profile: PortfolioProfile;

  // Holdings by type
  mf: SIPFunds; // Mutual funds (with SIP structure)
  fd: Holdings; // Fixed deposits
  epf: Holdings; // EPF balances
  sip: SIPFunds; // SIP investments (with cost basis + XIRR structure)
  esop: Holdings; // ESOP stocks
  bonds: Holdings; // Bonds
  demat: DematHoldings; // Demat stock holdings

  // API Cache and Live Data
  nav: NAVCacheMap; // Cached NAV values for mutual funds
  niftyHigh: number; // Nifty 52-week high (or current level as fallback)
  niftyData?: NiftyData; // Complete Nifty data with timestamp
  eurInr: number; // EUR/INR exchange rate
  eurInrData?: EURINRData; // Complete exchange rate data with timestamp

  // Alpha Tracking
  alphaTrackerData: AlphaTrackerDataCollection; // Fund vs benchmark returns

  // Coorg Goal Tracking (Kerala home purchase by 2036)
  coorgCorpus: number; // Current corpus in rupees
  coorgStartDate: string; // When Coorg SIP starts (YYYY-MM format)
  coorgTarget: number; // Target: ₹2Cr = 20000000
  coorgMonthlyAmount: number; // Monthly SIP amount: ₹10000

  // Watchdog Rules & Alerts (fund health monitoring)
  watchdogRules: {
    ppfcfAumLimit: number; // ₹1.75L Cr = 175000000000
    nipponGrowthBlockThreshold: number; // 14 days
    nipponSmallCapBlockThreshold: number; // 60 days
    currentAum: { PPFCF: number }; // Current AUM values for monitoring
    blockedDays: { NipponGrowth: number; NipponSmallCap: number }; // Redemption block days
    managerExits: {
      PPFCF: boolean; // Rajeev Thakkar exit status
      NipponSmallCap: boolean; // Samir Rachh exit status
    };
  };

  // Authentication & Sync
  currentUser: FirebaseUserType;
  _lastSavedAt: string; // ISO timestamp of last save

  // Sync metadata (internal use)
  _syncMetadata?: SyncMetadata;
}

/**
 * Initialize a new FireOSState object with sensible defaults
 * @returns A fresh FireOSState with empty collections and default values
 */
export function initializeState(): FireOSState {
  return {
    // Profile with zero defaults
    profile: {
      name: '',
      age: 0,
      annualExpenses: 0,
      fiTarget: 0,
    },

    // Empty holdings
    mf: {},
    fd: {},
    epf: {},
    sip: {},
    esop: {},
    bonds: {},
    demat: {},

    // API cache and defaults
    nav: {},
    niftyHigh: 0,
    eurInr: 0,

    // Tracking
    alphaTrackerData: {},

    // Coorg Goal Tracking (Kerala home purchase by 2036)
    coorgCorpus: 0,
    coorgStartDate: '2031-01', // Coorg SIP starts Jan 2031
    coorgTarget: 20000000, // ₹2Cr
    coorgMonthlyAmount: 10000, // ₹10K monthly

    // Watchdog Rules
    watchdogRules: {
      ppfcfAumLimit: 175000000000, // ₹1.75L Cr
      nipponGrowthBlockThreshold: 14, // 14 days
      nipponSmallCapBlockThreshold: 60, // 60 days
      currentAum: { PPFCF: 0 }, // Current AUM values
      blockedDays: { NipponGrowth: 0, NipponSmallCap: 0 }, // Blocked days for redemptions
      managerExits: {
        PPFCF: false, // Not exited
        NipponSmallCap: false, // Not exited
      },
    },

    // Auth
    currentUser: null,
    _lastSavedAt: new Date().toISOString(),

    // Sync metadata
    _syncMetadata: {
      lastSavedAt: new Date().toISOString(),
      isDirty: false,
    },
  };
}

/**
 * Type guard to check if a value is a valid FireOSState
 */
export function isFireOSState(value: unknown): value is FireOSState {
  if (typeof value !== 'object' || value === null) return false;

  const obj = value as Record<string, unknown>;

  // Validate core properties exist and have correct types
  if (typeof obj.watchdogRules !== 'object' || obj.watchdogRules === null) {
    return false;
  }

  const watchdog = obj.watchdogRules as Record<string, unknown>;

  return (
    typeof obj.profile === 'object' &&
    obj.profile !== null &&
    typeof obj.mf === 'object' &&
    typeof obj.fd === 'object' &&
    typeof obj.epf === 'object' &&
    typeof obj.esop === 'object' &&
    typeof obj.bonds === 'object' &&
    typeof obj.demat === 'object' &&
    typeof obj.coorgCorpus === 'number' &&
    typeof obj.coorgStartDate === 'string' &&
    typeof obj.coorgTarget === 'number' &&
    typeof obj.coorgMonthlyAmount === 'number' &&
    typeof watchdog.ppfcfAumLimit === 'number' &&
    typeof watchdog.nipponGrowthBlockThreshold === 'number' &&
    typeof watchdog.nipponSmallCapBlockThreshold === 'number' &&
    typeof watchdog.currentAum === 'object' &&
    typeof watchdog.blockedDays === 'object' &&
    typeof watchdog.managerExits === 'object' &&
    (obj.currentUser === null || typeof obj.currentUser === 'object')
  );
}

/**
 * Merge incoming state with existing state (for Firebase sync)
 * @param existing Current state
 * @param incoming New state from server
 * @returns Merged state
 */
export function mergeState(existing: FireOSState, incoming: Partial<FireOSState>): FireOSState {
  return {
    ...existing,
    // Only merge profile if provided
    ...(incoming.profile && { profile: { ...existing.profile, ...incoming.profile } }),
    // Only merge holdings if provided
    ...(incoming.mf && { mf: { ...existing.mf, ...incoming.mf } }),
    ...(incoming.fd && { fd: { ...existing.fd, ...incoming.fd } }),
    ...(incoming.epf && { epf: { ...existing.epf, ...incoming.epf } }),
    ...(incoming.sip && { sip: { ...existing.sip, ...incoming.sip } }),
    ...(incoming.esop && { esop: { ...existing.esop, ...incoming.esop } }),
    ...(incoming.bonds && { bonds: { ...existing.bonds, ...incoming.bonds } }),
    ...(incoming.demat && { demat: { ...existing.demat, ...incoming.demat } }),
    ...(incoming.nav && { nav: { ...existing.nav, ...incoming.nav } }),
    ...(incoming.niftyHigh && { niftyHigh: incoming.niftyHigh }),
    ...(incoming.niftyData !== undefined && { niftyData: incoming.niftyData }),
    ...(incoming.eurInr !== undefined && { eurInr: incoming.eurInr }),
    ...(incoming.eurInrData !== undefined && { eurInrData: incoming.eurInrData }),
    ...(incoming.alphaTrackerData && { alphaTrackerData: { ...existing.alphaTrackerData, ...incoming.alphaTrackerData } }),
    // Coorg goal fields
    ...(incoming.coorgCorpus !== undefined && { coorgCorpus: incoming.coorgCorpus }),
    ...(incoming.coorgStartDate !== undefined && { coorgStartDate: incoming.coorgStartDate }),
    ...(incoming.coorgTarget !== undefined && { coorgTarget: incoming.coorgTarget }),
    ...(incoming.coorgMonthlyAmount !== undefined && { coorgMonthlyAmount: incoming.coorgMonthlyAmount }),
    // Watchdog rules (merge deeply for nested objects)
    ...(incoming.watchdogRules && {
      watchdogRules: {
        ...existing.watchdogRules,
        ...(incoming.watchdogRules as typeof existing.watchdogRules),
        currentAum: {
          ...existing.watchdogRules.currentAum,
          ...((incoming.watchdogRules as typeof existing.watchdogRules)?.currentAum || {}),
        },
        blockedDays: {
          ...existing.watchdogRules.blockedDays,
          ...((incoming.watchdogRules as typeof existing.watchdogRules)?.blockedDays || {}),
        },
        managerExits: {
          ...existing.watchdogRules.managerExits,
          ...((incoming.watchdogRules as typeof existing.watchdogRules)?.managerExits || {}),
        },
      },
    }),
    // Metadata is only set explicitly, never from incoming
    _lastSavedAt: incoming._lastSavedAt ?? existing._lastSavedAt,
  };
}
