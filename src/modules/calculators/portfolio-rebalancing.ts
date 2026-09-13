/**
 * Portfolio Rebalancing Module
 * Calculates allocation drift and generates rebalancing recommendations
 * Target allocation: PPFCF 40%, Nippon Growth 30%, Nippon SmallCap 20%, Gold 10%
 */

// Target allocation percentages (must sum to 100)
const TARGET_ALLOCATION: Record<string, number> = {
  PPFCF: 40,
  NipponGrowth: 30,
  NipponSmallCap: 20,
  Gold: 10,
};

// Threshold for recommending rebalancing (%)
const DRIFT_THRESHOLD = 5;

/**
 * Holdings dictionary: fund name → value in rupees
 */
interface Holdings {
  [fundName: string]: number;
}

/**
 * Allocation drift analysis result
 */
export interface AllocationDrift {
  current: { [fundName: string]: number }; // Current allocation % (0-100)
  target: { [fundName: string]: number }; // Target allocation % (0-100)
  driftAmount: { [fundName: string]: number }; // Difference in % (positive = over, negative = under)
  recommendations: string[]; // List of rebalancing actions
}

/**
 * Calculate allocation drift for portfolio
 * @param holdings - Fund holdings: { fundName: valueInRupees }
 * @param totalValue - Total portfolio value in rupees
 * @returns AllocationDrift with current/target/drift and recommendations
 */
export function calculateAllocationDrift(holdings: Holdings, totalValue: number): AllocationDrift {
  // Handle zero total value edge case
  if (totalValue <= 0) {
    const current: { [key: string]: number } = {};
    const driftAmount: { [key: string]: number } = {};

    // Initialize all funds with 0%
    Object.keys(TARGET_ALLOCATION).forEach(fund => {
      current[fund] = 0;
      driftAmount[fund] = 0;
    });

    return {
      current,
      target: { ...TARGET_ALLOCATION },
      driftAmount,
      recommendations: [],
    };
  }

  // Calculate current allocation percentages
  const current: { [key: string]: number } = {};
  const driftAmount: { [key: string]: number } = {};

  // Ensure all funds are present in current allocation
  Object.keys(TARGET_ALLOCATION).forEach(fund => {
    const value = holdings[fund] || 0;
    const percent = (value / totalValue) * 100;
    // Round to 1 decimal place
    current[fund] = Math.round(percent * 10) / 10;
  });

  // Calculate drift amounts
  Object.keys(TARGET_ALLOCATION).forEach(fund => {
    const drift = current[fund] - TARGET_ALLOCATION[fund];
    // Round to 1 decimal place
    driftAmount[fund] = Math.round(drift * 10) / 10;
  });

  // Generate recommendations for drift > DRIFT_THRESHOLD
  const recommendations: string[] = [];

  Object.keys(TARGET_ALLOCATION).forEach(fund => {
    const drift = Math.abs(driftAmount[fund]);

    if (drift > DRIFT_THRESHOLD) {
      const amountToMove = (drift / 100) * totalValue;
      const amountInLacs = Math.round((amountToMove / 100000) * 10) / 10; // Round to 1 decimal
      // Format amount with consistent decimal: if whole number, show .0
      const formattedAmount = Number.isInteger(amountInLacs) ? `${amountInLacs}.0` : amountInLacs;
      // Format drift with consistent decimal
      const formattedDrift = Number.isInteger(drift) ? `${drift}.0` : drift;

      if (driftAmount[fund] > 0) {
        // Over-allocated: recommend reducing
        recommendations.push(`Reduce ${fund} by ₹${formattedAmount}L (${formattedDrift}% drift)`);
      } else {
        // Under-allocated: recommend increasing
        recommendations.push(`Increase ${fund} by ₹${formattedAmount}L (${formattedDrift}% drift)`);
      }
    }
  });

  return {
    current,
    target: { ...TARGET_ALLOCATION },
    driftAmount,
    recommendations,
  };
}

