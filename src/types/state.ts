/**
 * Global application state type definitions
 * Defines the complete FireOSState interface and initialization logic
 */

import type { PortfolioProfile, Holdings, DematHoldings, AlphaTrackerDataCollection, SIPFunds, OtherHoldings, Liabilities } from './portfolio';
import type { CurrencyRateCacheMap, CurrencyRateData, HistoricalSeries, NiftyData, NAVCacheMap } from './api';
import type { SyncMetadata, FirebaseUser } from './firebase';
import * as v from 'valibot';

// Firebase User type - Firebase authenticated user or null
export type FirebaseUserType = FirebaseUser | null;

/** Cached market history series keyed by `nifty`, `nav:<schemeCode>`, or `<key>|<start>|<end>` for ranged requests. */
export type MarketHistoryCacheMap = Record<string, HistoricalSeries>;

/**
 * Maximum age of a cached history series before it is served as `stale`.
 * Market history (Nifty levels, fund NAVs) updates at most daily, so the
 * history TTL matches the 24-hour currency-rate spot cache.
 */
export const HISTORY_CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Maximum number of cached history series persisted per scope. Bounds key
 * growth from per-range requests; older series are evicted first.
 */
export const HISTORY_CACHE_MAX_ENTRIES = 8;

/**
 * Serialized byte budget for the `marketHistory` persistence section.
 * 256 KiB keeps the local state payload well below the documented 750 KB
 * ceiling in docs/README.md even in the worst case; the cloud envelope
 * excludes market history entirely.
 */
export const HISTORY_CACHE_MAX_BYTES = 256 * 1024;

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

export interface EsopHolding {
  name: string;
  symbol: string;
  quantity: number;
  currency: string;
}

export interface EsopDetails {
  shares: number;
  holdings?: EsopHolding[];
  grantPrice: number;
  liquidationShares?: number;
  vestingFmv?: number;
  currentPrice?: number;
  slabRate?: number;
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
  otherHoldings: OtherHoldings; // User-defined holdings
  liabilities: Liabilities;
  demat: DematHoldings; // Demat stock holdings

