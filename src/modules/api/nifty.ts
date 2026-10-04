/**
 * Nifty 50 Index Data Fetching Module
 * CRITICAL FIX (v2.2): Uses real index data or requires manual entry
 *
 * Data Sources (in priority order):
 * 1. NSE Public API (if available) - returns true Nifty50 index level + 52W high
 * 2. Manual entry via modal - user provides level + 52W high
 *
 * Cache TTL: 1 hour (index data changes daily, refresh frequently)
 */

import { getLogger } from '../../lib/logger';
import type { HistoricalDataPoint, HistoricalSeries, HistoryRange, NiftyData } from '../../types/api';
import { CONFIG } from '../../lib/config';

const logger = getLogger();

// In-memory Nifty cache
let niftyCache: NiftyData | null = null;

// Constants
const NIFTY_CACHE_TTL = CONFIG.cacheTtl.nifty;
/**
 * NSE API Endpoints (potential sources)
 * Note: NSE doesn't provide a direct public REST API for free tier
 * Attempting: 1) YahooFinance via CORS proxy 2) ETF approximation
 * Future: Direct NSE API if/when available
 */

/**
 * Fetch Nifty 50 level and 52-week high
 * PRIORITY 1: Try NSE/Yahoo Finance real data
 * PRIORITY 2: Return null (user must enter manually)
 *
 * @returns { level, high52w, source } or null if all sources fail
 */
export async function fetchNifty(): Promise<NiftyData | null> {
  // Check cache first
  if (niftyCache && Date.now() - new Date(niftyCache.timestamp).getTime() < NIFTY_CACHE_TTL) {
    return {
      level: niftyCache.level,
      high52w: niftyCache.high52w,
      source: niftyCache.source,
      timestamp: niftyCache.timestamp,
      status: 'cache-fresh',
    };
  }

  // ATTEMPT 1: Try Yahoo Finance via CORS proxy for real Nifty data
  try {
    const niftyReal = await fetchNiftyFromYahoo();
    if (niftyReal) {
      const timestamp = new Date().toISOString();
      niftyCache = {
        level: niftyReal.level,
        high52w: niftyReal.high52w,
        timestamp,
        source: 'Yahoo Finance (NSE data)',
        status: 'live',
      };
      return {
        level: niftyReal.level,
        high52w: niftyReal.high52w,
        source: niftyReal.source,
        timestamp,
        status: 'live',
      };
    }
  } catch (error) {
    logger.warn('Yahoo Finance fetch failed; manual entry is required', error);
  }

  logger.warn('All Nifty data sources failed; manual entry is required');
  return null;
}

/**
 * Fetch Nifty 50 from Yahoo Finance via CORS proxy
 * Parses JSON data for current level and 52-week high
 *
 * @returns { level, high52w, source } or null if fetch fails
 */
