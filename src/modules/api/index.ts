/**
 * API Module - External Data Fetching
 * Handles NAV, Nifty, EUR/INR fetching with caching and fallbacks
 *
 * Modules:
 * - mfapi.ts: Mutual fund NAV fetching from api.mfapi.in
 * - nifty.ts: **CRITICAL FIX** - Nifty 50 index (NSE API first, ETF fallback)
 * - eurInr.ts: EUR/INR exchange rate from Yahoo Finance
 * - fallbacks.ts: Manual entry modals and cache utilities
 *
 * Cache TTLs:
 * - NAV: 4 hours (mutual fund prices change daily)
 * - Nifty: 1 hour (index data updates frequently)
 * - EUR/INR: 24 hours (exchange rates stable)
 */

// Import init functions
import { initializeNAVCache } from './mfapi';
import { initializeNiftyCache } from './nifty';
import { initializeEURINRCache } from './eurInr';

// Export all public functions
export {
  fetchNAV,
  getCachedNAV,
  setCachedNAV,
  clearNAVCache,
  getNAVCacheMap,
  initializeNAVCache,
} from './mfapi';

export {
  fetchNifty,
  setCachedNifty,
  getCachedNifty,
  clearNiftyCache,
  initializeNiftyCache,
  showManualNiftyModal,
} from './nifty';

export {
  fetchEURINR,
  getCachedEURINR,
  getCachedEURINRData,
  setCachedEURINR,
  clearEURINRCache,
  initializeEURINRCache,
  showManualEURINRModal,
} from './eurInr';

export {
  getFallbackNiftyLevel,
  getFallbackEURINRRate,
  getFallbackNAV,
  showAPIErrorNotification,
  checkAPIDataAvailability,
  initializeAllAPICache,
} from './fallbacks';

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
  if (persistedState.eurInrData) {
    initializeEURINRCache(persistedState.eurInrData);
  }

  console.log('[API Module] Initialized with', {
    navCacheEntries: Object.keys(persistedState.nav || {}).length,
    niftyCache: persistedState.niftyData ? 'loaded' : 'none',
    eurInrCache: persistedState.eurInrData ? 'loaded' : 'none',
  });
}