  // API Cache and Live Data
  nav: NAVCacheMap; // Cached NAV values for mutual funds
  niftyHigh: number; // Nifty 52-week high (or current level as fallback)
  niftyData?: NiftyData; // Complete Nifty data with timestamp
  currencyRates: CurrencyRateCacheMap;
  /**
   * Bounded market history cache (Nifty/NAV series). Persisted locally only;
   * excluded from the Firestore envelope and capped by HISTORY_CACHE_MAX_*.
   */
  marketHistory?: MarketHistoryCacheMap;
  /** @deprecated Read legacy data only; new writes use currencyRates. */
  eurInr?: number;
  /** @deprecated Read legacy data only; new writes use currencyRates. */
  eurInrData?: CurrencyRateData;

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

/** Top-level keys accepted in persisted portfolio data (allowlist). */
export const PERSISTED_STATE_KEYS = [
  'profile', 'mf', 'fd', 'epf', 'sip', 'esop', 'bonds', 'otherHoldings', 'liabilities', 'demat', 'nav',
  'niftyHigh', 'niftyData', 'currencyRates', 'marketHistory', 'eurInr', 'eurInrData', 'alphaTrackerData',
  'coorgCorpus', 'coorgStartDate', 'coorgTarget', 'coorgMonthlyAmount',
  'watchdogRules', 'swpSchedule', 'taxCalendar', 'expenses', 'netWorthHistory',
  'completedActions', 'achievedMilestones', 'insurance', 'esopDetails',
] as const;

const finiteNumberSchema = v.pipe(v.number(), v.finite());
const timestampSchema = v.pipe(v.string(), v.check((value) => Number.isFinite(Date.parse(value))));
const statusSchema = v.picklist(['live', 'cache-fresh', 'stale', 'manual']);
const legacyNiftyStatusSchema = v.picklist(['live', 'cache-fresh', 'manual']);
const profileSchema = v.strictObject({
  name: v.string(), dateOfBirth: v.optional(v.string()), age: finiteNumberSchema,
  taxSlabRate: v.optional(finiteNumberSchema),
  // profile.annualExpenses: monthly ₹ — legacy key name says annual; consumers multiply by 12
  annualExpenses: finiteNumberSchema,
  fiTarget: finiteNumberSchema, monthlyIncome: finiteNumberSchema,
});
const holdingMapSchema = v.record(v.string(), v.strictObject({ amount: finiteNumberSchema, currency: v.string() }));
const otherHoldingMapSchema = v.record(v.string(), v.strictObject({
  name: v.pipe(v.string(), v.check((name) => name.trim().length > 0 && name.length <= 200)),
  amount: v.pipe(finiteNumberSchema, v.minValue(0)),
  annualReturn: v.pipe(finiteNumberSchema, v.minValue(0), v.maxValue(100)),
}));
const sipMapSchema = v.record(v.string(), v.strictObject({
  name: v.string(), schemeCode: v.optional(v.string()), units: finiteNumberSchema,
  startDate: v.string(), monthlyAmount: finiteNumberSchema, costBasis: v.optional(finiteNumberSchema),
}));
const dematMapSchema = v.record(v.string(), v.strictObject({
  isin: v.string(), quantity: finiteNumberSchema, currentValue: finiteNumberSchema, name: v.string(),
}));
const navMapSchema = v.record(v.string(), v.strictObject({
  schemeCode: v.string(), nav: finiteNumberSchema, timestamp: timestampSchema, ttl: finiteNumberSchema,
  source: v.exactOptional(v.string()), status: v.exactOptional(statusSchema),
}));
const currencyRateSchema = v.strictObject({
  rate: finiteNumberSchema, timestamp: timestampSchema, sourceCurrency: v.exactOptional(v.string()),
  targetCurrency: v.exactOptional(v.string()), source: v.exactOptional(v.string()), status: v.exactOptional(statusSchema),
});
const historicalPointSchema = v.strictObject({
  date: v.pipe(v.string(), v.check((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)))),
  value: v.pipe(finiteNumberSchema, v.check((value) => value > 0)),
});
const historicalSeriesSchema = v.strictObject({
  points: v.array(historicalPointSchema),
  source: v.string(),
  fetchedAt: timestampSchema,
  status: statusSchema,
});
const marketHistorySchema = v.pipe(
  v.record(v.string(), historicalSeriesSchema),
  v.maxEntries(HISTORY_CACHE_MAX_ENTRIES),
);
const persistedPortfolioShape = {
  profile: v.exactOptional(profileSchema), mf: v.exactOptional(sipMapSchema), fd: v.exactOptional(holdingMapSchema),
  epf: v.exactOptional(holdingMapSchema), sip: v.exactOptional(sipMapSchema), esop: v.exactOptional(holdingMapSchema),
  bonds: v.exactOptional(holdingMapSchema), otherHoldings: v.exactOptional(otherHoldingMapSchema),
  liabilities: v.exactOptional(v.pipe(v.record(v.string(), v.strictObject({
    name: v.pipe(v.string(), v.maxLength(100)), amount: v.pipe(finiteNumberSchema, v.minValue(0)),
  })), v.maxEntries(50))),
  demat: v.exactOptional(dematMapSchema), nav: v.exactOptional(navMapSchema), niftyHigh: v.exactOptional(finiteNumberSchema),
  niftyData: v.exactOptional(v.strictObject({
    level: finiteNumberSchema, high52w: finiteNumberSchema, timestamp: timestampSchema, source: v.string(),
    status: v.exactOptional(legacyNiftyStatusSchema),
  })),
  currencyRates: v.exactOptional(v.record(v.string(), currencyRateSchema)),
  marketHistory: v.exactOptional(marketHistorySchema),
  eurInr: v.exactOptional(finiteNumberSchema),
  eurInrData: v.exactOptional(currencyRateSchema),
  alphaTrackerData: v.exactOptional(v.record(v.string(), v.strictObject({
    fund: v.string(), benchmark: v.string(), year: finiteNumberSchema, return: finiteNumberSchema, benchmarkReturn: finiteNumberSchema,
  }))),
  coorgCorpus: v.exactOptional(finiteNumberSchema), coorgStartDate: v.exactOptional(v.string()),
  coorgTarget: v.exactOptional(finiteNumberSchema), coorgMonthlyAmount: v.exactOptional(finiteNumberSchema),
  watchdogRules: v.exactOptional(v.strictObject({
    ppfcfAumLimit: finiteNumberSchema, nipponGrowthBlockThreshold: finiteNumberSchema,
    nipponSmallCapBlockThreshold: finiteNumberSchema,
    currentAum: v.strictObject({ PPFCF: finiteNumberSchema }),
    blockedDays: v.strictObject({ NipponGrowth: finiteNumberSchema, NipponSmallCap: finiteNumberSchema }),
    managerExits: v.strictObject({ PPFCF: v.boolean(), NipponSmallCap: v.boolean() }),
  })),
  swpSchedule: v.exactOptional(v.strictObject({ enabled: v.boolean(), startDate: v.string(), monthlyAmount: finiteNumberSchema, rate: finiteNumberSchema })),
  taxCalendar: v.exactOptional(v.strictObject({ lastLTCGHarvestDate: v.string(), lastHarvestedAmount: finiteNumberSchema, harvestTarget: finiteNumberSchema })),
  expenses: v.exactOptional(v.array(v.strictObject({ date: v.string(), category: v.string(), amount: finiteNumberSchema, linkedToSWP: v.boolean() }))),
  netWorthHistory: v.exactOptional(v.array(v.strictObject({ date: v.string(), value: finiteNumberSchema }))),
  completedActions: v.exactOptional(v.record(v.string(), v.strictObject({ completedAt: timestampSchema }))),
  achievedMilestones: v.exactOptional(v.array(v.string())),
  insurance: v.exactOptional(v.strictObject({
    termLife: v.strictObject({ currentCover: finiteNumberSchema, annualPremium: finiteNumberSchema, expiryDate: v.string(), provider: v.string() }),
    health: v.strictObject({ currentCover: finiteNumberSchema, annualPremium: finiteNumberSchema, familySize: finiteNumberSchema, provider: v.string() }),
    vehicle: v.strictObject({ covered: v.boolean(), annualPremium: finiteNumberSchema }),
  })),
  esopDetails: v.exactOptional(v.strictObject({
    shares: finiteNumberSchema,
    holdings: v.optional(v.pipe(v.array(v.strictObject({ name: v.string(), symbol: v.string(), quantity: finiteNumberSchema, currency: v.string() })), v.maxLength(20))),
    grantPrice: finiteNumberSchema, liquidationShares: v.optional(finiteNumberSchema), vestingFmv: v.optional(finiteNumberSchema),
    currentPrice: v.optional(finiteNumberSchema), slabRate: v.optional(finiteNumberSchema),
    vestingSchedule: v.array(v.strictObject({ date: v.string(), shares: finiteNumberSchema })),
    triggers: v.strictObject({ marriage: v.boolean(), childBirth: v.boolean(), jobChange: v.boolean(), coorgConstruction: v.boolean() }),
  })),
};

