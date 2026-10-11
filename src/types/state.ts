/**
 * Global application state type definitions
 * Defines the complete FireOSState interface and initialization logic
 */

import type { PortfolioProfile, Holdings, DematHoldings, AlphaTrackerDataCollection, SIPFunds, OtherHoldings, Liabilities, FundBucket } from './portfolio';
import type { CurrencyRateCacheMap, CurrencyRateData, HistoricalSeries, NiftyData, NAVCacheMap } from './api';
import type { SyncMetadata, FirebaseUser } from './firebase';
import { migratePersistedData } from '../lib/portfolioMigrations';
import { DEFAULT_FUND_BUCKETS } from '../lib/fundMatcher';
import { z } from 'zod';

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

/** Category of a planning goal. Kept open-ended via `custom`. */
export type GoalKind = 'fi' | 'home' | 'education' | 'marriage' | 'vehicle' | 'custom';

/** Inflation assumption for a goal: a named index or an explicit annual percentage. */
export type GoalInflation = 'cpi' | 'education' | 'medical' | number;

export type GoalRiskBucket = 'low' | 'medium' | 'high';

/** A user-defined planning goal (target, funding progress, and assumptions). */
export interface Goal {
  id: string;
  name: string;
  kind: GoalKind;
  /** Target amount expressed in today's rupees. */
  targetToday: number;
  /** Target date in `YYYY-MM` format. */
  targetDate: string;
  inflation: GoalInflation;
  linkedAssetIds: string[];
  /** Corpus saved towards this goal so far, in rupees. */
  currentAmount: number;
  monthlyContribution?: number;
  priority: number;
  riskBucket: GoalRiskBucket;
}

/** What kind of milestone a liquidation rule reacts to. */
export type LiquidationRuleKind = 'marriage' | 'childBirth' | 'jobChange' | 'goal' | 'holdingPeriod' | 'custom';

/** A general ESOP liquidation rule, replacing the old fixed trigger enum. */
export interface LiquidationRule {
  id: string;
  kind: LiquidationRuleKind;
  label: string;
  active: boolean;
  /** Set for `goal` rules to name the goal the proceeds fund. */
  goalId?: string;
  /** Optional cap on how much of the net proceeds this rule allocates. */
  allocateAmount?: number;
  note?: string;
}

export interface EsopHolding {
  name: string;
  symbol: string;
  quantity: number;
  currency: string;
}

/**
 * A user-defined fund watchdog rule: a named holding plus optional thresholds to
 * watch. All thresholds are optional; a rule with none set never fires.
 */
export interface FundWatchdogRule {
  id: string;
  label: string;
  /** Alert when the fund's assets-under-management exceeds this (rupees). */
  aumLimit?: number;
  /** Latest known AUM for this fund (rupees). */
  currentAum?: number;
  /** Alert when redemption has been blocked longer than this many days. */
  blockThresholdDays?: number;
  /** Current consecutive blocked-redemption days. */
  blockedDays?: number;
  /** Alert when the fund's manager has changed. */
  managerExited?: boolean;
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
  /**
   * Holding period (years) for the long-term-capital-gains milestone, measured
   * from the earliest vesting date. Defaults to 5. Replaces the old hard-coded
   * product milestone year.
   */
  holdingPeriodYears?: number;
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

  // Planning goals (general, user-defined)
  goals: Goal[];

  // User-owned fund buckets: labels + target allocation per asset class.
  fundBuckets: FundBucket[];

  // Fund watchdog rules (user-defined; each rule is self-contained)
  watchdogRules: FundWatchdogRule[];

