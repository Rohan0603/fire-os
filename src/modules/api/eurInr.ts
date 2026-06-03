/**
 * EUR/INR Exchange Rate Fetching Module
 * Fetches latest EUR to INR exchange rate from Yahoo Finance via CORS proxy
 * Used for ESOP Tools valuation in Indian Rupees
 */

import { getLogger } from '../../lib/logger';
import type { EURINRData } from '../../types/api';

const logger = getLogger();

// In-memory cache
let eurInrCache: EURINRData | null = null;

// Constants
const EUR_INR_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const YAHOO_URL = 'https://finance.yahoo.com/quote/EURINR=X';
const CORS_PROXIES = [
  `https://api.codetabs.com/v1/proxy/?quest=${YAHOO_URL}`,
  `https://corsproxy.io/?${YAHOO_URL}`,
  `https://api.allorigins.win/raw?url=${encodeURIComponent(YAHOO_URL)}`,
  `https://cors-anywhere.herokuapp.com/${YAHOO_URL}`,
];

// Valid exchange rate range (sanity check)
const MIN_RATE = 80;
const MAX_RATE = 150;

/**
 * Fetch current EUR/INR exchange rate
 * Attempts Yahoo Finance fetch via CORS proxy
 * Returns cached value if fetch fails
 * Returns cached value even if expired as fallback
 *
 * @returns Exchange rate (e.g., 88.5 for ₹88.50 per EUR) or null if all sources fail
 */
export async function fetchEURINR(): Promise<number | null> {
  // Check if cache is still valid
  if (eurInrCache && Date.now() - new Date(eurInrCache.timestamp).getTime() < EUR_INR_CACHE_TTL) {
    return eurInrCache.rate;
  }

  try {
    const rate = await fetchEURINRFromYahoo();

    if (rate !== null) {
      // Validate rate is in reasonable range
      if (rate < MIN_RATE || rate > MAX_RATE) {
        logger.warn(`EUR/INR rate ${rate} out of expected range [${MIN_RATE}, ${MAX_RATE}]`);
        return getCachedEURINR();
      }

      // Update cache
      eurInrCache = {
        rate,
        timestamp: new Date().toISOString(),
      };

      return rate;
    }
  } catch (error) {
    logger.error('EUR/INR fetch from Yahoo Finance failed', error);
  }

  // Fall back to cached value (even if expired)
  return getCachedEURINR();
}

/**
 * Fetch EUR/INR from Yahoo Finance via CORS proxy
 * Tries multiple proxies for redundancy, parses HTML for current exchange rate
 *
 * @returns Exchange rate or null if fetch/parse fails
 */
async function fetchEURINRFromYahoo(): Promise<number | null> {
  for (const proxyUrl of CORS_PROXIES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(proxyUrl, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(`EUR/INR proxy failed: HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();

      // Parse exchange rate from Yahoo Finance HTML
      // Look for pattern: regularMarketPrice>rate<
      // Yahoo structure: <fin-streamer data-field="regularMarketPrice">88.5</fin-streamer>
      const match = html.match(/regularMarketPrice[^>]*>([0-9.]+)</i);

      if (!match || !match[1]) {
        logger.warn('EUR/INR: Could not parse rate from Yahoo HTML');
        continue;
      }

      const rate = parseFloat(match[1]);

      if (isNaN(rate)) {
        logger.warn('EUR/INR: Parsed value is NaN');
        continue;
      }

      return rate;
    } catch (error) {
      logger.warn(`EUR/INR proxy fetch failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      continue;
    }
  }

  logger.error('EUR/INR: All proxy attempts failed');
  return null;
}

/**
 * Get cached EUR/INR rate (even if expired)
 * Used as fallback when fetch fails
 *
 * @returns Cached rate or null
 */
export function getCachedEURINR(): number | null {
  if (!eurInrCache) return null;
  return eurInrCache.rate;
}

/**
 * Get complete cached EUR/INR data with timestamp
 * @returns Complete cache entry or null
 */
export function getCachedEURINRData(): EURINRData | null {
  return eurInrCache ? { ...eurInrCache } : null;
}

/**
 * Set EUR/INR cache directly (useful for manual override or testing)
 * @param rate - Exchange rate
 */
export function setCachedEURINR(rate: number): void {
  if (rate < MIN_RATE || rate > MAX_RATE) {
    logger.warn(`EUR/INR rate ${rate} out of expected range, not caching`);
    return;
  }

  eurInrCache = {
    rate,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Clear EUR/INR cache
 */
export function clearEURINRCache(): void {
  eurInrCache = null;
}

/**
 * Initialize EUR/INR cache from persisted state
 * @param eurInrData - Cached EUR/INR data from localStorage/Firebase
 */
export function initializeEURINRCache(eurInrData: EURINRData | undefined): void {
  if (eurInrData && eurInrData.rate) {
    eurInrCache = eurInrData;
  }
}

/**
 * Show manual EUR/INR entry modal
 * User can manually enter exchange rate if fetch fails
 *
 * @returns Promise resolving to entered rate or null if cancelled
 */
export async function showManualEURINRModal(): Promise<number | null> {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <h3>Enter EUR/INR Exchange Rate</h3>
        <p style="color: #666; font-size: 0.9rem;">Exchange rate fetch failed. Please enter current EUR/INR rate.</p>

        <div class="form-group">
          <label>Exchange Rate (₹ per EUR)</label>
          <input type="number" id="eur-inr-rate" placeholder="e.g., 88.5" min="${MIN_RATE}" max="${MAX_RATE}" step="0.01" />
        </div>

        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button class="btn-primary" id="eur-inr-save">Save</button>
          <button class="btn-secondary" id="eur-inr-cancel">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const rateInput = modal.querySelector('#eur-inr-rate') as HTMLInputElement;
    const saveBtn = modal.querySelector('#eur-inr-save') as HTMLButtonElement;
    const cancelBtn = modal.querySelector('#eur-inr-cancel') as HTMLButtonElement;

    const cleanup = () => {
      modal.remove();
    };

    saveBtn.addEventListener('click', () => {
      const rate = parseFloat(rateInput.value);

      if (!isNaN(rate) && rate >= MIN_RATE && rate <= MAX_RATE) {
        setCachedEURINR(rate);
        cleanup();
        resolve(rate);
      } else {
        alert(`Please enter a rate between ${MIN_RATE} and ${MAX_RATE}.`);
      }
    });

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });
  });
}
