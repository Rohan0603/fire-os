/**
 * Portfolio Rebalancing Module
 * Calculates allocation drift and generates rebalancing recommendations from
 * user-owned bucket targets (see `FundBucket.targetPercent`).
 */

/** Percentage drift above which a rebalancing action is suggested. */
const DRIFT_THRESHOLD = 5;

/**
 * Holdings dictionary: bucket id → value in rupees
 */
interface Holdings {
  [bucketId: string]: number;
}

/**
 * Allocation drift analysis result
 */
export interface AllocationDrift {
  current: { [bucketId: string]: number }; // Current allocation % (0-100)
  target: { [bucketId: string]: number }; // Target allocation % (0-100)
  driftAmount: { [bucketId: string]: number }; // Difference in % (positive = over, negative = under)
  recommendations: string[]; // List of rebalancing actions
}

/**
 * Calculate allocation drift for portfolio
 * @param holdings - Bucket holdings: { bucketId: valueInRupees }
 * @param totalValue - Total portfolio value in rupees
 * @param targets - Target allocation % by bucket id
 * @returns AllocationDrift with current/target/drift and recommendations
 */
export function calculateAllocationDrift(
  holdings: Holdings,
  totalValue: number,
  targets: { [bucketId: string]: number },
): AllocationDrift {
  const targetSum = Object.values(targets).reduce((sum, value) => sum + (value || 0), 0);

  // Handle zero total value edge case
  if (totalValue <= 0) {
    const current: { [key: string]: number } = {};
    const driftAmount: { [key: string]: number } = {};

    // Initialize all buckets with 0%
    Object.keys(targets).forEach(bucket => {
      current[bucket] = 0;
      driftAmount[bucket] = 0;
    });

    return {
      current,
      target: { ...targets },
      driftAmount,
      recommendations: [],
    };
  }

  // Calculate current allocation percentages
  const current: { [key: string]: number } = {};
  const driftAmount: { [key: string]: number } = {};

  // Ensure all buckets are present in current allocation
  Object.keys(targets).forEach(bucket => {
    const value = holdings[bucket] || 0;
    const percent = (value / totalValue) * 100;
    // Round to 1 decimal place
    current[bucket] = Math.round(percent * 10) / 10;
  });

  // Calculate drift amounts
  Object.keys(targets).forEach(bucket => {
    const drift = current[bucket] - targets[bucket];
    // Round to 1 decimal place
    driftAmount[bucket] = Math.round(drift * 10) / 10;
  });

  // Generate recommendations for drift > DRIFT_THRESHOLD. With no configured
  // targets (sum 0) every bucket would look "over" against a 0% target, so skip.
  const recommendations: string[] = [];

  if (targetSum > 0) {
    Object.keys(targets).forEach(bucket => {
      const drift = Math.abs(driftAmount[bucket]);

      if (drift > DRIFT_THRESHOLD) {
        const amountToMove = (drift / 100) * totalValue;
        const amountInLacs = Math.round((amountToMove / 100000) * 10) / 10; // Round to 1 decimal
        // Format amount with consistent decimal: if whole number, show .0
        const formattedAmount = Number.isInteger(amountInLacs) ? `${amountInLacs}.0` : amountInLacs;
        // Format drift with consistent decimal
        const formattedDrift = Number.isInteger(drift) ? `${drift}.0` : drift;

        if (driftAmount[bucket] > 0) {
          // Over-allocated: recommend reducing
          recommendations.push(`Reduce ${bucket} by ₹${formattedAmount}L (${formattedDrift}% drift)`);
        } else {
          // Under-allocated: recommend increasing
          recommendations.push(`Increase ${bucket} by ₹${formattedAmount}L (${formattedDrift}% drift)`);
        }
      }
    });
  }

  return {
    current,
    target: { ...targets },
    driftAmount,
    recommendations,
  };
}
