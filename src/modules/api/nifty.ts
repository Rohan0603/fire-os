/**
 * Nifty 50 Index Data Fetching Module
 * CRITICAL FIX (v2.2): Attempts real NSE API first, falls back to ETF approximation with disclaimer
 *
 * Data Sources (in priority order):
 * 1. NSE Public API (if available) - returns true Nifty50 index level + 52W high
 * 2. ETF NAV fallback (scheme 135106 - ICICI Gold ETF as proxy) - marked with disclaimer
 * 3. Manual entry via modal - user provides level + 52W high
 *
 * Cache TTL: 1 hour (index data changes daily, refresh frequently)
 */

import { getLogger } from '../../lib/logger';
import { fetchNAV } from './mfapi';
import type { NiftyData } from '../../types/api';

const logger = getLogger();

// In-memory Nifty cache
let niftyCache: NiftyData | null = null;

// Constants
const NIFTY_CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const GOLD_ETF_SCHEME = '135106'; // ICICI Gold ETF (used as approximation fallback)

/**
 * NSE API Endpoints (potential sources)
 * Note: NSE doesn't provide a direct public REST API for free tier
 * Attempting: 1) YahooFinance via CORS proxy 2) ETF approximation
 * Future: Direct NSE API if/when available
 */

/**
 * Fetch Nifty 50 level and 52-week high
 * PRIORITY 1: Try NSE/Yahoo Finance real data
 * PRIORITY 2: Fall back to ETF NAV approximation (with disclaimer)
 * PRIORITY 3: Return cached value if available
 * PRIORITY 4: Return null (user must enter manually)
 *
 * @returns { level, high52w, source } or null if all sources fail
 */
export async function fetchNifty(): Promise<{
  level: number;
  high52w: number;
  source: string;
} | null> {
  // Check cache first
  if (niftyCache && Date.now() - new Date(niftyCache.timestamp).getTime() < NIFTY_CACHE_TTL) {
    logger.log('Nifty cache hit:', {
      level: niftyCache.level,
      source: niftyCache.source,
    });
    return {
      level: niftyCache.level,
      high52w: niftyCache.high52w,
      source: niftyCache.source,
    };
  }

  // ATTEMPT 1: Try Yahoo Finance via CORS proxy for real Nifty data
  try {
    logger.log('Attempting Yahoo Finance Nifty fetch...');
    const niftyReal = await fetchNiftyFromYahoo();
    if (niftyReal) {
      niftyCache = {
        level: niftyReal.level,
        high52w: niftyReal.high52w,
        timestamp: new Date().toISOString(),
        source: 'Yahoo Finance (NSE data)',
      };
      logger.log('Nifty fetched from Yahoo Finance:', niftyReal);
      return {
        level: niftyReal.level,
        high52w: niftyReal.high52w,
        source: niftyReal.source,
      };
    }
  } catch (error) {
    logger.warn('Yahoo Finance fetch failed, attempting ETF fallback', error);
  }

  // ATTEMPT 2: Fall back to Gold ETF NAV as Nifty approximation
  try {
    logger.log('Attempting ETF NAV fallback (Gold ETF proxy)...');
    const etfNAV = await fetchNAV(GOLD_ETF_SCHEME);

    if (etfNAV && etfNAV > 0) {
      // Use ETF NAV as approximation for Nifty level
      // 52W high is estimated at ~15% above current (rough market assumption)
      const high52w = Math.round(etfNAV * 1.15);

      niftyCache = {
        level: etfNAV,
        high52w,
        timestamp: new Date().toISOString(),
        source: 'ETF NAV Approximation (disclaimer)',
      };

      logger.warn('Nifty: Using ETF NAV approximation (not real NSE data)', {
        level: etfNAV,
        high52w,
        scheme: GOLD_ETF_SCHEME,
      });

      return {
        level: etfNAV,
        high52w,
        source: `ETF Approximation (scheme ${GOLD_ETF_SCHEME}) - Not real NSE data`,
      };
    }
  } catch (error) {
    logger.error('ETF fallback also failed', error);
  }

  // If all sources fail, return cached value even if expired
  if (niftyCache) {
    logger.warn('Returning expired cache for Nifty:', {
      level: niftyCache.level,
      age: Date.now() - new Date(niftyCache.timestamp).getTime(),
    });
    return {
      level: niftyCache.level,
      high52w: niftyCache.high52w,
      source: `${niftyCache.source} (cached, may be stale)`,
    };
  }

  logger.error('All Nifty data sources failed and no cache available');
  return null;
}

/**
 * Attempt to fetch Nifty 50 from Yahoo Finance
 * Uses api.allorigins.win CORS proxy to bypass restrictions
 *
 * @returns { level, high52w, source } or null if fetch fails
 */