  // Auth
  currentUser: FirebaseUserType;
  _lastSavedAt: string; // ISO timestamp of last save

// SWP & Tax Engine (v3.0)
   swpSchedule: {
     enabled: boolean;
     startDate: string;
     monthlyAmount: number;
     rate: number;
     autoExecute: boolean;
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

  // General ESOP liquidation rules (replaces the old fixed trigger enum)
  liquidationRules: LiquidationRule[];

  // Assistant preferences
  assistant: {
    /**
     * Opt-in to transmit exact portfolio figures (net worth, FI target,
     * expenses, per-asset totals) to the Assistant. Defaults to false, so
     * only range buckets are sent unless the user turns this on.
     */
    sendExactFigures: boolean;
  };
}

/**
 * Zod adapters replacing three valibot behaviours the persisted-portfolio schema
 * depends on.
 */

/**
 * Accepts an absent key but rejects a key present with an explicit `undefined`.
 *
 * This was `v.exactOptional()`. Plain `z.optional()` accepts both, which would
 * silently widen what the loader accepts. `src/types/state.test.ts` pins this:
 * `{ eurInr: undefined }` must be rejected while `{}` must be accepted.
 */
function exactOptional<T extends z.ZodTypeAny>(schema: T) {
  return schema.optional().refine((value) => value !== undefined, {
    message: 'Explicitly undefined is not allowed for persisted values.',
  });
}

/** Caps the entry count of a record schema. Replaces `v.pipe(v.record(...), v.maxEntries(n))`. */
function maxEntries<T extends z.ZodTypeAny>(schema: T, max: number) {
  return schema.refine((value) => Object.keys(value as object).length <= max, {
    message: `Expected at most ${max} entries.`,
  });
}

const isValid = (schema: z.ZodTypeAny, value: unknown): boolean =>
  schema.safeParse(value).success;

/**
 * Merge two bucket lists by id: keeps `base` order and every base bucket (so the
 * full default vocabulary survives), with `incoming` overrides winning.
 */
function mergeBucketsById(base: FundBucket[], incoming?: FundBucket[]): FundBucket[] {
  if (!incoming?.length) return base;
  const byId = new Map(base.map((bucket) => [bucket.id, bucket]));
  for (const bucket of incoming) byId.set(bucket.id, { ...(byId.get(bucket.id) ?? bucket), ...bucket });
  return Array.from(byId.values());
}

/** Top-level keys accepted in persisted portfolio data (allowlist). */
export const PERSISTED_STATE_KEYS = [
  'profile', 'mf', 'fd', 'epf', 'sip', 'esop', 'bonds', 'otherHoldings', 'liabilities', 'demat', 'nav',
  'niftyHigh', 'niftyData', 'currencyRates', 'marketHistory', 'eurInr', 'eurInrData', 'alphaTrackerData',
  'goals',
  'fundBuckets',
  'watchdogRules', 'swpSchedule', 'taxCalendar', 'expenses', 'netWorthHistory',
  'completedActions', 'achievedMilestones', 'insurance', 'esopDetails', 'liquidationRules', 'assistant',
] as const;

const finiteNumberSchema = z.number();
const timestampSchema = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const statusSchema = z.enum(['live', 'cache-fresh', 'stale', 'manual']);
const legacyNiftyStatusSchema = z.enum(['live', 'cache-fresh', 'manual']);
const profileSchema = z.strictObject({
  name: z.string(), dateOfBirth: z.string().optional(), age: finiteNumberSchema,
  taxSlabRate: finiteNumberSchema.optional(), annualExpenses: finiteNumberSchema,
  fiTarget: finiteNumberSchema, monthlyIncome: finiteNumberSchema,
});
const holdingMapSchema = z.record(z.string(), z.strictObject({ amount: finiteNumberSchema, currency: z.string() }));
const otherHoldingMapSchema = z.record(z.string(), z.strictObject({
  name: z.string().min(1).refine((name) => name.trim().length > 0 && name.length <= 200),
  amount: finiteNumberSchema.min(0),
  annualReturn: finiteNumberSchema.min(0).max(100),
}));
const sipMapSchema = z.record(z.string(), z.strictObject({
  name: z.string(), schemeCode: z.string().optional(), bucketId: exactOptional(z.string().max(64)),
  units: finiteNumberSchema,
  startDate: z.string(), monthlyAmount: finiteNumberSchema, costBasis: finiteNumberSchema.optional(),
}));
const dematMapSchema = z.record(z.string(), z.strictObject({
  isin: z.string(), quantity: finiteNumberSchema, currentValue: finiteNumberSchema, name: z.string(),
}));
const navMapSchema = z.record(z.string(), z.strictObject({
  schemeCode: z.string(), nav: finiteNumberSchema, timestamp: timestampSchema, ttl: finiteNumberSchema,
  source: exactOptional(z.string()), status: exactOptional(statusSchema),
}));
const currencyRateSchema = z.strictObject({
  rate: finiteNumberSchema, timestamp: timestampSchema, sourceCurrency: exactOptional(z.string()),
  targetCurrency: exactOptional(z.string()), source: exactOptional(z.string()), status: exactOptional(statusSchema),
});
const historicalPointSchema = z.strictObject({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => Number.isFinite(Date.parse(value))),
  value: finiteNumberSchema.positive(),
});
const historicalSeriesSchema = z.strictObject({
  points: z.array(historicalPointSchema),
  source: z.string(),
  fetchedAt: timestampSchema,
  status: statusSchema,
});
const marketHistorySchema = maxEntries(
  z.record(z.string(), historicalSeriesSchema),
  HISTORY_CACHE_MAX_ENTRIES,
);
const goalKindSchema = z.enum(['fi', 'home', 'education', 'marriage', 'vehicle', 'custom']);
const goalSchema = z.strictObject({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  kind: goalKindSchema,
  targetToday: finiteNumberSchema.min(0),
  targetDate: z.string().max(7),
  inflation: z.union([z.enum(['cpi', 'education', 'medical']), finiteNumberSchema.min(0)]),
  linkedAssetIds: z.array(z.string().max(64)).max(50),
  currentAmount: finiteNumberSchema.min(0),
  monthlyContribution: exactOptional(finiteNumberSchema.min(0)),
  priority: finiteNumberSchema,
  riskBucket: z.enum(['low', 'medium', 'high']),
});
const liquidationRuleSchema = z.strictObject({
  id: z.string().min(1).max(64),
  kind: z.enum(['marriage', 'childBirth', 'jobChange', 'goal', 'holdingPeriod', 'custom']),
  label: z.string().min(1).max(200),
  active: z.boolean(),
  goalId: exactOptional(z.string().max(64)),
  allocateAmount: exactOptional(finiteNumberSchema.min(0)),
  note: exactOptional(z.string().max(500)),
});
const fundBucketSchema = z.strictObject({
  id: z.enum(['large-cap', 'mid-cap', 'small-cap', 'gold', 'other']),
  label: z.string().min(1).max(40),
  targetPercent: finiteNumberSchema.min(0).max(100),
});
const fundWatchdogRuleSchema = z.strictObject({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
  aumLimit: exactOptional(finiteNumberSchema.min(0)),
  currentAum: exactOptional(finiteNumberSchema.min(0)),
  blockThresholdDays: exactOptional(finiteNumberSchema.min(0)),
  blockedDays: exactOptional(finiteNumberSchema.min(0)),
  managerExited: exactOptional(z.boolean()),
});
const persistedPortfolioShape = {
  profile: exactOptional(profileSchema), mf: exactOptional(sipMapSchema), fd: exactOptional(holdingMapSchema),
  epf: exactOptional(holdingMapSchema), sip: exactOptional(sipMapSchema), esop: exactOptional(holdingMapSchema),
  bonds: exactOptional(holdingMapSchema), otherHoldings: exactOptional(otherHoldingMapSchema),
  liabilities: exactOptional(maxEntries(z.record(z.string(), z.strictObject({
    name: z.string().max(100), amount: finiteNumberSchema.min(0),
  })), 50)),
  demat: exactOptional(dematMapSchema), nav: exactOptional(navMapSchema), niftyHigh: exactOptional(finiteNumberSchema),
  niftyData: exactOptional(z.strictObject({
    level: finiteNumberSchema, high52w: finiteNumberSchema, timestamp: timestampSchema, source: z.string(),
    status: exactOptional(legacyNiftyStatusSchema),
  })),
  currencyRates: exactOptional(z.record(z.string(), currencyRateSchema)),
  marketHistory: exactOptional(marketHistorySchema),
  eurInr: exactOptional(finiteNumberSchema),
  eurInrData: exactOptional(currencyRateSchema),
  alphaTrackerData: exactOptional(z.record(z.string(), z.strictObject({
    fund: z.string(), benchmark: z.string(), year: finiteNumberSchema, return: finiteNumberSchema, benchmarkReturn: finiteNumberSchema,
  }))),
  goals: exactOptional(z.array(goalSchema).max(50)),
  fundBuckets: exactOptional(z.array(fundBucketSchema).max(10)),
  watchdogRules: exactOptional(z.array(fundWatchdogRuleSchema).max(50)),
  swpSchedule: exactOptional(z.strictObject({ enabled: z.boolean(), startDate: z.string(), monthlyAmount: finiteNumberSchema, rate: finiteNumberSchema, autoExecute: z.boolean().default(false) })),
  taxCalendar: exactOptional(z.strictObject({ lastLTCGHarvestDate: z.string(), lastHarvestedAmount: finiteNumberSchema, harvestTarget: finiteNumberSchema })),
  expenses: exactOptional(z.array(z.strictObject({ date: z.string(), category: z.string(), amount: finiteNumberSchema, linkedToSWP: z.boolean() }))),
  netWorthHistory: exactOptional(z.array(z.strictObject({ date: z.string(), value: finiteNumberSchema }))),
  completedActions: exactOptional(z.record(z.string(), z.strictObject({ completedAt: timestampSchema }))),
  achievedMilestones: exactOptional(z.array(z.string())),
  insurance: exactOptional(z.strictObject({
    termLife: z.strictObject({ currentCover: finiteNumberSchema, annualPremium: finiteNumberSchema, expiryDate: z.string(), provider: z.string() }),
    health: z.strictObject({ currentCover: finiteNumberSchema, annualPremium: finiteNumberSchema, familySize: finiteNumberSchema, provider: z.string() }),
    vehicle: z.strictObject({ covered: z.boolean(), annualPremium: finiteNumberSchema }),
  })),
  esopDetails: exactOptional(z.strictObject({
    shares: finiteNumberSchema,
    holdings: z.array(z.strictObject({ name: z.string(), symbol: z.string(), quantity: finiteNumberSchema, currency: z.string() })).max(20).optional(),
    grantPrice: finiteNumberSchema, liquidationShares: finiteNumberSchema.optional(), vestingFmv: finiteNumberSchema.optional(),
    currentPrice: finiteNumberSchema.optional(), slabRate: finiteNumberSchema.optional(),
    vestingSchedule: z.array(z.strictObject({ date: z.string(), shares: finiteNumberSchema })),
    holdingPeriodYears: finiteNumberSchema.min(0).max(50).optional(),
  })),
  liquidationRules: exactOptional(z.array(liquidationRuleSchema).max(50)),
  assistant: exactOptional(z.strictObject({ sendExactFigures: z.boolean() })),
};

