/**
 * Dashboard KPI calculation functions
 * Calculates: Total Net Worth, SIP Status, FI Progress, Float Indicator
 * All functions handle NaN/Infinity safely with typed return objects
 */

import type { FireOSState } from '../../types/state';
import type { SIPFund } from '../../types/portfolio';

/**
 * Total Net Worth KPI - sum of all holdings at current market value
 */
export interface TotalNetWorthKPI {
  netWorth: number;
  breakdown: {
    mf: number;
    fd: number;
    epf: number;
    sip: number;
    esop: number;
    demat: number;
  };
}

export function totalNetWorth(state: FireOSState): TotalNetWorthKPI {
  // MF holdings: SIPFunds - units × NAV from cache
  const mf = Object.entries(state.mf).reduce((sum, [key, fund]) => {
    const nav = fund.schemeCode ? state.nav[fund.schemeCode]?.nav ?? 0 : 0;
    return sum + (fund.units * nav || 0);
  }, 0);

  // FD holdings: simple amount
  const fd = Object.values(state.fd).reduce((sum, holding) => sum + (holding.amount || 0), 0);

  // EPF holdings: simple amount
  const epf = Object.values(state.epf).reduce((sum, holding) => sum + (holding.amount || 0), 0);

  // SIP holdings: units × current NAV from cache
  const sip = Object.entries(state.sip).reduce((sum, [key, fund]) => {
    const navCacheKey = fund.schemeCode;
    const nav = navCacheKey ? state.nav[navCacheKey]?.nav ?? 0 : 0;
    return sum + (fund.units * nav || 0);
  }, 0);

  // ESOP holdings: simple amount
  const esop = Object.values(state.esop).reduce((sum, holding) => sum + (holding.amount || 0), 0);

  // Demat holdings: currentValue already in INR
  const demat = Object.values(state.demat).reduce((sum, holding) => sum + (holding.currentValue || 0), 0);

  // Total net worth
  const netWorth = mf + fd + epf + sip + esop + demat;

  return {
    netWorth: isFinite(netWorth) ? netWorth : 0,
    breakdown: {
      mf: isFinite(mf) ? mf : 0,
      fd: isFinite(fd) ? fd : 0,
      epf: isFinite(epf) ? epf : 0,
      sip: isFinite(sip) ? sip : 0,
      esop: isFinite(esop) ? esop : 0,
      demat: isFinite(demat) ? demat : 0,
    },
  };
}

/**
 * SIP Status KPI - tracks multiple SIP funds with P&L and XIRR
 */
export interface SIPStatusKPI {
  totalInvested: number;
  totalCurrentValue: number;
  totalPL: number;
  totalXIRR: number | null;
  funds: Array<{
    key: string;
    name: string;
    invested: number;
    currentValue: number;
    pl: number;
    xirr: number | null;
  }>;
}

export function sipStatus(state: FireOSState): SIPStatusKPI {
  const funds: SIPStatusKPI['funds'] = [];
  let totalInvested = 0;
  let totalCurrentValue = 0;
  let totalXIRR: number | null = null;
  let xiirrCount = 0;
  let xirrSum = 0;

  Object.entries(state.sip).forEach(([key, fund]) => {
    const nav = fund.schemeCode ? state.nav[fund.schemeCode]?.nav ?? 0 : 0;
    const invested = fund.costBasis ?? fund.monthlyAmount * 12; // Rough estimate
    const currentValue = fund.units * nav;
    const pl = currentValue - invested;
    const xirr = null; // Would need actual cash flow calculation

    funds.push({
      key,
      name: fund.name,
      invested: isFinite(invested) ? invested : 0,
      currentValue: isFinite(currentValue) ? currentValue : 0,
      pl: isFinite(pl) ? pl : 0,
      xirr,
    });

    totalInvested += invested;
    totalCurrentValue += currentValue;

    if (xirr !== null) {
      xirrSum += xirr;
      xiirrCount++;
    }
  });

  // Average XIRR if we have any
  if (xiirrCount > 0) {
    totalXIRR = xirrSum / xiirrCount;
  }

  const totalPL = totalCurrentValue - totalInvested;

  return {
    totalInvested: isFinite(totalInvested) ? totalInvested : 0,
    totalCurrentValue: isFinite(totalCurrentValue) ? totalCurrentValue : 0,
    totalPL: isFinite(totalPL) ? totalPL : 0,
    totalXIRR,
    funds,
  };
}

