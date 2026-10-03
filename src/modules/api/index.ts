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
 */

// Import init functions
import { initializeNAVCache } from './mfapi';
import { initializeNiftyCache } from './nifty';
import { initializeCurrencyRateCache } from './currency';

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

  console.log('[API Module] Initialized with', {
    navCacheEntries: Object.keys(persistedState.nav || {}).length,
    niftyCache: persistedState.niftyData ? 'loaded' : 'none',
    currencyRateCache: persistedState.currencyRates ? 'loaded' : 'none',
  });
}