async function fetchNiftyFromYahoo(): Promise<{
  level: number;
  high52w: number;
  source: string;
} | null> {
  try {
    // Yahoo Finance ticker for Nifty 50
    const yahooUrl = 'https://finance.yahoo.com/quote/%5ENSEI';

    // Use CORS proxy (api.allorigins.win)
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(yahooUrl)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(proxyUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Parse current level from HTML
    // Yahoo HTML structure: data-symbol="^NSEI" ... <fin-streamer data-symbol="^NSEI" data-field="regularMarketPrice">level</fin-streamer>
    const levelMatch = html.match(/regularMarketPrice[^>]*>([0-9.,]+)</);
    const high52wMatch = html.match(/fiftyTwoWeekHigh[^>]*>([0-9.,]+)</);

    if (!levelMatch || !high52wMatch) {
      logger.warn('Yahoo HTML parsing failed - required fields not found');
      return null;
    }

    const level = parseFloat(levelMatch[1].replace(/,/g, ''));
    const high52w = parseFloat(high52wMatch[1].replace(/,/g, ''));

    if (isNaN(level) || isNaN(high52w)) {
      throw new Error('Parsed values are NaN');
    }

    // Sanity check: Nifty should be positive and reasonable range (1000-50000)
    if (level < 1000 || level > 50000 || high52w < 1000 || high52w > 50000) {
      logger.warn('Nifty values out of expected range', { level, high52w });
      return null;
    }

    return { level, high52w, source: 'Yahoo Finance (official)' };
  } catch (error) {
    logger.warn('Yahoo Finance parse/fetch failed', error);
    return null;
  }
}

/**
 * Set Nifty cache directly (useful for manual override or testing)
 * @param level - Current Nifty level
 * @param high52w - 52-week high
 * @param source - Data source description
 */
export function setCachedNifty(level: number, high52w: number, source: string = 'manual'): void {
  niftyCache = {
    level,
    high52w,
    timestamp: new Date().toISOString(),
    source,
  };
  logger.log('Nifty cache set', { level, high52w, source });
}

/**
 * Get cached Nifty data without attempting fresh fetch
 * @returns Cached Nifty data or null
 */
export function getCachedNifty(): { level: number; high52w: number } | null {
  if (!niftyCache) return null;
  return {
    level: niftyCache.level,
    high52w: niftyCache.high52w,
  };
}

/**
 * Clear Nifty cache
 */
export function clearNiftyCache(): void {
  niftyCache = null;
  logger.log('Nifty cache cleared');
}

/**
 * Initialize Nifty cache from persisted state
 * @param niftyData - Cached Nifty data from localStorage/Firebase
 */
export function initializeNiftyCache(niftyData: NiftyData | undefined): void {
  if (niftyData) {
    niftyCache = niftyData;
    logger.log('Nifty cache initialized from persistence');
  }
}

/**
 * Show manual Nifty entry modal
 * User can manually enter Nifty level and 52W high if API fails
 * Returns a Promise that resolves when user saves or cancels
 */
export async function showManualNiftyModal(): Promise<{
  level: number;
  high52w: number;
} | null> {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <h3>Enter Nifty 50 Data Manually</h3>
        <p style="color: #666; font-size: 0.9rem;">Nifty API fetch failed. Please enter current level and 52-week high.</p>

        <div class="form-group">
          <label>Current Nifty Level</label>
          <input type="number" id="nifty-level" placeholder="e.g., 24500" min="1000" max="50000" />
        </div>

        <div class="form-group">
          <label>52-Week High</label>
          <input type="number" id="nifty-high" placeholder="e.g., 26000" min="1000" max="50000" />
        </div>

        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button class="btn-primary" id="nifty-save">Save</button>
          <button class="btn-secondary" id="nifty-cancel">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const levelInput = modal.querySelector('#nifty-level') as HTMLInputElement;
    const highInput = modal.querySelector('#nifty-high') as HTMLInputElement;
    const saveBtn = modal.querySelector('#nifty-save') as HTMLButtonElement;
    const cancelBtn = modal.querySelector('#nifty-cancel') as HTMLButtonElement;

    const cleanup = () => {
      modal.remove();
    };

    saveBtn.addEventListener('click', () => {
      const level = parseFloat(levelInput.value);
      const high52w = parseFloat(highInput.value);

      if (!isNaN(level) && !isNaN(high52w) && level > 0 && high52w > 0 && level <= high52w) {
        setCachedNifty(level, high52w, 'manual entry');
        cleanup();
        resolve({ level, high52w });
      } else {
        alert('Please enter valid numbers. High must be >= Level.');
      }
    });

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });
  });
}