async function fetchNiftyFromYahoo(): Promise<{
  level: number;
  high52w: number;
  source: string;
} | null> {
  const proxies = [{ url: 'https://corsproxy.io/?', name: 'corsproxy' }];

  // Yahoo Finance Chart API gives exact JSON data for Nifty 50
  const yahooApiUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1d&range=1y';

  for (const proxy of proxies) {
    try {
      const proxyKey = import.meta.env.VITE_CORSPROXY_API_KEY;
      if (proxy.name === 'corsproxy' && !proxyKey) {
        logger.warn('Nifty corsproxy request skipped: VITE_CORSPROXY_API_KEY is not configured');
        continue;
      }

      const proxyUrl = `${proxy.url}key=${encodeURIComponent(proxyKey!)}&url=${encodeURIComponent(yahooApiUrl)}`;

      logger.log(`Nifty fetch via ${proxy.name}:`, proxyUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(proxyUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(`Nifty ${proxy.name} returned HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();

      if (data?.chart?.result?.[0]) {
        const result = data.chart.result[0];
        const meta = result.meta;
        const currentPrice = meta.regularMarketPrice;
        
        let fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh;
        
        // Fallback: Calculate from 1-year history data if not in meta
        if (!fiftyTwoWeekHigh && result.indicators?.quote?.[0]?.high) {
          const highs = result.indicators.quote[0].high.filter((h: any) => typeof h === 'number');
          if (highs.length > 0) {
            fiftyTwoWeekHigh = Math.max(...highs);
          }
        }
        
        if (!fiftyTwoWeekHigh) fiftyTwoWeekHigh = currentPrice;

        if (currentPrice && fiftyTwoWeekHigh) {
          logger.log('Nifty fetched from Yahoo Finance JSON API:', { level: currentPrice, high52w: fiftyTwoWeekHigh });
          return { level: currentPrice, high52w: fiftyTwoWeekHigh, source: `Yahoo Finance API (${proxy.name})` };
        }
      }

      logger.warn(`${proxy.name}: Could not parse Yahoo Finance JSON data`);
    } catch (error) {
      logger.warn(`${proxy.name} fetch failed:`, error);
    }
  }

  return null;
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
    status: 'manual',
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

/**
 * Maximum retained Nifty history points per series.
 * Yahoo serves the history we request at `interval=1d` (daily bars); the
 * `range=5y` window is ~1,260 NSE trading days (~252/year), so 1,260 points
 * equals the largest window we fetch and keeps the Task 2 history cache small.
 * Oversized results keep the newest points.
 */
export const NIFTY_HISTORY_MAX_POINTS = 1260;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const HISTORY_RANGE_YEARS = 5;

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

function isValidHistoryRange(range: HistoryRange): boolean {
  return isValidIsoDate(range.start) && isValidIsoDate(range.end) && range.start <= range.end;
}

function fiveYearsBefore(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year - HISTORY_RANGE_YEARS, month - 1, day)).toISOString().slice(0, 10);
}

function normalizeNiftyHistory(result: unknown): HistoricalDataPoint[] | null {
  if (!result || typeof result !== 'object') return null;

  const { timestamp, indicators } = result as {
    timestamp?: unknown;
    indicators?: { quote?: Array<{ close?: unknown }> };
  };
  const quote = Array.isArray(indicators?.quote) ? indicators.quote[0] : undefined;
  const closes = quote?.close;
  if (!Array.isArray(timestamp) || !Array.isArray(closes)) return null;

  const points: HistoricalDataPoint[] = [];
  const seenDates = new Set<string>();
  const length = Math.min(timestamp.length, closes.length);

  for (let index = 0; index < length; index++) {
    const seconds = timestamp[index];
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) continue;
    const time = seconds * 1000;
    if (!Number.isFinite(time) || Math.abs(time) > 8.64e15) continue;

    const date = new Date(time).toISOString().slice(0, 10);
    if (seenDates.has(date)) continue;

    const close = closes[index];
    const value = typeof close === 'number' ? close : NaN;
    if (!Number.isFinite(value) || value <= 0) continue;

    seenDates.add(date);
    points.push({ date, value });
  }

  if (points.length === 0) return null;
  return points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

async function fetchNiftyHistoryFromYahoo(): Promise<HistoricalDataPoint[] | null> {
  const proxyKey = import.meta.env.VITE_CORSPROXY_API_KEY;
  if (!proxyKey) {
    logger.warn('Nifty history request skipped: VITE_CORSPROXY_API_KEY is not configured');
    return null;
  }

  const yahooApiUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?interval=1d&range=5y';
  const proxyUrl = `https://corsproxy.io/?key=${encodeURIComponent(proxyKey)}&url=${encodeURIComponent(yahooApiUrl)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(proxyUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn(`Nifty history returned HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    return normalizeNiftyHistory(data?.chart?.result?.[0]);
  } catch (error) {
    logger.warn('Nifty history fetch failed', error);
    return null;
  }
}

/**
 * Fetch a bounded, normalized Nifty 50 history series
 * Uses the existing Yahoo chart endpoint through corsproxy with
 * `interval=1d&range=5y`. Timestamps are validated (finite epoch seconds),
 * converted to UTC calendar dates, deduplicated keeping the first provider
 * record per date, and sorted ascending; null/invalid closes are dropped so
 * sparse provider gaps stay sparse. Requests older than the five-year window
 * are clamped to it (bounded, never extrapolated); invalid ranges are rejected
 * before any request; failures and non-overlapping windows return null.
 *
 * @param range - Optional inclusive YYYY-MM-DD window
 * @returns Normalized series or null when no usable history exists
 */
export async function fetchNiftyHistory(range?: HistoryRange): Promise<HistoricalSeries | null> {
  if (range && !isValidHistoryRange(range)) {
    logger.warn('fetchNiftyHistory: rejected invalid range', range);
    return null;
  }

  const points = await fetchNiftyHistoryFromYahoo();
  if (!points) return null;

  let inRange = points;
  if (range) {
    const earliest = fiveYearsBefore(range.end);
    const effectiveStart = range.start > earliest ? range.start : earliest;
    inRange = points.filter((point) => point.date >= effectiveStart && point.date <= range.end);
  }

  if (inRange.length === 0) {
    logger.warn('fetchNiftyHistory: requested range outside provider history');
    return null;
  }

  return {
    points: inRange.length > NIFTY_HISTORY_MAX_POINTS
      ? inRange.slice(inRange.length - NIFTY_HISTORY_MAX_POINTS)
      : inRange,
    source: 'Yahoo Finance API (corsproxy)',
    fetchedAt: new Date().toISOString(),
    status: 'live',
  };
}