/** Exact allowlisted persisted shape; omitted sections remain valid for legacy data. */
export const persistedPortfolioSchema = z.strictObject(persistedPortfolioShape);
export type PersistedPortfolioData = z.infer<typeof persistedPortfolioSchema>;

/** Validate the shared persisted payload used by localStorage and Firestore. */
export function isPersistedPortfolioData(value: unknown): value is Partial<FireOSState> {
  return isValid(persistedPortfolioSchema, value);
}

/** Validate a single cached history series before it enters memory or persistence. */
export function isValidHistoricalSeries(value: unknown): value is HistoricalSeries {
  return isValid(historicalSeriesSchema, value);
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
  if (isValid(marketHistorySchema, value.marketHistory)) return value;
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

    // Planning goals (general, user-defined)
    goals: [],

    // User-owned fund buckets (labels + targets; targets start unset)
    fundBuckets: DEFAULT_FUND_BUCKETS.map((bucket) => ({ ...bucket })),

    // Fund watchdog rules (none by default)
    watchdogRules: [],

    // Auth
    currentUser: null,
    _lastSavedAt: new Date().toISOString(),

     // SWP & Tax Engine (v3.0)
     swpSchedule: {
       enabled: false,
       startDate: '',
       monthlyAmount: 0,
       rate: 0.03,
       autoExecute: false,
     },
    taxCalendar: {
      lastLTCGHarvestDate: '',
      lastHarvestedAmount: 0,
      harvestTarget: 0,
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
    },

    // General ESOP liquidation rules (default milestone vocabulary)
    liquidationRules: [
      { id: 'marriage', kind: 'marriage', label: 'Marriage Plan', active: false },
      { id: 'childBirth', kind: 'childBirth', label: 'Child Birth', active: false },
      { id: 'jobChange', kind: 'jobChange', label: 'Employment Change', active: false },
    ],

    // Assistant preferences (opt-in; off by default)
    assistant: { sendExactFigures: false },
  };
  return defineMarketHistory(state, {});
}

