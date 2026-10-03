/**
 * Core financial calculation functions for FIRE OS
 * Includes XIRR, SIP corpus, FI metrics, and market crash simulations
 */

/**
 * SIP Corpus: Future Value of Regular Monthly Investments
 * Calculates compound growth of systematic monthly contributions
 *
 * @param monthlyAmount - Monthly SIP contribution in rupees
 * @param annualRate - Annual return rate as decimal (e.g., 0.12 for 12%)
 * @param years - Investment period in years
 * @returns Future value of all contributions + growth
 */
export function sipCorpus(
  monthlyAmount: number,
  annualRate: number,
  years: number
): number {
  const monthlyRate = annualRate / 12;
  const months = years * 12;

  // Handle edge case: 0% return
  if (Math.abs(monthlyRate) < 1e-10) {
    return monthlyAmount * months;
  }

  // Formula: FV = P × [((1 + r)^n - 1) / r]
  // where P = monthly amount, r = monthly rate, n = number of months
  const fv = monthlyAmount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
  return fv;
}

/**
 * SIP Cost Basis: Total Amount Invested
 * Simple calculation: monthly amount × number of months
 *
 * @param monthlyAmount - Monthly SIP contribution in rupees
 * @param monthsSinceStart - Number of months since SIP started
 * @returns Total amount invested (before any growth)
 */
export function sipCostBasis(
  monthlyAmount: number,
  monthsSinceStart: number
): number {
  return monthlyAmount * monthsSinceStart;
}

export interface CashFlow {
  date: Date;
  amount: number;
}

