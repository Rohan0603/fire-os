interface Holding {
  units: number;
  nav: number; // Net Asset Value
}

interface Holdings {
  [fundName: string]: Holding;
}

interface RedemptionPlan {
  [fundName: string]: number; // Units to redeem
}

export function calculateFIFORedemption(
  holdings: Holdings,
  withdrawalAmount: number
): RedemptionPlan {
  const redemption: RedemptionPlan = {
    PPFCF: 0,
    NipponGrowth: 0,
    NipponSmallCap: 0,
    Gold: 0,
  };

  let remaining = withdrawalAmount;
  const fundOrder = ["PPFCF", "NipponGrowth", "NipponSmallCap", "Gold"];

  for (const fund of fundOrder) {
    if (remaining <= 0) break;

    const holding = holdings[fund];
    if (!holding) continue;

    const fundValue = holding.units * holding.nav;

    if (fundValue >= remaining) {
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
  fiTriggerDate: string // When corpus hits ₹5.5Cr
): void {
  // Enable SWP and set start date
  state.swpSchedule.enabled = true;
  state.swpSchedule.startDate = fiTriggerDate;

  // Create monthly withdrawal tasks in Firebase
  const withdrawalDates: string[] = [];
  let currentDate = new Date(fiTriggerDate + "-01");

  for (let i = 0; i < 360; i++) {
    // 30 years of withdrawals
    withdrawalDates.push(currentDate.toISOString().split("T")[0]);
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  // Simulated: saveToFirebase("users/swpSchedule", withdrawalDates);
}

export async function executeMonthlyWithdrawal(state: any): Promise<void> {
  if (!state.swpSchedule.enabled) return;

  const redemption = calculateFIFORedemption(
    state.mf || {}, // Assuming state.mf acts as holdings in this context
    state.swpSchedule.monthlyAmount
  );

  // Execute FIFO redemptions
  for (const [fund, units] of Object.entries(redemption)) {
    if (units > 0) {
      // Call API to redeem from fund
      // await redeemUnits(fund, units);
      console.log(`Redeemed ${units} units from ${fund}`);
    }
  }

  // Add withdrawal to expense tracker
  state.expenses.push({
    date: new Date().toISOString().split("T")[0],
    category: "SWP",
    amount: state.swpSchedule.monthlyAmount,
    linkedToSWP: true,
  });
}
