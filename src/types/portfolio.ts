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

/** Represents a user-defined portfolio holding with an expected annual return */
export interface OtherHolding {
  name: string;
  amount: number;
  annualReturn: number;
}

/** Represents a demat stock holding (from Consolidated Account Statement) */
export interface DematHolding {
  isin: string;
  quantity: number;
  currentValue: number; // INR
  name: string;
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
  dateOfBirth: string;
  age: number;
  taxSlabRate: number;
  annualExpenses: number;
  fiTarget: number; // FI corpus target
  monthlyIncome: number;
}

export function calculateAgeFromDateOfBirth(dateOfBirth: string, today = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  const birthDate = new Date(Date.UTC(year, month - 1, day));
  if (birthDate.getUTCFullYear() !== year || birthDate.getUTCMonth() !== month - 1 || birthDate.getUTCDate() !== day) return null;

  let age = today.getUTCFullYear() - year;
  const birthdayPassed = today.getUTCMonth() > month - 1
    || (today.getUTCMonth() === month - 1 && today.getUTCDate() >= day);
  if (!birthdayPassed) age -= 1;
  return age >= 0 ? age : null;
}

/** Collection of SIP funds indexed by key (e.g., "sip1", "sip2") */
export type SIPFunds = Record<string, SIPFund>;

/** Collection of holdings indexed by key */
export type Holdings = Record<string, Holding>;

/** Collection of user-defined holdings indexed by stable form key */
export type OtherHoldings = Record<string, OtherHolding>;

/** Collection of demat holdings indexed by ISIN */
export type DematHoldings = Record<string, DematHolding>;

/** Collection of alpha tracker data entries */
export type AlphaTrackerDataCollection = Record<string, AlphaTrackerData>;
