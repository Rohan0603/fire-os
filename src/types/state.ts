/**
 * Global application state type definitions
 * Defines the complete FireOSState interface and initialization logic
 */

import type { PortfolioProfile, Holdings, DematHoldings, AlphaTrackerDataCollection } from './portfolio';
import type { NiftyData, EURINRData, NAVCacheMap } from './api';
import type { SyncMetadata, FirebaseUser } from './firebase';

// Firebase User type - Firebase authenticated user or null
export type FirebaseUserType = FirebaseUser | null;

/** Complete global application state */
export interface FireOSState {
  // User Profile
  profile: PortfolioProfile;

  // Holdings by type
  mf: Holdings; // Mutual funds
  fd: Holdings; // Fixed deposits
  epf: Holdings; // EPF balances
  sip: Holdings; // SIP investments
  esop: Holdings; // ESOP stocks
  demat: DematHoldings; // Demat stock holdings

  // API Cache and Live Data
  nav: NAVCacheMap; // Cached NAV values for mutual funds
  niftyHigh: number; // Nifty 52-week high (or current level as fallback)
  niftyData?: NiftyData; // Complete Nifty data with timestamp
  eurInr: number; // EUR/INR exchange rate
  eurInrData?: EURINRData; // Complete exchange rate data with timestamp

  // Alpha Tracking
  alphaTrackerData: AlphaTrackerDataCollection; // Fund vs benchmark returns

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
    demat: {},

    // API cache and defaults
    nav: {},
    niftyHigh: 0,
    eurInr: 0,

    // Tracking
    alphaTrackerData: {},

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
  return (
    typeof value === 'object' &&
    value !== null &&
    'profile' in value &&
    'mf' in value &&
    'fd' in value &&
    'epf' in value &&
    'sip' in value &&
    'esop' in value &&
    'demat' in value &&
    'nav' in value &&
    'alphaTrackerData' in value &&
    'currentUser' in value
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
    ...incoming,
    profile: { ...existing.profile, ...incoming.profile },
    mf: { ...existing.mf, ...incoming.mf },
    fd: { ...existing.fd, ...incoming.fd },
    epf: { ...existing.epf, ...incoming.epf },
    sip: { ...existing.sip, ...incoming.sip },
    esop: { ...existing.esop, ...incoming.esop },
    demat: { ...existing.demat, ...incoming.demat },
    nav: { ...existing.nav, ...incoming.nav },
    alphaTrackerData: { ...existing.alphaTrackerData, ...incoming.alphaTrackerData },
  };
}
