/**
 * Sanitization helpers for assistant context building.
 * Redacts PII, buckets exact balances to ranges, and limits payload scope.
 * All functions are pure and unit-testable.
 *
 * Valuation reuses the same totalNetWorth KPI the dashboard uses so
 * assistant context never diverges from displayed values.
 */

import type { FireOSState } from '../../types/state';
import type { NiftyData } from '../../types/api';
import { totalNetWorth } from '../../modules/dashboard/kpis';

export type BalanceRange = '<1L' | '1–5L' | '5–25L' | '25L–1Cr' | '1Cr+';

/** Exact values included for the assistant's read-only portfolio analysis. */
export interface ExactContext {
  netWorth: number;
  fiTarget: number;
  annualExpenses: number;
  monthlySipContribution: number;
  holdings: Record<string, number>;
}

export interface NiftyContext {
  level: number;
  high52w: number;
  drawdownPercent: number;
  asOf: string;
  ageMinutes: number;
  freshness: 'fresh' | 'stale';
  source: string;
  status: string;
}

export interface SanitizedContext {
  /** Non-identifiable user label; never the real name */
  userLabel: string;
  /** Age band derived from profile.age; DOB itself is never sent */
  ageBand: string;
  /** Tax slab rate from profile */
  taxSlabRate: number | null;
  /** FI target range */
  fiTargetRange: BalanceRange;
  /** Holdings counts + range totals per class */
  holdingsSummary: Record<string, { count: number; totalRange: BalanceRange }>;
  /** Net worth range */
  netWorthRange: BalanceRange;
  /** Public Nifty 50 market data; null when no valid cached value exists */
  nifty50: NiftyContext | null;
  /** Profile fields that affect advice, masked */
  profileMasked: {
    annualExpenses: BalanceRange;
    fiTarget: BalanceRange;
  };
  /** Whether exact context is included in this request. */
  sendExact: boolean;
  exact?: ExactContext;
}

/**
 * Convert a numeric rupee value to a balance range bucket.
 * Buckets: <1L (100k), 1–5L, 5–25L, 25L–1Cr, 1Cr+ (10M).
 */
export function bucketBalance(amount: number): BalanceRange {
  if (amount < 100000) return '<1L';
  if (amount < 500000) return '1–5L';
  if (amount < 2500000) return '5–25L';
  if (amount < 10000000) return '25L–1Cr';
  return '1Cr+';
}

const HOLDING_KEYS = [
  'mf',
  'sip',
  'fd',
  'epf',
  'esop',
  'bonds',
  'otherHoldings',
  'demat',
] as const;

const NIFTY_FRESHNESS_MS = 60 * 60 * 1000;

function sanitizeNiftyData(data: NiftyData | undefined, now: number): NiftyContext | null {
  if (!data || !Number.isFinite(data.level) || data.level <= 0
    || !Number.isFinite(data.high52w) || data.high52w <= 0
    || !Number.isFinite(Date.parse(data.timestamp))) {
    return null;
  }

  const ageMs = Math.max(0, now - Date.parse(data.timestamp));
  return {
    level: data.level,
    high52w: data.high52w,
    drawdownPercent: Number((((data.high52w - data.level) / data.high52w) * 100).toFixed(2)),
    asOf: data.timestamp,
    ageMinutes: Math.floor(ageMs / 60_000),
    freshness: ageMs <= NIFTY_FRESHNESS_MS ? 'fresh' : 'stale',
    source: data.source,
    status: data.status ?? 'legacy',
  };
}

type HoldingKey = (typeof HOLDING_KEYS)[number];

/**
 * Build a minimal sanitized context summary from a FireOSState.
 * Never includes: uid, email, real name, DOB, raw NAV cache, full fund maps,
 * transaction IDs, or expenses lists.
 * Exact figures are attached when sendExact is true.
 */
export function buildContextSummary(
  state: FireOSState,
  sendExact: boolean = false
): SanitizedContext {
  const profile = state.profile;

  const age = Number.isFinite(profile.age) ? profile.age : 0;
  const ageBand = age < 30 ? '20s' : age < 40 ? '30s' : age < 50 ? '40s' : '50s+';

  const { netWorth, breakdown } = totalNetWorth(state);
  const monthlySipContribution = Object.values(state.sip).reduce(
    (sum, fund) => sum + (Number.isFinite(fund.monthlyAmount) ? fund.monthlyAmount : 0),
    0,
  );
  const now = Date.now();

  const holdingsSummary: Record<string, { count: number; totalRange: BalanceRange }> = {};
  const exactHoldings: Record<string, number> = {};

  for (const key of HOLDING_KEYS) {
    const count = Object.keys(state[key] ?? {}).length;
    const value = breakdown[key as keyof typeof breakdown] ?? 0;
    holdingsSummary[key] = { count, totalRange: bucketBalance(value) };
    if (sendExact) exactHoldings[key] = value;
  }

  const fiTarget = profile.fiTarget ?? 0;
  const annualExpenses = profile.annualExpenses ?? 0;

  const context: SanitizedContext = {
    userLabel: 'User',
    ageBand,
    taxSlabRate: profile.taxSlabRate ?? null,
    fiTargetRange: bucketBalance(fiTarget),
    holdingsSummary,
    netWorthRange: bucketBalance(netWorth),
    nifty50: sanitizeNiftyData(state.niftyData, now),
    profileMasked: {
      annualExpenses: bucketBalance(annualExpenses),
      fiTarget: bucketBalance(fiTarget),
    },
    sendExact,
  };

  if (sendExact) {
    context.exact = {
      netWorth,
      fiTarget,
      annualExpenses,
      monthlySipContribution,
      holdings: exactHoldings,
    };
  }

  return context;
}

/**
 * Redact a string of PII (emails, uid-like tokens) before display/logging.
 */
export function redactPII(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\buid[:=]\s*\S+/gi, 'uid=[redacted]');
}

export type { HoldingKey };
