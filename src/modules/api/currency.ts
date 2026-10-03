/** Generic exchange-rate fetching and caching module. */

import { getLogger } from '../../lib/logger';
import type { CurrencyRateCacheMap, CurrencyRateData, MarketDataStatus } from '../../types/api';
import { CONFIG } from '../../lib/config';

const logger = getLogger();

// ISO 4217 alphabetic currency codes. Yahoo Finance may support fewer pairs.
const ISO_CURRENCY_CODES = new Set([
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD',
  'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BOV', 'BRL', 'BSD', 'BTN', 'BWP',
  'BYN', 'BZD', 'CAD', 'CDF', 'CHE', 'CHF', 'CHW', 'CLF', 'CLP', 'CNY', 'COP', 'COU',
  'CRC', 'CUC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB',
  'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD',
  'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY',
  'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR',
  'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR',
  'MVR', 'MWK', 'MXN', 'MXV', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD',
  'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB',
  'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SLL', 'SOS', 'SRD',
  'SSP', 'STN', 'SVC', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD',
  'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'USN', 'UYI', 'UYU', 'UYW', 'UZS', 'VED', 'VES',
  'VND', 'VUV', 'WST', 'XAF', 'XAG', 'XAU', 'XBA', 'XBB', 'XBC', 'XBD', 'XCD', 'XDR',
  'XOF', 'XPD', 'XPF', 'XPT', 'XSU', 'XTS', 'XUA', 'XXX', 'YER', 'ZAR', 'ZMW', 'ZWL',
]);

const currencyRateCache = new Map<string, CurrencyRateData>();

const CURRENCY_RATE_CACHE_TTL = CONFIG.cacheTtl.currencyRate;

function cacheStatus(data: CurrencyRateData): MarketDataStatus {
  if (data.status === 'manual') return 'manual';
  return Date.now() - new Date(data.timestamp).getTime() < CURRENCY_RATE_CACHE_TTL ? 'cache-fresh' : 'stale';
}

function currencyPairKey(sourceCurrency: string, targetCurrency: string): string {
  return `${sourceCurrency}${targetCurrency}`;
}

export function isSupportedCurrencyCode(currency: string): boolean {
  return ISO_CURRENCY_CODES.has(currency.trim().toUpperCase());
}

export function getCachedCurrencyRate(sourceCurrency: string, targetCurrency: string): CurrencyRateData | null {
  const source = sourceCurrency.trim().toUpperCase();
  const target = targetCurrency.trim().toUpperCase();
  const data = currencyRateCache.get(currencyPairKey(source, target));
  return data ? { ...data, status: cacheStatus(data) } : null;
}

export function setCachedCurrencyRate(
  sourceCurrency: string,
  targetCurrency: string,
  rate: number,
  metadata: Pick<CurrencyRateData, 'source' | 'status'> = { source: 'manual', status: 'manual' },
): void {
  if (!Number.isFinite(rate) || rate <= 0) return;
  const source = sourceCurrency.trim().toUpperCase();
  const target = targetCurrency.trim().toUpperCase();
  if (!isSupportedCurrencyCode(source) || !isSupportedCurrencyCode(target)) return;
  currencyRateCache.set(currencyPairKey(source, target), {
    rate,
    timestamp: new Date().toISOString(),
    sourceCurrency: source,
    targetCurrency: target,
    ...metadata,
  });
}

export async function convertCurrency(
  amount: number,
  sourceCurrency: string,
  desiredCurrency: string,
): Promise<number | null> {
  if (!Number.isFinite(amount)) return null;

  const source = sourceCurrency.trim().toUpperCase();
  const desired = desiredCurrency.trim().toUpperCase();
  if (!isSupportedCurrencyCode(source) || !isSupportedCurrencyCode(desired)) return null;
  if (source === desired) return amount;

  const cached = getCachedCurrencyRate(source, desired);
  if (cached && cached.status !== 'stale') return amount * cached.rate;

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

    setCachedCurrencyRate(source, desired, rate, {
      source: 'Yahoo Finance via corsproxy',
      status: 'live',
    });
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
 * Fetch and cache a currency-pair rate.
 */
export async function fetchCurrencyRate(sourceCurrency: string, targetCurrency: string): Promise<number | null> {
  const source = sourceCurrency.trim().toUpperCase();
  const target = targetCurrency.trim().toUpperCase();
  if (!isSupportedCurrencyCode(source) || !isSupportedCurrencyCode(target)) return null;
  const cached = getCachedCurrencyRate(source, target);
  if (cached && cached.status !== 'stale') {
    return cached.rate;
  }

  try {
    const rate = await convertCurrency(1, source, target);

    if (rate !== null) {
      setCachedCurrencyRate(source, target, rate, {
        source: 'Yahoo Finance via corsproxy',
        status: 'live',
      });

      return rate;
    }
  } catch (error) {
    logger.error(`Currency rate fetch failed for ${source}/${target}`, error);
  }

  return cached?.rate ?? null;
}

export function getCurrencyRateCache(): CurrencyRateCacheMap {
  return Object.fromEntries([...currencyRateCache].map(([key, data]) => [key, { ...data, status: cacheStatus(data) }]));
}

export function initializeCurrencyRateCache(currencyRates: CurrencyRateCacheMap | undefined): void {
  if (!currencyRates) return;
  for (const [key, data] of Object.entries(currencyRates)) {
    if (data && data.rate > 0) currencyRateCache.set(key, data);
  }
}

export async function showManualCurrencyRateModal(sourceCurrency: string, targetCurrency: string): Promise<number | null> {
  if (!isSupportedCurrencyCode(sourceCurrency) || !isSupportedCurrencyCode(targetCurrency)) return null;
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <h3>Enter ${sourceCurrency}/${targetCurrency} Exchange Rate</h3>
        <p style="color: #666; font-size: 0.9rem;">Exchange rate fetch failed. Please enter current ${sourceCurrency}/${targetCurrency} rate.</p>

        <div class="form-group">
          <label>Exchange Rate</label>
          <input type="number" id="currency-rate" placeholder="e.g., 1.1" min="0" step="0.0001" />
        </div>

        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button class="btn-primary" id="eur-inr-save">Save</button>
          <button class="btn-secondary" id="eur-inr-cancel">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const rateInput = modal.querySelector('#currency-rate') as HTMLInputElement;
    const saveBtn = modal.querySelector('#eur-inr-save') as HTMLButtonElement;
    const cancelBtn = modal.querySelector('#eur-inr-cancel') as HTMLButtonElement;

    const cleanup = () => {
      modal.remove();
    };

    saveBtn.addEventListener('click', () => {
      const rate = parseFloat(rateInput.value);

      if (!isNaN(rate) && rate > 0) {
        setCachedCurrencyRate(sourceCurrency, targetCurrency, rate);
        cleanup();
        resolve(rate);
      } else {
        alert('Please enter a positive exchange rate.');
      }
    });

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });
  });
}
