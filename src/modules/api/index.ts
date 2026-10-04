/**
 * API Module - External Data Fetching
 * Handles NAV, Nifty, and currency-pair fetching with caching and fallbacks
 *
 * Modules:
 * - mfapi.ts: Mutual fund NAV fetching from api.mfapi.in
 * - nifty.ts: **CRITICAL FIX** - Nifty 50 index (NSE API first, ETF fallback)
 * - currency.ts: currency-pair exchange rates from Yahoo Finance
 * - fallbacks.ts: Manual entry modals and cache utilities
 *
 * Cache TTLs:
 * - NAV: 4 hours (mutual fund prices change daily)
 * - Nifty: 1 hour (index data updates frequently)
 * - Currency rates: 24 hours (exchange rates stable)
 * - Market history: 24 hours (HISTORY_CACHE_TTL; served as stale past it)
 */

// Import init functions
import { initializeNAVCache } from './mfapi';
import { initializeNiftyCache } from './nifty';
import { initializeCurrencyRateCache } from './currency';

import type { HistoricalSeries, HistoryRange } from '../../types/api';
import type { MarketHistoryCacheMap } from '../../types/state';
import {
  HISTORY_CACHE_MAX_BYTES,
  HISTORY_CACHE_MAX_ENTRIES,
  HISTORY_CACHE_TTL,
  isValidHistoricalSeries,
} from '../../types/state';

// Export all public functions
export {
  fetchNAV,
  getCachedNAV,
  setCachedNAV,
  getNAVCacheMap,
  initializeNAVCache,
} from './mfapi';

export {
  fetchNifty,
  setCachedNifty,
  getCachedNifty,
  initializeNiftyCache,
  showManualNiftyModal,
} from './nifty';

export {
  convertCurrency,
  fetchCurrencyRate,
  getCachedCurrencyRate,
  getCurrencyRateCache,
  setCachedCurrencyRate,
  initializeCurrencyRateCache,
  showManualCurrencyRateModal,
} from './currency';

export {
  detectCrashAlert,
  monitorNiftyLevel,
  type CrashAlert,
  type CrashAlertParams,
} from './nifty-monitor';

import { NAV_HISTORY_MAX_POINTS, fetchNAVHistory as fetchNAVHistoryFromProvider } from './mfapi';
import { NIFTY_HISTORY_MAX_POINTS, fetchNiftyHistory as fetchNiftyHistoryFromProvider } from './nifty';

// In-memory market history cache, hydrated from persisted state at startup
let historyCache: MarketHistoryCacheMap = {};

function historyPointCap(key: string): number {
  return key.startsWith('nav:') ? NAV_HISTORY_MAX_POINTS : NIFTY_HISTORY_MAX_POINTS;
}

function historyKey(base: string, range?: HistoryRange): string {
  return range ? `${base}|${range.start}|${range.end}` : base;
}

/**
 * Enforce the bounded-history write policy: drop entries that fail schema
 * validation, cap each series to its per-series point limit, keep at most
 * HISTORY_CACHE_MAX_ENTRIES newest series, and evict oldest series until the
 * serialized section fits HISTORY_CACHE_MAX_BYTES.
 */
export function sanitizeHistoryCache(cache: MarketHistoryCacheMap): MarketHistoryCacheMap {
  const entries = Object.entries(cache)
    .filter((entry): entry is [string, HistoricalSeries] => isValidHistoricalSeries(entry[1]))
    .map(([key, series]) => ({
      key,
      series: { ...series, points: series.points.slice(-historyPointCap(key)) },
      fetchedAt: Date.parse(series.fetchedAt),
    }))
    .sort((a, b) => b.fetchedAt - a.fetchedAt)
    .slice(0, HISTORY_CACHE_MAX_ENTRIES);

  const sanitized: MarketHistoryCacheMap = {};
  for (const { key, series } of entries) {
    sanitized[key] = series;
  }
  while (entries.length > 0 && JSON.stringify(sanitized).length > HISTORY_CACHE_MAX_BYTES) {
    delete sanitized[entries.pop()!.key];
  }
  return sanitized;
}

/** Replace the in-memory history cache with a bounded copy of persisted history. */
export function initializeHistoryCache(persistedCache: MarketHistoryCacheMap): void {
  historyCache = sanitizeHistoryCache(persistedCache ?? {});
}

/** Snapshot of the bounded history cache for persistence. */
export function getHistoryCacheMap(): MarketHistoryCacheMap {
  return { ...historyCache };
}

async function loadHistory(
  key: string,
  provider: () => Promise<HistoricalSeries | null>,
): Promise<HistoricalSeries | null> {
  const cached = historyCache[key];
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < HISTORY_CACHE_TTL) {
    return { ...cached, status: 'cache-fresh' };
  }

  const live = await provider();
  if (live) {
    historyCache = sanitizeHistoryCache({ ...historyCache, [key]: live });
    // Serve exactly what passed the cache schema (capped and validated), or
    // null if the provider payload was rejected — never the raw payload.
    return historyCache[key] ?? null;
  }

  // Provider failure (empty/malformed response) never erases a valid cache.
  return cached ? { ...cached, status: 'stale' } : null;
}

/**
 * Fetch Nifty 50 history through the bounded cache: fresh cache entries are
 * served as `cache-fresh`, provider results are cached and returned `live`,
 * and expired cache is only used as a `stale` fallback when the provider
 * fails. Signatures match the Task 1 adapter.
 */
export async function fetchNiftyHistory(range?: HistoryRange): Promise<HistoricalSeries | null> {
  return loadHistory(historyKey('nifty', range), () => fetchNiftyHistoryFromProvider(range));
}

/**
 * Fetch fund NAV history through the bounded cache with the same status
 * mapping as {@link fetchNiftyHistory}. Signatures match the Task 1 adapter.
 */
export async function fetchNAVHistory(
  schemeCode: string,
  range?: HistoryRange,
): Promise<HistoricalSeries | null> {
  if (!schemeCode) return null;
  return loadHistory(historyKey(`nav:${schemeCode}`, range), () =>
    fetchNAVHistoryFromProvider(schemeCode, range),
  );
}

/**
 * Initialize API module
 * Restores caches from persisted state
 * Called once during app startup from main.ts
 *
 * @param persistedState - State object from localStorage/Firebase containing cached data
 */
export function initAPIModule(persistedState: any = {}): void {
  // Restore caches from persisted state
  if (persistedState.nav) {
    initializeNAVCache(persistedState.nav);
  }
  if (persistedState.niftyData) {
    initializeNiftyCache(persistedState.niftyData);
  }
  if (persistedState.currencyRates) {
    initializeCurrencyRateCache(persistedState.currencyRates);
  }
  if (persistedState.eurInrData && !persistedState.currencyRates) {
    initializeCurrencyRateCache({
      EURINR: {
        ...persistedState.eurInrData,
        sourceCurrency: 'EUR',
        targetCurrency: 'INR',
      },
    });
  }
  if (persistedState.marketHistory) {
    initializeHistoryCache(persistedState.marketHistory);
  }

  console.log('[API Module] Initialized with', {
    navCacheEntries: Object.keys(persistedState.nav || {}).length,
    niftyCache: persistedState.niftyData ? 'loaded' : 'none',
    currencyRateCache: persistedState.currencyRates ? 'loaded' : 'none',
    historyCacheEntries: Object.keys(historyCache).length,
  });
}
