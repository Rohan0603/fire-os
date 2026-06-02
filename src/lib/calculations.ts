/**
 * Core financial calculation functions for FIRE OS
 * Includes XIRR, SIP corpus, FI metrics, and market crash simulations
 */

/**
 * XIRR: Annualized Internal Rate of Return
 * Calculates the annualized return from irregular cash flows using Newton-Raphson method
 *
 * @param cashFlows - Array of {date, amount} pairs. First amount should be negative (investment)
 * @param guessRate - Initial guess for convergence (default: 10%)
 * @returns Annualized return rate as decimal (e.g., 0.12 for 12%), or null if no solution
 */
export function xirr(
  cashFlows: Array<{ date: Date; amount: number }>,
  guessRate: number = 0.1
): number | null {
  // Validation
  if (cashFlows.length < 2) return null;
  if (cashFlows.some(cf => !cf.date || typeof cf.amount !== 'number')) return null;

  // Check if first cash flow is negative (investment)
  if (cashFlows[0].amount >= 0) return null;

  // Check if there's at least one positive flow (return)
  if (!cashFlows.some(cf => cf.amount > 0)) return null;

  const tolerance = 1e-6;
  const maxIterations = 100;
  let rate = guessRate;

  // Newton-Raphson iteration
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let npvDerivative = 0;
    const baseDate = cashFlows[0].date;

    // Calculate NPV and its derivative
    for (const cf of cashFlows) {
      const days = (cf.date.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24);
      const years = days / 365.25;
      const discountFactor = Math.pow(1 + rate, years);

      npv += cf.amount / discountFactor;
      npvDerivative += (-years * cf.amount) / (discountFactor * (1 + rate));
    }

    // Check convergence
    if (Math.abs(npv) < tolerance) {
      return rate;
    }

    // Prevent division by zero or invalid updates
    if (Math.abs(npvDerivative) < 1e-10) {
      return null;
    }

    // Newton-Raphson update
    const newRate = rate - npv / npvDerivative;

    // Safeguard against extreme values
    if (newRate < -0.99 || newRate > 10) {
      return null;
    }

    rate = newRate;
  }

  // Did not converge
  return null;
}

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

/**
 * Emergency Runway: Months of Survival on Liquid Assets
 * How long can you survive on liquid assets at current expense rate?
 *
 * @param liquidAssets - Liquid assets in rupees (MF, FD, cash, etc.)
 * @param monthlyExpenses - Monthly expenses in rupees
 * @returns Number of months, or Infinity if expenses are 0, or 0 if no assets
 */
export function emergencyRunway(
  liquidAssets: number,
  monthlyExpenses: number
): number {
  // Edge case: no expenses
  if (monthlyExpenses <= 0) {
    return liquidAssets > 0 ? Infinity : 0;
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
 * @param niftyHigh52w - Nifty 52-week high level
 * @param niftyCurrentLevel - Current Nifty level
 * @returns Object with current drawdown % and deploy amounts for 10%, 15%, 25% additional crashes
 */
export function crashProtocol(
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

  // Assume buffer is 10% of portfolio based on 52W high
  // Use 52W high as the reference point for portfolio size
  const bufferPercentage = 0.1;
  const portfolioValue = niftyHigh52w * 100; // Scaled estimate based on 52W high
  const buffer = portfolioValue * bufferPercentage;

  // Calculate deploy amounts for additional crashes
  // Each deploy amount represents 10%, 15%, 25% of the buffer
  const deployAmount10 = buffer * 0.1; // 10% of buffer for 10% crash
  const deployAmount15 = buffer * 0.15; // 15% of buffer for 15% crash
  const deployAmount25 = buffer * 0.25; // 25% of buffer for 25% crash

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
 * @returns FI target, progress %, and years remaining (0 if already achieved)
 */
export function fiGoalProgress(
  currentCorpus: number,
  annualExpenses: number
): {
  fiTarget: number;
  progressPercent: number;
  yearsRemaining: number;
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

  // If already achieved FI, years remaining = 0
  const yearsRemaining = currentCorpus >= fiTarget ? 0 : -1; // -1 indicates not yet achieved

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
