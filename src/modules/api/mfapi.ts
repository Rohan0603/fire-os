/**
 * Mutual Fund NAV Fetching Module
 * Fetches latest NAV from api.mfapi.in with caching
 */

import { getLogger } from '../../lib/logger';
import type {
  HistoricalDataPoint,
  HistoricalSeries,
  HistoryRange,
  MarketDataStatus,
  NAVCacheMap,
  MFAPIResponse,
} from '../../types/api';
import { CONFIG } from '../../lib/config';

const logger = getLogger();

// In-memory NAV cache with TTL management
let navCache: NAVCacheMap = {};

// Track in-flight requests to deduplicate concurrent fetches for same scheme
const inFlightRequests: Map<string, Promise<number | null>> = new Map();

// Constants
const MFAPI_BASE_URL = CONFIG.api.mfapiBaseUrl;
const NAV_CACHE_TTL = CONFIG.cacheTtl.nav;

function cacheStatus(timestamp: string): MarketDataStatus {
  return Date.now() - new Date(timestamp).getTime() < NAV_CACHE_TTL ? 'cache-fresh' : 'stale';
}

/**
 * Fetch latest NAV for a given scheme code
 * Attempts real API first, returns cached value on failure, null if not cached
 *
 * @param schemeCode - Mutual fund scheme code (e.g., "122639" for Parag Parikh)
 * @returns Latest NAV value or null if fetch fails and no cache
 */
export async function fetchNAV(schemeCode: string): Promise<number | null> {
  if (!schemeCode) {
    logger.warn('fetchNAV: missing schemeCode');
    return getCachedNAV(schemeCode);
  }

  // Check if cache is valid (not expired)
  const cached = navCache[schemeCode];
  if (cached && Date.now() - new Date(cached.timestamp).getTime() < NAV_CACHE_TTL) {
    return cached.nav;
  }

  // Deduplicate: if request already in flight, wait for it
  if (inFlightRequests.has(schemeCode)) {
    return inFlightRequests.get(schemeCode)!;
  }

  // Create fetch promise and track it
  const fetchPromise = (async () => {
    try {
      // Create a timeout abort controller (mfapi.in response is large, needs longer timeout)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${MFAPI_BASE_URL}/${schemeCode}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as MFAPIResponse;

      // Validate response structure
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        logger.warn(`fetchNAV: No data for scheme ${schemeCode}`);
        return getCachedNAV(schemeCode);
      }

      // Extract NAV from latest entry (first in array)
      const latestEntry = data.data[0];
      const nav = parseFloat(latestEntry.nav);

      if (isNaN(nav)) {
        logger.warn(`fetchNAV: Invalid NAV value for scheme ${schemeCode}`, latestEntry.nav);
        return getCachedNAV(schemeCode);
      }

      // Update cache
      navCache[schemeCode] = {
        schemeCode,
        nav,
        timestamp: new Date().toISOString(),
        ttl: NAV_CACHE_TTL,
        source: 'api.mfapi.in',
        status: 'live',
      };

      return nav;
    } catch (error) {
      logger.error(`fetchNAV failed for scheme ${schemeCode}`, error);
      // Fall back to cached value if available
      return getCachedNAV(schemeCode);
    } finally {
      // Remove from in-flight map when done
      inFlightRequests.delete(schemeCode);
    }
  })();

  inFlightRequests.set(schemeCode, fetchPromise);
  return fetchPromise;
}

/**
 * Get cached NAV without attempting fresh fetch
 * Returns null if no valid cache entry exists
 *
 * @param schemeCode - Scheme code to look up
 * @returns Cached NAV or null
 */
export function getCachedNAV(schemeCode: string): number | null {
  const cached = navCache[schemeCode];
  if (!cached) return null;

  // Return even if expired - better than null for fallback
  return cached.nav;
}

/**
 * Set NAV cache directly (useful for testing or manual override)
 * @param schemeCode - Scheme code
 * @param nav - NAV value
 */
export function setCachedNAV(schemeCode: string, nav: number): void {
  navCache[schemeCode] = {
    schemeCode,
    nav,
    timestamp: new Date().toISOString(),
    ttl: NAV_CACHE_TTL,
    source: 'manual',
    status: 'manual',
  };
}

/**
 * Get entire cache map (for debugging)
 */
