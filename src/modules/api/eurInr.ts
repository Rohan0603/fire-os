/**
 * EUR/INR Exchange Rate Fetching Module
 * Fetches latest exchange rates from Yahoo Finance through CorsProxy
 * Used for ESOP Tools valuation in Indian Rupees
 */

import { getLogger } from '../../lib/logger';
import type { EURINRData } from '../../types/api';
import { CONFIG } from '../../lib/config';

const logger = getLogger();

// In-memory cache
let eurInrCache: EURINRData | null = null;

// Constants
const EUR_INR_CACHE_TTL = CONFIG.cacheTtl.eurInr;
// Valid exchange rate range (sanity check)
const MIN_RATE = 80;
const MAX_RATE = 150;

export async function convertCurrency(
  amount: number,
  sourceCurrency: string,
  desiredCurrency: string,
): Promise<number | null> {
  if (!Number.isFinite(amount)) return null;

  const source = sourceCurrency.trim().toUpperCase();
  const desired = desiredCurrency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(source) || !/^[A-Z]{3}$/.test(desired)) return null;
  if (source === desired) return amount;

  const proxyKey = import.meta.env.VITE_CORSPROXY_API_KEY;
  if (!proxyKey) {
    logger.warn('Currency conversion skipped: VITE_CORSPROXY_API_KEY is not configured');
    return null;
  }

  const yahooSymbol = `${source}${desired}=X`;
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`;
  const apiUrl = `https://corsproxy.io/?key=${encodeURIComponent(proxyKey)}&url=${encodeURIComponent(yahooUrl)}`;
  console.log('[Currency API] Conversion request', { amount, source, desired });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(apiUrl, { signal: controller.signal });
    console.log('[Currency API] Conversion response', { status: response.status, ok: response.ok });
    if (!response.ok) return null;

    const data = await response.json() as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: unknown } } | null> };
    };
    const rate = data.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (typeof rate !== 'number' || !Number.isFinite(rate)) return null;

    const converted = amount * rate;
    console.log('[Currency API] Conversion result', { amount, source, desired, converted });
    return converted;
  } catch (error) {
    logger.warn(`Currency conversion failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch current EUR/INR exchange rate
 * Fetches through Yahoo Finance via CorsProxy
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
    const rate = await convertCurrency(1, 'EUR', 'INR');

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
    logger.error('EUR/INR fetch from Frankfurter failed', error);
  }

  // Fall back to cached value (even if expired)
  return getCachedEURINR();
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
