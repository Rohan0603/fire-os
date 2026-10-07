/**
 * Portfolio and holding type definitions
 * Covers mutual funds, fixed deposits, EPF, SIP, ESOP, and demat stocks
 */
import { differenceInCalendarDays, differenceInCalendarYears, isValid, parse } from 'date-fns';

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

/** A bounded liability recorded in INR for net-worth calculations. */
export interface Liability {
  name: string;
  amount: number;
}

export type Liabilities = Record<string, Liability>;

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
  annualExpenses: number; // monthly ₹ — legacy key name says annual; consumers multiply by 12
  fiTarget: number; // FI corpus target
  monthlyIncome: number;
}

export function calculateAgeFromDateOfBirth(dateOfBirth: string, today = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  // Legacy Date.UTC windowing mapped years 0000-0099 to 1900-1999 and failed the
  // round-trip check, so those inputs never produced an age. Keep that boundary.
  if (Number(dateOfBirth.slice(0, 4)) < 100) return null;

  const birthDate = parse(dateOfBirth, 'yyyy-MM-dd', today);
  if (!isValid(birthDate)) return null;

  // Project today's UTC calendar fields onto local time so date-fns calendar
  // math reproduces the original UTC arithmetic.
  const todayDate = new Date(0);
  todayDate.setFullYear(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  todayDate.setHours(0, 0, 0, 0);

  let age = differenceInCalendarYears(todayDate, birthDate);
  // Compare the anniversary inside today's year so the year gap cannot mask an
  // upcoming birthday (Feb 29 rolls to Mar 1 in non-leap years, as before).
  const anniversary = new Date(todayDate.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  if (differenceInCalendarDays(anniversary, todayDate) > 0) age -= 1;
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
