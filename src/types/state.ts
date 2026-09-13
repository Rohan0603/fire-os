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

const PERSISTED_STATE_KEYS = [
  'profile', 'mf', 'fd', 'epf', 'sip', 'esop', 'bonds', 'demat', 'nav',
  'niftyHigh', 'niftyData', 'eurInr', 'eurInrData', 'alphaTrackerData',
  'coorgCorpus', 'coorgStartDate', 'coorgTarget', 'coorgMonthlyAmount',
  'watchdogRules', 'swpSchedule', 'taxCalendar', 'expenses', 'netWorthHistory',
  'completedActions', 'achievedMilestones', 'insurance', 'esopDetails',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isProfile(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ['name', 'age', 'annualExpenses', 'fiTarget', 'monthlyIncome'])) return false;
  return typeof value.name === 'string'
    && isFiniteNumber(value.age)
    && isFiniteNumber(value.annualExpenses)
    && isFiniteNumber(value.fiTarget)
    && isFiniteNumber(value.monthlyIncome);
}

function isHoldingMap(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.values(value).every((holding) =>
    isRecord(holding)
    && hasOnlyKeys(holding, ['amount', 'currency'])
    && isFiniteNumber(holding.amount)
    && typeof holding.currency === 'string',
  );
}

function isSipMap(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.values(value).every((fund) =>
    isRecord(fund)
    && hasOnlyKeys(fund, ['name', 'schemeCode', 'units', 'startDate', 'monthlyAmount', 'costBasis'])
    && typeof fund.name === 'string'
    && (fund.schemeCode === undefined || typeof fund.schemeCode === 'string')
    && isFiniteNumber(fund.units)
    && typeof fund.startDate === 'string'
    && isFiniteNumber(fund.monthlyAmount)
    && (fund.costBasis === undefined || isFiniteNumber(fund.costBasis)),
  );
}

function isDematMap(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.values(value).every((holding) =>
    isRecord(holding)
    && hasOnlyKeys(holding, ['isin', 'quantity', 'currentValue', 'name'])
    && typeof holding.isin === 'string'
    && isFiniteNumber(holding.quantity)
    && isFiniteNumber(holding.currentValue)
    && typeof holding.name === 'string',
  );
}

function isNavMap(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.values(value).every((cache) =>
    isRecord(cache)
    && hasOnlyKeys(cache, ['schemeCode', 'nav', 'timestamp', 'ttl'])
    && typeof cache.schemeCode === 'string'
    && isFiniteNumber(cache.nav)
    && isTimestamp(cache.timestamp)
    && isFiniteNumber(cache.ttl),
  );
}

function isNiftyData(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, ['level', 'high52w', 'timestamp', 'source'])
    && isFiniteNumber(value.level)
    && isFiniteNumber(value.high52w)
    && isTimestamp(value.timestamp)
    && typeof value.source === 'string';
}

function isEurInrData(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, ['rate', 'timestamp'])
    && isFiniteNumber(value.rate)
    && isTimestamp(value.timestamp);
}

function isAlphaTrackerMap(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) =>
    isRecord(entry)
    && hasOnlyKeys(entry, ['fund', 'benchmark', 'year', 'return', 'benchmarkReturn'])
    && typeof entry.fund === 'string'
    && typeof entry.benchmark === 'string'
    && isFiniteNumber(entry.year)
    && isFiniteNumber(entry.return)
    && isFiniteNumber(entry.benchmarkReturn),
  );
}

function isWatchdogRules(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ['ppfcfAumLimit', 'nipponGrowthBlockThreshold', 'nipponSmallCapBlockThreshold', 'currentAum', 'blockedDays', 'managerExits'])) return false;
  return isFiniteNumber(value.ppfcfAumLimit)
    && isFiniteNumber(value.nipponGrowthBlockThreshold)
    && isFiniteNumber(value.nipponSmallCapBlockThreshold)
    && isRecord(value.currentAum)
    && hasOnlyKeys(value.currentAum, ['PPFCF'])
    && isFiniteNumber(value.currentAum.PPFCF)
    && isRecord(value.blockedDays)
    && hasOnlyKeys(value.blockedDays, ['NipponGrowth', 'NipponSmallCap'])
    && isFiniteNumber(value.blockedDays.NipponGrowth)
    && isFiniteNumber(value.blockedDays.NipponSmallCap)
    && isRecord(value.managerExits)
    && hasOnlyKeys(value.managerExits, ['PPFCF', 'NipponSmallCap'])
    && typeof value.managerExits.PPFCF === 'boolean'
    && typeof value.managerExits.NipponSmallCap === 'boolean';
}