/** Fill omitted top-level persisted sections with current application defaults. */
export function normalizePersistedState(value: unknown): FireOSState | null {
  const payload = dropMalformedMarketHistory(migratePersistedData(value));
  if (!isPersistedPortfolioData(payload)) return null;

  const defaults = initializeState();
  const data = payload as Partial<FireOSState>;
  const normalized: FireOSState = {
    ...defaults,
    ...data,
    profile: { ...defaults.profile, ...data.profile },
    fundBuckets: mergeBucketsById(defaults.fundBuckets, data.fundBuckets),
    watchdogRules: data.watchdogRules ?? defaults.watchdogRules,
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
    },
    assistant: { ...defaults.assistant, ...data.assistant },
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
    // Planning goals: union by id, incoming entries win
    ...(incoming.goals && {
      goals: Array.from(
        new Map([...existing.goals, ...incoming.goals].map((goal) => [goal.id, goal])).values(),
      ),
    }),
    // Fund buckets: union by id, incoming entries win
    ...(incoming.fundBuckets && { fundBuckets: mergeBucketsById(existing.fundBuckets, incoming.fundBuckets) }),
    // Watchdog rules: union by id, incoming entries win
    ...(incoming.watchdogRules && {
      watchdogRules: Array.from(
        new Map([...existing.watchdogRules, ...incoming.watchdogRules].map((rule) => [rule.id, rule])).values(),
      ),
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
    },
    // Liquidation rules: union by id, incoming entries win
    ...(incoming.liquidationRules && {
      liquidationRules: Array.from(
        new Map(
          [...existing.liquidationRules, ...incoming.liquidationRules].map((rule) => [rule.id, rule]),
        ).values(),
      ),
    }),
    ...(incoming.assistant && { assistant: { ...existing.assistant, ...incoming.assistant } }),
    // Metadata is only set explicitly, never from incoming
    _lastSavedAt: incoming._lastSavedAt ?? existing._lastSavedAt,
  };
}
