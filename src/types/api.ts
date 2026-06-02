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

/** Nifty 50 index level and historical data */
export interface NiftyData {
  level: number; // Current Nifty level
  high52w: number; // 52-week high
  timestamp: string; // ISO timestamp of fetch
  source: string; // Data source identifier (e.g., "api.mfapi.in", "manual")
}

/** EUR/INR exchange rate data */
export interface EURINRData {
  rate: number; // Exchange rate (e.g., 88.5 for ₹88.50 per EUR)
  timestamp: string; // ISO timestamp of fetch
}

/** Cached NAV entry with TTL management */
export interface NAVCache {
  schemeCode: string;
  nav: number; // Latest NAV
  timestamp: string; // ISO timestamp when cached
  ttl: number; // Time-to-live in milliseconds (e.g., 4 hours = 14400000)
}

/** Collection of cached NAV entries indexed by scheme code */
export type NAVCacheMap = Record<string, NAVCache>;

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
