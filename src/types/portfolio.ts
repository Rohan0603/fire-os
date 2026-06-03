/**
 * Portfolio and holding type definitions
 * Covers mutual funds, fixed deposits, EPF, SIP, ESOP, and demat stocks
 */

/** Represents a single SIP (Systematic Investment Plan) fund */
export interface SIPFund {
  name: string;
  schemeCode?: string; // Optional: can be looked up via fundMatcher
  units: number;
  startDate: string; // YYYY-MM format
  monthlyAmount: number;
  costBasis?: number; // Optional override for actual invested amount
}

/** Generic holding with amount and currency */
export interface Holding {
  amount: number;
  currency: string;
}

/** Represents a demat stock holding (from Consolidated Account Statement) */
export interface DematHolding {
  isin: string;
  quantity: number;
  currentValue: number; // INR
  name: string;
  costBasis?: number; // Optional: cost basis for P&L calculation
}

/** Represents alpha/benchmark tracking data for a fund */
export interface AlphaTrackerData {
  fund: string; // Fund name (e.g., "PPFCF", "Nippon Growth")
  benchmark: string; // Benchmark index name (e.g., "Nifty 500 TRI")
  year: number; // Year of tracking (e.g., 2024, 2025, 2026)
  return: number; // Fund return percentage
  benchmarkReturn: number; // Benchmark return percentage
}

/** Portfolio profile information */
export interface PortfolioProfile {
  name: string;
  age: number;
  annualExpenses: number;
  fiTarget: number; // FI corpus target
}

/** Collection of SIP funds indexed by key (e.g., "sip1", "sip2") */
export type SIPFunds = Record<string, SIPFund>;

/** Collection of holdings indexed by key */
export type Holdings = Record<string, Holding>;

/** Collection of demat holdings indexed by ISIN */
export type DematHoldings = Record<string, DematHolding>;

/** Collection of alpha tracker data entries */
export type AlphaTrackerDataCollection = Record<string, AlphaTrackerData>;
