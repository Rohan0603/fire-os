/**
 * API response and cache type definitions
 * Covers NAV fetching, Nifty levels, exchange rates, and cache management
 */

/** Response from mfapi.in for mutual fund NAV */
export interface MFAPIResponse {
  meta?: {
    fund_house: string;
    scheme_type: string;
    scheme_category: string;
    scheme_code: string;
    scheme_name: string;
    isin_div_payout: string;
    isin_div_reinvestment: string;
    isin_growth: string;
  };
  status: string;
  data?: Array<{
    date: string; // YYYY-MM-DD
    nav: string;
  }>;
}

export type MarketDataStatus = 'live' | 'cache-fresh' | 'stale' | 'manual';
export type NiftyDataStatus = Exclude<MarketDataStatus, 'stale'>;

/** Nifty 50 index level and historical data */
export interface NiftyData {
  level: number; // Current Nifty level
  high52w: number; // 52-week high
  timestamp: string; // ISO timestamp of fetch
  source: string; // Data source identifier (e.g., "api.mfapi.in", "manual")
  status?: NiftyDataStatus; // Provenance class; optional for backward compatibility
}

/** Exchange rate data for a currency pair */
export interface CurrencyRateData {
  rate: number;
  timestamp: string; // ISO timestamp of fetch
  sourceCurrency?: string;
  targetCurrency?: string;
  source?: string;
  status?: MarketDataStatus;
}

/** Cached exchange rates indexed by normalized source/target pair. */
export type CurrencyRateCacheMap = Record<string, CurrencyRateData>;

/** Backward-compatible name for persisted EUR/INR data. */
export type EURINRData = CurrencyRateData;

/** Cached NAV entry with TTL management */
export interface NAVCache {
  schemeCode: string;
  nav: number; // Latest NAV
  timestamp: string; // ISO timestamp when cached
  ttl: number; // Time-to-live in milliseconds (e.g., 4 hours = 14400000)
  source?: string;
  status?: MarketDataStatus;
}

/** Collection of cached NAV entries indexed by scheme code */
export type NAVCacheMap = Record<string, NAVCache>;

/** Single normalized historical observation from a provider series */
export interface HistoricalDataPoint {
  date: string; // YYYY-MM-DD (provider calendar date)
  value: number; // finite, > 0
}

/** Normalized bounded historical series returned by market adapters */
export interface HistoricalSeries {
  points: HistoricalDataPoint[]; // ascending by date, deduped, capped per source
  source: string; // Data source identifier (e.g., "api.mfapi.in")
  fetchedAt: string; // ISO timestamp of fetch
  status: MarketDataStatus;
}

/** Inclusive date window for history requests (YYYY-MM-DD) */
export interface HistoryRange {
  start: string;
  end: string;
}

/** API error response structure */
export interface APIError {
  message: string;
  code?: string;
  statusCode?: number;
  source?: string; // Which API failed (e.g., "mfapi.in", "yahoo-finance")
}

/** Generic API response envelope with success/error status */
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  cached?: boolean; // Indicates if response came from cache
}
