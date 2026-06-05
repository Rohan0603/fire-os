import type { FireOSState } from '../../types/state';
import { getFundSchemeCode } from '../../lib/fundMatcher';

export interface FundHarvestRecommendation {
  fundKey: string;
  fundName: string;
  totalUnits: number;
  longTermUnits: number;
  longTermValue: number;
  longTermInvested: number;
  ltcgGains: number;
  currentNAV: number;
  recommendedHarvestUnits: number;
  recommendedHarvestAmount: number;
}

export interface TaxHarvestPlan {
  totalInvested: number;
  totalCurrentValue: number;
  totalLtcgGains: number;
  remainingLimit: number;
  totalRecommendedHarvest: number;
  totalRecommendedHarvestGain: number;
  recommendations: FundHarvestRecommendation[];
}

export function calculateLTCGHarvestPlan(
  state: FireOSState,
  now: Date = new Date()
): TaxHarvestPlan {
  const sip = state?.sip || {};
  const nav = state?.nav || {};
  
  let totalInvested = 0;
  let totalCurrentValue = 0;
  let totalLtcgGains = 0;

  const tempRecs: FundHarvestRecommendation[] = [];

  for (const [key, fund] of Object.entries(sip)) {
    if (!fund) continue;

    // 1. monthsElapsed
    let monthsElapsed = 0;
    if (fund.startDate) {
      const parts = fund.startDate.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      if (!isNaN(year) && !isNaN(month)) {
        const startDate = new Date(year, month - 1, 1);
        monthsElapsed = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth()) + 1;
        if (monthsElapsed < 0) {
          monthsElapsed = 0;
        }
      }
    }

    // 2. longTermMonths
    const longTermMonths = Math.max(0, monthsElapsed - 12);

    // 3. totalInvested
    const fundInvested = (fund.costBasis !== undefined && fund.costBasis !== null && fund.costBasis > 0)
      ? fund.costBasis
      : (fund.monthlyAmount || 0) * monthsElapsed;

    // 4. averageMonthlyInvestment
    const averageMonthlyInvestment = fundInvested / Math.max(1, monthsElapsed);

    // 5. longTermInvested
    const longTermInvested = averageMonthlyInvestment * longTermMonths;

    // 6. longTermUnits
    const units = fund.units || 0;
    let longTermUnits = fundInvested > 0 ? units * (longTermInvested / fundInvested) : 0;
    longTermUnits = Math.max(0, Math.min(units, longTermUnits));

    // 7. currentNAV
    const schemeCode = fund.schemeCode || getFundSchemeCode(fund.name);
    const currentNAV = (schemeCode && nav[schemeCode]) ? nav[schemeCode].nav ?? 0 : 0;

    // 8. currentValue
    const currentValue = units * currentNAV;

    // 9. longTermValue
    const longTermValue = longTermUnits * currentNAV;

    // 10. ltcgGains
    const ltcgGains = Math.max(0, longTermValue - longTermInvested);

    // Update totals
    totalInvested += fundInvested;
    totalCurrentValue += currentValue;
    totalLtcgGains += ltcgGains;

    tempRecs.push({
      fundKey: key,
      fundName: fund.name || '',
      totalUnits: units,
      longTermUnits: longTermUnits,
      longTermValue: longTermValue,
      longTermInvested: longTermInvested,
      ltcgGains: ltcgGains,
      currentNAV: currentNAV,
      recommendedHarvestUnits: 0,
      recommendedHarvestAmount: 0,
    });
  }

  // Calculate remaining limit
  const lastHarvested = state?.taxCalendar?.lastHarvestedAmount ?? 0;
  const remainingLimit = Math.max(0, 125000 - lastHarvested);

  // Sort funds by ltcgGains descending
  const recommendations = tempRecs.sort((a, b) => b.ltcgGains - a.ltcgGains);

  let currentRemainingLimit = remainingLimit;
  let totalRecommendedHarvest = 0;
  let totalRecommendedHarvestGain = 0;

  for (const rec of recommendations) {
    if (currentRemainingLimit <= 0 || rec.ltcgGains <= 0) {
      rec.recommendedHarvestAmount = 0;
      rec.recommendedHarvestUnits = 0;
      continue;
    }

    // Allocate recommended gain up to remaining limit
    const A = Math.min(rec.ltcgGains, currentRemainingLimit);

    // Correct units calculation
    rec.recommendedHarvestUnits = rec.ltcgGains > 0 ? rec.longTermUnits * (A / rec.ltcgGains) : 0;

    // Correct harvest amount
    rec.recommendedHarvestAmount = rec.recommendedHarvestUnits * rec.currentNAV;

    totalRecommendedHarvest += rec.recommendedHarvestAmount;
    totalRecommendedHarvestGain += A;
    currentRemainingLimit -= A;
  }

  return {
    totalInvested,
    totalCurrentValue,
    totalLtcgGains,
    remainingLimit,
    totalRecommendedHarvest,
    totalRecommendedHarvestGain,
    recommendations,
  };
}