/**
 * FI Progress KPI - financial independence goal tracking
 */
export interface FIProgressKPI {
  fiTarget: number;
  currentCorpus: number;
  progressPercent: number;
  yearsRemaining: number | null;
}

export function fiProgress(state: FireOSState): FIProgressKPI {
  // FI target: user-entered value in profile
  const fiTarget = state.profile.fiTarget;

  // Current corpus from totalNetWorth
  const netWorthData = totalNetWorth(state);
  const currentCorpus = netWorthData.netWorth;

  // Progress percentage
  const progressPercent = fiTarget > 0 ? (currentCorpus / fiTarget) * 100 : 0;

  // Years remaining: null if not yet achieved
  let yearsRemaining: number | null = null;
  if (currentCorpus >= fiTarget) {
    yearsRemaining = 0;
  }

  return {
    fiTarget: isFinite(fiTarget) ? Math.max(0, fiTarget) : 0,
    currentCorpus: isFinite(currentCorpus) ? currentCorpus : 0,
    progressPercent: isFinite(progressPercent) ? Math.max(0, progressPercent) : 0,
    yearsRemaining,
  };
}

/**
 * Float Indicator KPI - market drawdown indicator
 * Shows how much market has fallen from 52-week high
 */
export interface FloatIndicatorKPI {
  niftyLevel: number;
  niftyHigh52w: number;
  drawdownPercent: number;
  drawdownAmount: number;
}

export function floatIndicator(state: FireOSState): FloatIndicatorKPI {
  // Use niftyData if available, otherwise niftyHigh as fallback
  const niftyLevel = state.niftyData?.level ?? state.niftyHigh ?? 0;
  const niftyHigh52w = state.niftyHigh ?? niftyLevel;

  // Calculate drawdown
  const drawdownAmount = niftyHigh52w - niftyLevel;
  const drawdownPercent = niftyHigh52w > 0 ? (drawdownAmount / niftyHigh52w) * 100 : 0;

  return {
    niftyLevel: isFinite(niftyLevel) ? niftyLevel : 0,
    niftyHigh52w: isFinite(niftyHigh52w) ? niftyHigh52w : 0,
    drawdownPercent: isFinite(drawdownPercent) ? Math.max(0, drawdownPercent) : 0,
    drawdownAmount: isFinite(drawdownAmount) ? drawdownAmount : 0,
  };
}

/**
 * Portfolio composition for pie chart
 */
export interface PortfolioCompositionKPI {
  categories: Array<{
    name: string;
    value: number;
    percentage: number;
  }>;
}

export function portfolioComposition(state: FireOSState): PortfolioCompositionKPI {
  const breakdown = totalNetWorth(state).breakdown;
  const total = breakdown.mf + breakdown.fd + breakdown.epf + breakdown.sip + breakdown.esop + breakdown.demat;

  const categories: PortfolioCompositionKPI['categories'] = [
    { name: 'Mutual Funds', value: breakdown.mf, percentage: total > 0 ? (breakdown.mf / total) * 100 : 0 },
    { name: 'Fixed Deposits', value: breakdown.fd, percentage: total > 0 ? (breakdown.fd / total) * 100 : 0 },
    { name: 'EPF', value: breakdown.epf, percentage: total > 0 ? (breakdown.epf / total) * 100 : 0 },
    { name: 'Mutual Funds', value: breakdown.sip, percentage: total > 0 ? (breakdown.sip / total) * 100 : 0 },
    { name: 'ESOP', value: breakdown.esop, percentage: total > 0 ? (breakdown.esop / total) * 100 : 0 },
    { name: 'Demat', value: breakdown.demat, percentage: total > 0 ? (breakdown.demat / total) * 100 : 0 },
  ].filter(cat => cat.value > 0); // Only show non-zero categories

  return {
    categories: categories.map(cat => ({
      ...cat,
      percentage: isFinite(cat.percentage) ? cat.percentage : 0,
    })),
  };
}