function isSwpSchedule(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, ['enabled', 'startDate', 'monthlyAmount', 'rate'])
    && typeof value.enabled === 'boolean'
    && typeof value.startDate === 'string'
    && isFiniteNumber(value.monthlyAmount)
    && isFiniteNumber(value.rate);
}

function isTaxCalendar(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, ['lastLTCGHarvestDate', 'lastHarvestedAmount', 'harvestTarget'])
    && typeof value.lastLTCGHarvestDate === 'string'
    && isFiniteNumber(value.lastHarvestedAmount)
    && isFiniteNumber(value.harvestTarget);
}

function isExpenses(value: unknown): boolean {
  return Array.isArray(value) && value.every((expense) =>
    isRecord(expense)
    && hasOnlyKeys(expense, ['date', 'category', 'amount', 'linkedToSWP'])
    && typeof expense.date === 'string'
    && typeof expense.category === 'string'
    && isFiniteNumber(expense.amount)
    && typeof expense.linkedToSWP === 'boolean',
  );
}

function isNetWorthHistory(value: unknown): boolean {
  return Array.isArray(value) && value.every((snapshot) =>
    isRecord(snapshot)
    && hasOnlyKeys(snapshot, ['date', 'value'])
    && typeof snapshot.date === 'string'
    && isFiniteNumber(snapshot.value),
  );
}

function isCompletedActions(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.values(value).every((action) =>
    isRecord(action)
    && hasOnlyKeys(action, ['completedAt'])
    && isTimestamp(action.completedAt),
  );
}

function isInsurance(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ['termLife', 'health', 'vehicle'])) return false;
  return isRecord(value.termLife)
    && hasOnlyKeys(value.termLife, ['currentCover', 'annualPremium', 'expiryDate', 'provider'])
    && isFiniteNumber(value.termLife.currentCover)
    && isFiniteNumber(value.termLife.annualPremium)
    && typeof value.termLife.expiryDate === 'string'
    && typeof value.termLife.provider === 'string'
    && isRecord(value.health)
    && hasOnlyKeys(value.health, ['currentCover', 'annualPremium', 'familySize', 'provider'])
    && isFiniteNumber(value.health.currentCover)
    && isFiniteNumber(value.health.annualPremium)
    && isFiniteNumber(value.health.familySize)
    && typeof value.health.provider === 'string'
    && isRecord(value.vehicle)
    && hasOnlyKeys(value.vehicle, ['covered', 'annualPremium'])
    && typeof value.vehicle.covered === 'boolean'
    && isFiniteNumber(value.vehicle.annualPremium);
}

function isEsopDetails(value: unknown): boolean {
  if (!isRecord(value) || !hasOnlyKeys(value, ['shares', 'grantPrice', 'vestingSchedule', 'triggers'])) return false;
  return isFiniteNumber(value.shares)
    && isFiniteNumber(value.grantPrice)
    && Array.isArray(value.vestingSchedule)
    && value.vestingSchedule.every((item) =>
      isRecord(item)
      && hasOnlyKeys(item, ['date', 'shares'])
      && typeof item.date === 'string'
      && isFiniteNumber(item.shares),
    )
    && isRecord(value.triggers)
    && hasOnlyKeys(value.triggers, ['marriage', 'childBirth', 'jobChange', 'coorgConstruction'])
    && typeof value.triggers.marriage === 'boolean'
    && typeof value.triggers.childBirth === 'boolean'
    && typeof value.triggers.jobChange === 'boolean'
    && typeof value.triggers.coorgConstruction === 'boolean';
}

