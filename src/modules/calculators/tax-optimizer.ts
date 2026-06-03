interface TaxComparisonParams {
  gainAmount: number;
  strategy: "sip" | "lumpSum";
  taxRate: number; // 0.20 for 20% LTCG tax
}

interface TaxComparison {
  grossGain: number;
  taxPayable: number;
  netGain: number;
  strategy: string;
}

interface LTCGHarvestParams {
  yearlyLimit: number; // ₹1.25L
  currentGains: number; // Unrealized gains
  taxableIncome: number; // Total taxable income
}

interface HarvestRecommendation {
  recommendedAmount: number;
  taxPayable: number;
  netGain: number;
  rationale: string;
}

export function calculateTaxComparison(
  params: TaxComparisonParams
): TaxComparison {
  const { gainAmount, strategy, taxRate } = params;

  // LTCG tax is same regardless of strategy (20% for mutual funds)
  // But SIP spreads redemptions, potentially across tax years
  const taxPayable = gainAmount * taxRate;
  const netGain = gainAmount - taxPayable;

  return {
    grossGain: gainAmount,
    taxPayable,
    netGain,
    strategy,
  };
}

export function calculateLTCGHarvestAmount(
  params: LTCGHarvestParams
): HarvestRecommendation {
  const { yearlyLimit, currentGains, taxableIncome } = params;

  const recommendedAmount = Math.min(yearlyLimit, currentGains);
  const taxPayable = recommendedAmount * 0.2; // 20% LTCG tax
  const netGain = recommendedAmount - taxPayable;

  let rationale = `Harvest ₹${(recommendedAmount / 100000).toFixed(2)}L gains to use LTCG tax efficiency`;
  if (taxableIncome > 5000000) {
    rationale += " (high income, harvest to minimize bracket creep)";
  }

  return {
    recommendedAmount,
    taxPayable,
    netGain,
    rationale,
  };
}

export function generateTaxCalendar(state: any): string[] {
  const calendar: string[] = [];

  // Annual LTCG harvest reminder (April 1st - Indian fiscal year start)
  for (let year = 2026; year <= 2060; year++) {
    calendar.push(`${year}-04-01: LTCG Harvest Period (April - March)`);
    calendar.push(
      `${year}-04-15: Recommended: Harvest ₹1.25L gains for Year 6+ portfolios`
    );
  }

  // Section 80C reminder (March 31st deadline)
  for (let year = 2026; year <= 2060; year++) {
    calendar.push(`${year}-03-31: Section 80C deadline (₹1.5L limit)`);
  }

  return calendar;
}

export function generateTaxOptimizationReport(state: any): string {
  const report = `
    **Tax Optimization Report**
    
    **LTCG Harvest Strategy:**
    - Annual target: ₹1.25L (use 20% LTCG tax efficiency)
    - Timing: April-May (start of fiscal year)
    - Strategy: Harvest oldest/highest-return funds first
    
    **SIP vs Lump-Sum Comparison:**
    - Tax impact: Same (20% LTCG applies to both)
    - Recommendation: Lump-sum for simplicity (no ongoing tax tracking)
    
    **Section 80C/80D:**
    - EPF contribution: Up to ₹1.5L/year (auto-deducted)
    - Section 80D (Health insurance): Up to ₹25K (individual) or ₹50K (family)
    
    **Next LTCG Harvest:** ${state?.taxCalendar?.lastLTCGHarvestDate || 'Not set'}
  `;
  return report;
}