/** Exact allowlisted persisted shape; omitted sections remain valid for legacy data. */
export const persistedPortfolioSchema = v.strictObject(persistedPortfolioShape);
export type PersistedPortfolioData = v.InferOutput<typeof persistedPortfolioSchema>;

/** Validate the shared persisted payload used by localStorage and Firestore. */
export function isPersistedPortfolioData(value: unknown): value is Partial<FireOSState> {
  return v.is(persistedPortfolioSchema, value);
}

/** Validate a single cached history series before it enters memory or persistence. */
export function isValidHistoricalSeries(value: unknown): value is HistoricalSeries {
  return v.is(historicalSeriesSchema, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

/**
 * Remove an invalid market history section before full validation so a
 * corrupted cache can never discard the rest of the portfolio payload.
 */
function dropMalformedMarketHistory(value: unknown): unknown {
  if (!isRecord(value) || !('marketHistory' in value)) return value;
  if (v.is(marketHistorySchema, value.marketHistory)) return value;
  const cleaned = { ...value };
  delete cleaned.marketHistory;
  return cleaned;
}

/**
 * Attach market history as a non-enumerable state field.
 *
 * Market history is a local-only cache: Firestore rules reject unknown data
 * fields on the portfolio document, so every JSON representation of state
 * (envelope clones, sessionStorage snapshots, backups, assistant context)
 * must exclude it. Property access (`state.marketHistory`) works normally.
 */
function defineMarketHistory(state: FireOSState, value: MarketHistoryCacheMap): FireOSState {
  Object.defineProperty(state, 'marketHistory', {
    value,
    writable: true,
    enumerable: false,
    configurable: true,
  });
  return state;
}

/**
 * Copy persisted state onto a live state object.
 *
 * Object.assign copies only own enumerable properties, and marketHistory is
 * non-enumerable, so the history handoff must be explicit — otherwise the
 * target keeps its empty default, `initAPIModule()` hydrates an empty cache,
 * and the next save erases the persisted history.
 */
export function applyPersistedState(target: FireOSState, source: FireOSState): FireOSState {
  Object.assign(target, source);
  return defineMarketHistory(target, source.marketHistory ?? {});
}

/**
 * Initialize a new FireOSState object with sensible defaults
 * @returns A fresh FireOSState with empty collections and default values
 */
export function initializeState(): FireOSState {
  const state: FireOSState = {
    // Profile with zero defaults
    profile: {
      name: '',
      dateOfBirth: '',
      age: 0,
      annualExpenses: 0,
      fiTarget: 0,
      monthlyIncome: 0,
      taxSlabRate: 30,
    },

    // Empty holdings
    mf: {},
    fd: {},
    epf: {},
    sip: {},
    esop: {},
    bonds: {},
    otherHoldings: {},
    liabilities: {},
    demat: {},

    // API cache and defaults
    nav: {},
    niftyHigh: 0,
    currencyRates: {},

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
      shares: 0,
      holdings: [],
      grantPrice: 0,
      liquidationShares: 0,
      vestingFmv: 0,
      slabRate: 30,
      vestingSchedule: [],
      triggers: {
        marriage: false,
        childBirth: false,
        jobChange: false,
        coorgConstruction: false,
      },
    },
  };
  return defineMarketHistory(state, {});
}

/** Fill omitted top-level persisted sections with current application defaults. */
export function normalizePersistedState(value: unknown): FireOSState | null {
  const payload = dropMalformedMarketHistory(value);
  if (!isPersistedPortfolioData(payload)) return null;

  const defaults = initializeState();
  const data = payload as Partial<FireOSState>;
  const normalized: FireOSState = {
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
  return defineMarketHistory(normalized, data.marketHistory ?? {});
}

/** Type guard for a complete in-memory state, including runtime-only fields. */
export function isFireOSState(value: unknown): value is FireOSState {
  if (!isRecord(value)) return false;
  if (!hasOnlyKeys(value, [...PERSISTED_STATE_KEYS, 'currentUser', '_lastSavedAt', '_syncMetadata'])) return false;
  const persistedData = Object.fromEntries(
    PERSISTED_STATE_KEYS.filter((key) => key in value).map((key) => [key, value[key]]),
  );
  const requiredPersistedKeys = PERSISTED_STATE_KEYS.filter((key) => !['niftyData', 'eurInr', 'eurInrData', 'marketHistory'].includes(key));
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
    ...(incoming.liabilities && { liabilities: { ...existing.liabilities, ...incoming.liabilities } }),
    ...(incoming.nav && { nav: { ...existing.nav, ...incoming.nav } }),
    ...(incoming.niftyHigh && { niftyHigh: incoming.niftyHigh }),
    ...(incoming.niftyData !== undefined && { niftyData: incoming.niftyData }),
    ...(incoming.currencyRates && { currencyRates: { ...existing.currencyRates, ...incoming.currencyRates } }),
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