/** Calculate annualized return for dated cash flows using Newton-Raphson. */
export function calculateXirr(cashFlows: CashFlow[]): number | null {
  if (cashFlows.length < 2) return null;

  const validFlows = cashFlows.filter(
    flow => Number.isFinite(flow.amount) && !Number.isNaN(flow.date.getTime()),
  );
  if (validFlows.length < 2) return null;

  const start = validFlows[0].date.getTime();
  const years = validFlows.map(flow => (flow.date.getTime() - start) / 86_400_000 / 365);
  const hasPositive = validFlows.some(flow => flow.amount > 0);
  const hasNegative = validFlows.some(flow => flow.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  let rate = 0.1;
  for (let iteration = 0; iteration < 100; iteration++) {
    if (rate <= -0.999999) rate = -0.999999;
    const base = 1 + rate;
    let value = 0;
    let derivative = 0;

    validFlows.forEach((flow, index) => {
      const discount = Math.pow(base, years[index]);
      value += flow.amount / discount;
      derivative -= years[index] * flow.amount / (discount * base);
    });

    if (!Number.isFinite(value) || !Number.isFinite(derivative) || derivative === 0) return null;
    const nextRate = rate - value / derivative;
    if (!Number.isFinite(nextRate) || nextRate <= -1 || nextRate > 1e6) return null;
    if (Math.abs(nextRate - rate) < 1e-8) return nextRate;
    rate = nextRate;
  }

  return null;
}

/**
 * Emergency Runway: Months of Survival on Liquid Assets
 * How long can you survive on liquid assets at current expense rate?
 *
 * @param liquidAssets - Liquid assets in rupees (MF, FD, cash, etc.)
 * @param monthlyExpenses - Monthly expenses in rupees
 * @returns Number of months, or 999 if expenses are 0 (represents indefinite), or 0 if no assets
 */
export function emergencyRunway(
  liquidAssets: number,
  monthlyExpenses: number
): number {
  // Edge case: no expenses
  if (monthlyExpenses <= 0) {
    return liquidAssets > 0 ? 999 : 0;
  }

  // Edge case: no assets
  if (liquidAssets <= 0) {
    return 0;
  }

  return liquidAssets / monthlyExpenses;
}

/**
 * Crash Protocol: Market Drawdown Scenarios
 * Calculates how much buffer to deploy if market crashes further
 *
 * @param portfolioValue - User's total portfolio value in rupees
 * @param niftyHigh52w - Nifty 52-week high level
 * @param niftyCurrentLevel - Current Nifty level
 * @returns Object with current drawdown % and deploy amounts for 10%, 15%, 25% additional crashes
 */
export function crashProtocol(
  portfolioValue: number,
  niftyHigh52w: number,
  niftyCurrentLevel: number
): {
  drawdownPercent: number;
  deployAmount10: number;
  deployAmount15: number;
  deployAmount25: number;
} {
  // Calculate current drawdown from 52W high
  const drawdownPercent = ((niftyHigh52w - niftyCurrentLevel) / niftyHigh52w) * 100;

  // Buffer is 10% of actual portfolio value
  const bufferPercentage = 0.1;
  const buffer = portfolioValue * bufferPercentage;

  // Calculate deploy amounts for additional crashes
  // Each deploy amount represents how much to deploy for 10%, 15%, 25% additional crashes
  const deployAmount10 = buffer * (10 / 100); // Deploy for 10% more crash
  const deployAmount15 = buffer * (15 / 100); // Deploy for 15% more crash
  const deployAmount25 = buffer * (25 / 100); // Deploy for 25% more crash

  return {
    drawdownPercent: Math.max(0, drawdownPercent), // Never negative
    deployAmount10,
    deployAmount15,
    deployAmount25,
  };
}

/**
 * FI Goal Progress: Retirement Timeline
 * Calculates progress towards Financial Independence target
 *
 * @param currentCorpus - Current investment corpus in rupees
 * @param annualExpenses - Annual living expenses in rupees
 * @returns FI target, progress %, and years remaining (0 if already achieved, null if not yet achieved)
 */
export function fiGoalProgress(
  currentCorpus: number,
  annualExpenses: number
): {
  fiTarget: number;
  progressPercent: number;
  yearsRemaining: number | null;
} {
  // FI target = 25 × annual expenses (safe withdrawal rule: 4% per year)
  const fiTarget = annualExpenses * 25;

  // Handle edge case: 0 expenses
  if (annualExpenses === 0) {
    return {
      fiTarget: 0,
      progressPercent: 0,
      yearsRemaining: 0,
    };
  }

  // Calculate progress percentage
  const progressPercent = (currentCorpus / fiTarget) * 100;

  // If already achieved FI, years remaining = 0; otherwise null (not yet achieved)
  let yearsRemaining: number | null = null;
  if (currentCorpus >= fiTarget) {
    yearsRemaining = 0;
  }

  return {
    fiTarget,
    progressPercent,
    yearsRemaining,
  };
}

/**
 * SIP Pause Impact: Cost of Missing Contributions
 * Calculates total cost of pausing SIP for N months
 *
 * @param monthlyAmount - Monthly SIP contribution in rupees
 * @param pauseMonths - Number of months to pause
 * @param annualRate - Annual return rate as decimal (e.g., 0.12 for 12%)
 * @returns Missed contributions, lost growth, and total cost
 */
export function sipPauseImpact(
  monthlyAmount: number,
  pauseMonths: number,
  annualRate: number
): {
  missedContributions: number;
  lostGrowth: number;
  totalCost: number;
} {
  // Missed contributions: simple product
  const missedContributions = monthlyAmount * pauseMonths;

  // If 0 pause months, no cost
  if (pauseMonths === 0) {
    return {
      missedContributions: 0,
      lostGrowth: 0,
      totalCost: 0,
    };
  }

  // Lost growth: what those contributions would have earned over the pause period
  const monthlyRate = annualRate / 12;

  let lostGrowth = 0;

  if (Math.abs(monthlyRate) < 1e-10) {
    // No growth if rate is 0
    lostGrowth = 0;
  } else {
    // Future value of missed contributions if they had been invested
    // SIP contributions made at different times: some at start, some at end
    // Calculate FV of SIP for pauseMonths, then subtract the principal
    const fvOfMissedSIP = sipCorpus(monthlyAmount, annualRate, pauseMonths / 12);
    lostGrowth = fvOfMissedSIP - missedContributions;
  }

  const totalCost = missedContributions + lostGrowth;

  return {
    missedContributions,
    lostGrowth,
    totalCost,
  };
}
