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
import { workerUrl } from './worker';

const logger = getLogger();

// In-memory Nifty cache
let niftyCache: NiftyData | null = null;

// Constants
const NIFTY_CACHE_TTL = CONFIG.cacheTtl.nifty;
/**
 * NSE API Endpoints (potential sources)
 * Note: NSE doesn't provide a direct public REST API for free tier
 * The FIRE OS Worker proxies Yahoo Finance server-side; no browser key needed.
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

  // ATTEMPT 1: Fetch real Nifty data from the FIRE OS Worker market endpoint
  try {
    const niftyReal = await fetchNiftyFromYahoo();
    if (niftyReal) {
      const timestamp = new Date().toISOString();
      niftyCache = {
        level: niftyReal.level,
        high52w: niftyReal.high52w,
        timestamp,
        source: niftyReal.source,
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
 * Fetch Nifty 50 level and 52-week high from the FIRE OS Worker market endpoint
 * (`GET /api/market/nifty`). The Worker owns the Yahoo access and caching; the
 * browser never sees a proxy key.
 *
 * @returns { level, high52w, source } or null if the Worker is unreachable
 */
async function fetchNiftyFromYahoo(): Promise<{
  level: number;
  high52w: number;
  source: string;
} | null> {
  try {
    const response = await fetch(workerUrl('/api/market/nifty'), {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      logger.warn(`Nifty market endpoint returned HTTP ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { level?: unknown; high52w?: unknown; source?: unknown };
    const level =
      typeof data.level === 'number' && Number.isFinite(data.level) && data.level > 0
        ? data.level
        : null;
    const high52w =
      typeof data.high52w === 'number' && Number.isFinite(data.high52w) && data.high52w > 0
        ? data.high52w
        : level;
    if (level === null || high52w === null) {
      logger.warn('Nifty market endpoint returned unusable data');
      return null;
    }

    return {
      level,
      high52w,
      source: typeof data.source === 'string' && data.source ? data.source : 'Market Worker',
    };
  } catch (error) {
    logger.warn('Nifty market endpoint unreachable', error);
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

/**
 * Validate and normalize the Worker's `points` array (the Worker already
 * parsed and sorted the Yahoo series). Re-validating at the trust boundary
 * drops malformed entries, dedupes keeping the first record per date, and
 * sorts ascending. Returns null when no usable points remain.
 */
function normalizeWorkerPoints(raw: unknown): HistoricalDataPoint[] | null {
  if (!Array.isArray(raw)) return null;

  const points: HistoricalDataPoint[] = [];
  const seenDates = new Set<string>();

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const { date, value } = entry as { date?: unknown; value?: unknown };
    if (typeof date !== 'string' || !isValidIsoDate(date) || seenDates.has(date)) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;

    seenDates.add(date);
    points.push({ date, value });
  }

  if (points.length === 0) return null;
  return points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

async function fetchNiftyHistoryFromYahoo(): Promise<HistoricalDataPoint[] | null> {
  try {
    const response = await fetch(workerUrl('/api/market/nifty'), {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      logger.warn(`Nifty history market endpoint returned HTTP ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { points?: unknown };
    return normalizeWorkerPoints(data.points);
  } catch (error) {
    logger.warn('Nifty history market endpoint unreachable', error);
    return null;
  }
}

/**
 * Fetch a bounded, normalized Nifty 50 history series
 * Uses the FIRE OS Worker endpoint `GET /api/market/nifty`, which fetches
 * Yahoo `interval=1d&range=5y` server-side and returns normalized points.
 * Points are re-validated here (dates, finite positive values), deduplicated
 * keeping the first record per date, and sorted ascending; sparse provider
 * gaps stay sparse. Requests older than the five-year window are clamped to it
 * (bounded, never extrapolated); invalid ranges are rejected before any
 * request; failures and non-overlapping windows return null.
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
    source: 'Yahoo Finance',
    fetchedAt: new Date().toISOString(),
    status: 'live',
  };
}
