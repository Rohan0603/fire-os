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
  if (!state.swpSchedule || !state.swpSchedule.enabled) return;

  // Gather current holdings with NAV from mf and sip
  const holdings: Record<string, { units: number; nav: number }> = {
    PPFCF: { units: 0, nav: 0 },
    NipponGrowth: { units: 0, nav: 0 },
    NipponSmallCap: { units: 0, nav: 0 },
    Gold: { units: 0, nav: 0 },
  };

  const processFund = (fund: any) => {
    const name = fund.name || '';
    let category = '';
    if (name.includes('Parag') || fund.schemeCode === '122639') category = 'PPFCF';
    else if (name.includes('GROWTH') || name.includes('Growth') || fund.schemeCode === '118668') category = 'NipponGrowth';
    else if (name.includes('SMALL') || name.includes('Small') || fund.schemeCode === '118778') category = 'NipponSmallCap';
    else if (name.includes('Gold') || fund.schemeCode === '135106') category = 'Gold';

    if (category) {
      const schemeCode = fund.schemeCode || (category === 'PPFCF' ? '122639' : category === 'NipponGrowth' ? '118668' : category === 'NipponSmallCap' ? '118778' : '135106');
      const nav = state.nav[schemeCode]?.nav ?? 0;
      holdings[category].units += fund.units || 0;
      holdings[category].nav = nav;
    }
  };

  if (state.sip) Object.values(state.sip).forEach(processFund);
  if (state.mf) Object.values(state.mf).forEach(processFund);

  const redemption = calculateFIFORedemption(
    holdings,
    state.swpSchedule.monthlyAmount
  );

  // Execute FIFO redemptions and update state.sip / state.mf
  for (const [fundName, unitsToRedeem] of Object.entries(redemption)) {
    if (unitsToRedeem > 0) {
      let remainingToRedeem = unitsToRedeem;
      
      if (state.sip) {
        for (const key of Object.keys(state.sip)) {
          const fund = state.sip[key];
          const name = fund.name || '';
          let match = false;
          if (fundName === 'PPFCF' && (name.includes('Parag') || fund.schemeCode === '122639')) match = true;
          else if (fundName === 'NipponGrowth' && (name.includes('GROWTH') || name.includes('Growth') || fund.schemeCode === '118668')) match = true;
          else if (fundName === 'NipponSmallCap' && (name.includes('SMALL') || name.includes('Small') || fund.schemeCode === '118778')) match = true;
          else if (fundName === 'Gold' && (name.includes('Gold') || fund.schemeCode === '135106')) match = true;

          if (match && fund.units > 0) {
            const deduct = Math.min(fund.units, remainingToRedeem);
            fund.units -= deduct;
            remainingToRedeem -= deduct;
            if (remainingToRedeem <= 0) break;
          }
        }
      }

      if (remainingToRedeem > 0 && state.mf) {
        for (const key of Object.keys(state.mf)) {
          const fund = state.mf[key];
          const name = fund.name || '';
          let match = false;
          if (fundName === 'PPFCF' && (name.includes('Parag') || fund.schemeCode === '122639')) match = true;
          else if (fundName === 'NipponGrowth' && (name.includes('GROWTH') || name.includes('Growth') || fund.schemeCode === '118668')) match = true;
          else if (fundName === 'NipponSmallCap' && (name.includes('SMALL') || name.includes('Small') || fund.schemeCode === '118778')) match = true;
          else if (fundName === 'Gold' && (name.includes('Gold') || fund.schemeCode === '135106')) match = true;

          if (match && fund.units > 0) {
            const deduct = Math.min(fund.units, remainingToRedeem);
            fund.units -= deduct;
            remainingToRedeem -= deduct;
            if (remainingToRedeem <= 0) break;
          }
        }
      }
    }
  }

  // Add withdrawal to expense tracker
  if (!state.expenses) {
    state.expenses = [];
  }
  state.expenses.push({
    date: new Date().toISOString().split("T")[0],
    category: "SWP",
    amount: state.swpSchedule.monthlyAmount,
    linkedToSWP: true,
  });
}