export function getNAVCacheMap(): NAVCacheMap {
  return Object.fromEntries(
    Object.entries(navCache).map(([schemeCode, cache]) => [schemeCode, {
      ...cache,
      status: cache.status === 'manual' ? 'manual' : cacheStatus(cache.timestamp),
    }]),
  );
}

/**
 * Initialize NAV cache from persisted state
 * Called during app startup to restore cached values from localStorage
 *
 * @param persistedCache - Cached NAV entries from localStorage/Firebase
 */
export function initializeNAVCache(persistedCache: NAVCacheMap): void {
  navCache = { ...persistedCache };
  logger.log('NAV cache initialized from persistence', {
    entries: Object.keys(navCache).length,
  });
}

/**
 * Maximum retained NAV history points per series.
 * MFAPI returns a scheme's entire life-to-date history in one payload
 * (old schemes exceed 8,000 rows); 2,520 points equals ~10 years of
 * business-day NAVs, which bounds the Task 2 history cache while covering
 * a full market cycle. Oversized results keep the newest points.
 */
export const NAV_HISTORY_MAX_POINTS = 2520;

const MFAPI_DATE_PATTERN = /^(\d{2})-(\d{2})-(\d{4})$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function parseMFAPIHistoryDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const match = MFAPI_DATE_PATTERN.exec(raw);
  if (!match) return null;
  const isoDate = `${match[3]}-${match[2]}-${match[1]}`;
  return isValidIsoDate(isoDate) ? isoDate : null;
}

function isValidHistoryRange(range: HistoryRange): boolean {
  return isValidIsoDate(range.start) && isValidIsoDate(range.end) && range.start <= range.end;
}

function normalizeNAVHistory(data: unknown): HistoricalDataPoint[] | null {
  if (!Array.isArray(data) || data.length === 0) return null;

  const points: HistoricalDataPoint[] = [];
  const seenDates = new Set<string>();

  for (const entry of data) {
    if (!entry || typeof entry !== 'object') continue;
    const date = parseMFAPIHistoryDate((entry as { date?: unknown }).date);
    if (!date || seenDates.has(date)) continue;

    const rawNav = (entry as { nav?: unknown }).nav;
    const value = typeof rawNav === 'number'
      ? rawNav
      : typeof rawNav === 'string'
        ? Number(rawNav)
        : NaN;
    if (!Number.isFinite(value) || value <= 0) continue;

    seenDates.add(date);
    points.push({ date, value });
  }

  if (points.length === 0) return null;
  return points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function capNAVHistory(points: HistoricalDataPoint[]): HistoricalDataPoint[] {
  return points.length > NAV_HISTORY_MAX_POINTS
    ? points.slice(points.length - NAV_HISTORY_MAX_POINTS)
    : points;
}

/**
 * Fetch a bounded, normalized NAV history series for a scheme
 * MFAPI has no range parameters: the full history is fetched once, validated,
 * deduplicated (first provider record per date wins), sorted ascending, then
 * filtered to the inclusive range and capped to NAV_HISTORY_MAX_POINTS
 * newest points. Invalid ranges are rejected before any request; provider
 * failures and empty/non-overlapping results return null. Sparse provider
 * gaps are preserved, never interpolated.
 *
 * @param schemeCode - Mutual fund scheme code (e.g., "122639")
 * @param range - Optional inclusive YYYY-MM-DD window
 * @returns Normalized series or null when no usable history exists
 */
export async function fetchNAVHistory(
  schemeCode: string,
  range?: HistoryRange,
): Promise<HistoricalSeries | null> {
  if (!schemeCode || (range && !isValidHistoryRange(range))) {
    logger.warn('fetchNAVHistory: rejected invalid request', { schemeCode, range });
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${MFAPI_BASE_URL}/${schemeCode}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as MFAPIResponse;
    const points = normalizeNAVHistory(data?.data);
    if (!points) {
      logger.warn(`fetchNAVHistory: no usable history for scheme ${schemeCode}`);
      return null;
    }

    const inRange = range
      ? points.filter((point) => point.date >= range.start && point.date <= range.end)
      : points;
    if (inRange.length === 0) {
      logger.warn(`fetchNAVHistory: requested range outside provider history for scheme ${schemeCode}`);
      return null;
    }

    return {
      points: capNAVHistory(inRange),
      source: 'api.mfapi.in',
      fetchedAt: new Date().toISOString(),
      status: 'live',
    };
  } catch (error) {
    logger.warn(`fetchNAVHistory failed for scheme ${schemeCode}`, error);
    return null;
  }
}