/** Validate the shared persisted payload used by localStorage and Firestore. */
export function isPersistedPortfolioData(value: unknown): value is Partial<FireOSState> {
  if (!isRecord(value) || !hasOnlyKeys(value, PERSISTED_STATE_KEYS)) return false;
  const data = value;
  if ('profile' in data && !isProfile(data.profile)) return false;
  if ('mf' in data && !isSipMap(data.mf)) return false;
  if ('sip' in data && !isSipMap(data.sip)) return false;
  for (const key of ['fd', 'epf', 'esop', 'bonds'] as const) {
    if (key in data && !isHoldingMap(data[key])) return false;
  }
  if ('demat' in data && !isDematMap(data.demat)) return false;
  if ('nav' in data && !isNavMap(data.nav)) return false;
  if ('niftyHigh' in data && !isFiniteNumber(data.niftyHigh)) return false;
  if ('niftyData' in data && !isNiftyData(data.niftyData)) return false;
  if ('eurInr' in data && !isFiniteNumber(data.eurInr)) return false;
  if ('eurInrData' in data && !isEurInrData(data.eurInrData)) return false;
  if ('alphaTrackerData' in data && !isAlphaTrackerMap(data.alphaTrackerData)) return false;
  for (const key of ['coorgCorpus', 'coorgTarget', 'coorgMonthlyAmount'] as const) {
    if (key in data && !isFiniteNumber(data[key])) return false;
  }
  if ('coorgStartDate' in data && typeof data.coorgStartDate !== 'string') return false;
  if ('watchdogRules' in data && !isWatchdogRules(data.watchdogRules)) return false;
  if ('swpSchedule' in data && !isSwpSchedule(data.swpSchedule)) return false;
  if ('taxCalendar' in data && !isTaxCalendar(data.taxCalendar)) return false;
  if ('expenses' in data && !isExpenses(data.expenses)) return false;
  if ('netWorthHistory' in data && !isNetWorthHistory(data.netWorthHistory)) return false;
  if ('completedActions' in data && !isCompletedActions(data.completedActions)) return false;
  if ('achievedMilestones' in data && (!Array.isArray(data.achievedMilestones) || !data.achievedMilestones.every((id) => typeof id === 'string'))) return false;
  if ('insurance' in data && !isInsurance(data.insurance)) return false;
  if ('esopDetails' in data && !isEsopDetails(data.esopDetails)) return false;
  return true;
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

/** Fill omitted top-level persisted sections with current application defaults. */
export function normalizePersistedState(value: unknown): FireOSState | null {
  if (!isPersistedPortfolioData(value)) return null;

  const defaults = initializeState();
  const data = value as Partial<FireOSState>;
  return {
    ...defaults,
    ...data,
    profile: { ...defaults.profile, ...data.profile },
    watchdogRules: {
      ...defaults.watchdogRules,
      ...data.watchdogRules,
      currentAum: { ...defaults.watchdogRules.currentAum, ...data.watchdogRules?.currentAum },
      blockedDays: { ...defaults.watchdogRules.blockedDays, ...data.watchdogRules?.blockedDays },
      managerExits: { ...defaults.watchdogRules.managerExits, ...data.watchdogRules?.managerExits },
    },
    swpSchedule: { ...defaults.swpSchedule, ...data.swpSchedule },
    taxCalendar: { ...defaults.taxCalendar, ...data.taxCalendar },
    insurance: {
      ...defaults.insurance,
      ...data.insurance,
      termLife: { ...defaults.insurance.termLife, ...data.insurance?.termLife },
      health: { ...defaults.insurance.health, ...data.insurance?.health },
      vehicle: { ...defaults.insurance.vehicle, ...data.insurance?.vehicle },
    },
    esopDetails: {
      ...defaults.esopDetails,
      ...data.esopDetails,
      triggers: { ...defaults.esopDetails.triggers, ...data.esopDetails?.triggers },
    },
  };
}

/** Type guard for a complete in-memory state, including runtime-only fields. */
export function isFireOSState(value: unknown): value is FireOSState {
  if (!isRecord(value)) return false;
  if (!hasOnlyKeys(value, [...PERSISTED_STATE_KEYS, 'currentUser', '_lastSavedAt', '_syncMetadata'])) return false;
  const persistedData = Object.fromEntries(
    PERSISTED_STATE_KEYS.filter((key) => key in value).map((key) => [key, value[key]]),
  );
  const requiredPersistedKeys = PERSISTED_STATE_KEYS.filter((key) => key !== 'niftyData' && key !== 'eurInrData');
  if (!requiredPersistedKeys.every((key) => key in value) || !isPersistedPortfolioData(persistedData)) return false;
  if (value.currentUser !== null && !isRecord(value.currentUser)) return false;
  if (!isTimestamp(value._lastSavedAt)) return false;
  if (value._syncMetadata !== undefined) {
    if (!isRecord(value._syncMetadata)
      || !hasOnlyKeys(value._syncMetadata, ['lastSavedAt', 'lastSyncedAt', 'isDirty'])
      || !isTimestamp(value._syncMetadata.lastSavedAt)
      || (value._syncMetadata.lastSyncedAt !== undefined && !isTimestamp(value._syncMetadata.lastSyncedAt))
      || typeof value._syncMetadata.isDirty !== 'boolean') return false;
  }
  return true;
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
