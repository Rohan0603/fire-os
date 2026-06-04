/**
 * Global application state type definitions
 * Defines the complete FireOSState interface and initialization logic
 */

import type { PortfolioProfile, Holdings, DematHoldings, AlphaTrackerDataCollection, SIPFunds } from './portfolio';
import type { NiftyData, EURINRData, NAVCacheMap } from './api';
import type { SyncMetadata, FirebaseUser } from './firebase';

// Firebase User type - Firebase authenticated user or null
export type FirebaseUserType = FirebaseUser | null;

export interface EsopVestingItem {
  date: string;
  shares: number;
}

export interface EsopTriggers {
  marriage: boolean;
  childBirth: boolean;
  jobChange: boolean;
  coorgConstruction: boolean;
}

export interface EsopDetails {
  shares: number;
  grantPrice: number;
  vestingSchedule: EsopVestingItem[];
  triggers: EsopTriggers;
}

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

  // Auth
  currentUser: FirebaseUserType;
  _lastSavedAt: string; // ISO timestamp of last save

  // SWP & Tax Engine (v3.0)
  swpSchedule: {
    enabled: boolean;
    startDate: string;
    monthlyAmount: number;
    rate: number;
  };
  taxCalendar: {
    lastLTCGHarvestDate: string;
    lastHarvestedAmount: number;
    harvestTarget: number;
  };
  expenses: Array<{
    date: string;
    category: string;
    amount: number;
    linkedToSWP: boolean;
  }>;

  // Plan Tab (v3.1)
  netWorthHistory: Array<{ date: string; value: number }>;
  completedActions: Record<string, { completedAt: string }>;
  achievedMilestones: string[];

  // Insurance Coverage (v3.1)
  insurance: {
    termLife: { currentCover: number; annualPremium: number; expiryDate: string; provider: string };
    health: { currentCover: number; annualPremium: number; familySize: number; provider: string };
    vehicle: { covered: boolean; annualPremium: number };
  };

  // Sync metadata (internal use)
  _syncMetadata?: SyncMetadata;

  // ESOP Details
  esopDetails: EsopDetails;
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
      monthlyIncome: 0,
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

    // SWP & Tax Engine (v3.0)
    swpSchedule: {
      enabled: false,
      startDate: '',
      monthlyAmount: 122000,
      rate: 0.03,
    },
    taxCalendar: {
      lastLTCGHarvestDate: '',
      lastHarvestedAmount: 0,
      harvestTarget: 125000,
    },
    expenses: [],

    // Plan Tab (v3.1)
    netWorthHistory: [],
    completedActions: {},
    achievedMilestones: [],

    // Insurance Coverage (v3.1)
    insurance: {
      termLife: { currentCover: 0, annualPremium: 0, expiryDate: '', provider: '' },
      health: { currentCover: 0, annualPremium: 0, familySize: 1, provider: '' },
      vehicle: { covered: false, annualPremium: 0 },
    },

    // Sync metadata
    _syncMetadata: {
      lastSavedAt: new Date().toISOString(),
      isDirty: false,
    },

    // ESOP details
    esopDetails: {
      shares: 95,
      grantPrice: 45,
      vestingSchedule: [
        { date: '2026-06', shares: 20 },
        { date: '2027-06', shares: 20 },
        { date: '2028-06', shares: 20 },
        { date: '2029-06', shares: 20 },
        { date: '2030-06', shares: 15 },
      ],
      triggers: {
        marriage: false,
        childBirth: false,
        jobChange: false,
        coorgConstruction: false,
      },
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
    typeof obj.esopDetails === 'object' &&
    obj.esopDetails !== null &&
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
    typeof obj.swpSchedule === 'object' &&
    obj.swpSchedule !== null &&
    typeof obj.taxCalendar === 'object' &&
    obj.taxCalendar !== null &&
    Array.isArray(obj.expenses) &&
    Array.isArray(obj.netWorthHistory) &&
    typeof obj.completedActions === 'object' &&
    obj.completedActions !== null &&
    Array.isArray(obj.achievedMilestones) &&
    typeof obj.insurance === 'object' &&
    obj.insurance !== null &&
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
    // SWP & Tax Engine fields
    ...(incoming.swpSchedule && { swpSchedule: { ...existing.swpSchedule, ...incoming.swpSchedule } }),
    ...(incoming.taxCalendar && { taxCalendar: { ...existing.taxCalendar, ...incoming.taxCalendar } }),
    ...(incoming.expenses && { expenses: incoming.expenses }),
    // Plan Tab fields
    ...(incoming.netWorthHistory && { 
      netWorthHistory: [
        ...existing.netWorthHistory, 
        ...incoming.netWorthHistory.filter(newSnap => !existing.netWorthHistory.some(oldSnap => oldSnap.date === newSnap.date))
      ].sort((a, b) => a.date.localeCompare(b.date))
    }),
    ...(incoming.completedActions && { completedActions: { ...existing.completedActions, ...incoming.completedActions } }),
    ...(incoming.achievedMilestones && { achievedMilestones: Array.from(new Set([...existing.achievedMilestones, ...incoming.achievedMilestones])) }),
    // Insurance Coverage
    insurance: {
      ...initializeState().insurance,
      ...existing.insurance,
      ...incoming.insurance,
      termLife: {
        ...initializeState().insurance.termLife,
        ...existing.insurance?.termLife,
        ...incoming.insurance?.termLife,
      },
      health: {
        ...initializeState().insurance.health,
        ...existing.insurance?.health,
        ...incoming.insurance?.health,
      },
      vehicle: {
        ...initializeState().insurance.vehicle,
        ...existing.insurance?.vehicle,
        ...incoming.insurance?.vehicle,
      },
    },
    // ESOP Details
    esopDetails: {
      ...initializeState().esopDetails,
      ...existing.esopDetails,
      ...incoming.esopDetails,
      triggers: {
        ...initializeState().esopDetails.triggers,
        ...existing.esopDetails?.triggers,
        ...incoming.esopDetails?.triggers,
      },
    },
    // Metadata is only set explicitly, never from incoming
    _lastSavedAt: incoming._lastSavedAt ?? existing._lastSavedAt,
  };
}
