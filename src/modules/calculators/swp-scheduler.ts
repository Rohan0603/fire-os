import { addMonths, isValid, parseISO } from 'date-fns';
import { resolveFundBucket, DEFAULT_FUND_BUCKETS } from '../../lib/fundMatcher';
export { DEFAULT_FUND_BUCKETS };
import { formatCurrency } from '../../lib/formatters';

interface Holding {
  units: number;
  nav: number; // Net Asset Value
}

interface Holdings {
  [bucketId: string]: Holding;
}

interface RedemptionPlan {
  [bucketId: string]: number; // Units to redeem
}

/**
 * FIFO redemption across buckets, in the given order (defaults to `holdings`
 * key order). Buckets absent from `holdings` are skipped.
 */
export function calculateFIFORedemption(
  holdings: Holdings,
  withdrawalAmount: number,
  fundOrder?: string[],
): RedemptionPlan {
  const order = fundOrder ?? Object.keys(holdings);
  const redemption: RedemptionPlan = {};

  let remaining = withdrawalAmount;

  for (const fund of order) {
    redemption[fund] = 0;
    if (remaining <= 0) continue;

    const holding = holdings[fund];
    if (!holding) continue;

    const fundValue = holding.units * holding.nav;

    if (holding.nav > 0 && fundValue >= remaining) {
      // Partial redemption from this fund
      redemption[fund] = Math.ceil(remaining / holding.nav);
      remaining = 0;
    } else {
      // Full redemption from this fund
      redemption[fund] = holding.units;
      remaining -= fundValue;
    }
  }

  return redemption;
}

export function generateSWPSchedule(
  state: any,
  fiTriggerDate: string // When corpus hits the FI target
): void {
  // Enable SWP and set start date
  state.swpSchedule.enabled = true;
  state.swpSchedule.startDate = fiTriggerDate;

  // Create monthly withdrawal tasks in Firebase; persistence is simulated.
  getSWPWithdrawalDates(fiTriggerDate);

  // Simulated: saveToFirebase("users/swpSchedule", getSWPWithdrawalDates(fiTriggerDate));
}

export function getSWPWithdrawalDates(fiTriggerDate: string): string[] {
  if (!/^\d{4}-\d{2}$/.test(fiTriggerDate)) throw new RangeError('Invalid SWP start month');
  const startDate = parseISO(`${fiTriggerDate}-01T00:00:00Z`);
  if (!isValid(startDate)) throw new RangeError('Invalid SWP start month');

  return Array.from({ length: 360 }, (_, index) =>
    addMonths(startDate, index).toISOString().split('T')[0],
  );
}

export async function executeMonthlyWithdrawal(state: any): Promise<{ actualAmount: number }> {
  if (!state.swpSchedule || !state.swpSchedule.enabled) {
    return { actualAmount: 0 };
  }

  const buckets = state.fundBuckets?.length ? state.fundBuckets : DEFAULT_FUND_BUCKETS;
  const fundOrder = buckets.map((bucket: { id: string }) => bucket.id);

  // Gather current holdings with NAV from mf and sip, grouped by bucket.
  const holdings: Record<string, { units: number; nav: number }> = {};
  for (const bucketId of fundOrder) holdings[bucketId] = { units: 0, nav: 0 };

  const processFund = (fund: any) => {
    const bucketId = resolveFundBucket(fund, buckets);
    const bucket = (holdings[bucketId] ??= { units: 0, nav: 0 });
    const schemeCode = fund.schemeCode || '';
    const nav = schemeCode ? state.nav[schemeCode]?.nav ?? 0 : 0;
    bucket.units += fund.units || 0;
    if (nav > 0) bucket.nav = nav;
  };

  if (state.sip) Object.values(state.sip).forEach(processFund);
  if (state.mf) Object.values(state.mf).forEach(processFund);

  const redemption = calculateFIFORedemption(
    holdings,
    state.swpSchedule.monthlyAmount,
    fundOrder,
  );

  // Execute FIFO redemptions and update state.sip / state.mf
  const redeemFrom = (funds: Record<string, any> | undefined, bucketId: string, units: number): number => {
    if (!funds) return units;
    let remaining = units;
    for (const key of Object.keys(funds)) {
      if (remaining <= 0) break;
      const fund = funds[key];
      if (resolveFundBucket(fund, buckets) !== bucketId || !(fund.units > 0)) continue;
      const deduct = Math.min(fund.units, remaining);
      fund.units -= deduct;
      remaining -= deduct;
    }
    return remaining;
  };

  for (const [bucketId, unitsToRedeem] of Object.entries(redemption)) {
    if (unitsToRedeem > 0) {
      const remaining = redeemFrom(state.sip, bucketId, unitsToRedeem);
      if (remaining > 0) redeemFrom(state.mf, bucketId, remaining);
    }
  }

  // Compute actual redeemed amount: sum over buckets of (unitsRedeemed * nav)
  let actualAmount = 0;
  for (const [bucketId, unitsRedeemed] of Object.entries(redemption)) {
    const nav = holdings[bucketId]?.nav ?? 0;
    actualAmount += unitsRedeemed * nav;
  }

  // Add withdrawal to expense tracker with the actual amount redeemed
  if (!state.expenses) {
    state.expenses = [];
  }
  state.expenses.push({
    date: new Date().toISOString().split("T")[0],
    category: "SWP",
    amount: actualAmount,
    linkedToSWP: true,
  });

  return { actualAmount };
}
