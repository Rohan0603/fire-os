/**
 * API Fallback Utilities
 * Provides manual entry modals and cached value retrieval when APIs fail
 */

import { getLogger } from '../../lib/logger';
import { showManualNiftyModal, getCachedNifty, initializeNiftyCache } from './nifty';
import { showManualEURINRModal, getCachedEURINR, initializeEURINRCache } from './eurInr';
import { getCachedNAV, initializeNAVCache } from './mfapi';

const logger = getLogger();

/**
 * Show all available fallback options for Nifty level
 * 1. Try cached value
 * 2. Show manual entry modal
 *
 * @returns { level, high52w } or null if user cancels
 */
export async function getFallbackNiftyLevel(): Promise<{
  level: number;
  high52w: number;
} | null> {
  // Try cached first
  const cached = getCachedNifty();
  if (cached) {
    return cached;
  }

  // Show manual entry modal
  return await showManualNiftyModal();
}

/**
 * Show all available fallback options for EUR/INR rate
 * 1. Try cached value
 * 2. Show manual entry modal
 *
 * @returns Exchange rate or null if user cancels
 */
export async function getFallbackEURINRRate(): Promise<number | null> {
  // Try cached first
  const cached = getCachedEURINR();
  if (cached) {
    return cached;
  }

  // Show manual entry modal
  return await showManualEURINRModal();
}

/**
 * Get cached NAV value (with TTL already checked by mfapi.ts)
 * Returns stored value even if expired (better than null)
 *
 * @param schemeCode - Mutual fund scheme code
 * @returns Cached NAV or null if not available
 */
export function getFallbackNAV(schemeCode: string): number | null {
  const cached = getCachedNAV(schemeCode);
  return cached;
}

/**
 * Show a generic API error toast/notification
 * Displays to user that API failed and will use cached/manual data
 *
 * @param apiName - Name of API that failed (e.g., "Nifty API", "NAV API")
 * @param hasCached - Whether a cached value is available
 */
export function showAPIErrorNotification(apiName: string, hasCached: boolean = false): void {
  const message = hasCached
    ? `${apiName} fetch failed. Using cached data. Last updated: ${new Date().toLocaleTimeString()}`
    : `${apiName} fetch failed. Please try again or enter data manually.`;

  logger.warn(message);

  // Create a temporary toast notification
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background-color: #f59e0b;
    color: white;
    padding: 16px 20px;
    border-radius: 4px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 9999;
    font-size: 14px;
    max-width: 300px;
    animation: slideIn 0.3s ease-in;
  `;
  toast.textContent = message;

  document.body.appendChild(toast);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 5000);
}

/**
 * Check if all required API data is available (cached or fresh)
 * Useful for dashboard initialization
 *
 * @param requiredSchemes - Array of scheme codes to check NAV for
 * @returns Object with availability status for each data type
 */
export function checkAPIDataAvailability(requiredSchemes: string[] = []): {
  hasNifty: boolean;
  hasEURINR: boolean;
  navAvailable: Record<string, boolean>;
} {
  return {
    hasNifty: getCachedNifty() !== null,
    hasEURINR: getCachedEURINR() !== null,
    navAvailable: Object.fromEntries(
      requiredSchemes.map((code) => [code, getCachedNAV(code) !== null])
    ),
  };
}

/**
 * Initialize all API caches from persisted data
 * Called during app startup to restore cached values
 *
 * @param navCache - Cached NAV entries
 * @param niftyData - Cached Nifty data
 * @param eurInrData - Cached EUR/INR data
 */
export function initializeAllAPICache(
  navCache?: Record<string, any>,
  niftyData?: any,
  eurInrData?: any
): void {
  if (navCache) {
    initializeNAVCache(navCache);
  }
  if (niftyData) {
    initializeNiftyCache(niftyData);
  }
  if (eurInrData) {
    initializeEURINRCache(eurInrData);
  }
}
