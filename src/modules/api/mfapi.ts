/**
 * Mutual Fund NAV Fetching Module
 * Fetches latest NAV from api.mfapi.in with caching
 */

import { getLogger } from '../../lib/logger';
import type { NAVCache, NAVCacheMap, MFAPIResponse } from '../../types/api';

const logger = getLogger();

// In-memory NAV cache with TTL management
let navCache: NAVCacheMap = {};

// Track in-flight requests to deduplicate concurrent fetches for same scheme
const inFlightRequests: Map<string, Promise<number | null>> = new Map();

// Constants
const MFAPI_BASE_URL = 'https://api.mfapi.in/mf';
const NAV_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

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
  };
}

/**
 * Clear all NAV cache
 */
export function clearNAVCache(): void {
  navCache = {};
}

/**
 * Get entire cache map (for debugging)
 */
export function getNAVCacheMap(): NAVCacheMap {
  return { ...navCache };
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
