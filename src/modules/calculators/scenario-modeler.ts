/**
 * Scenario Modeler Calculator
 * Simulate different FI scenarios by adjusting CAGR, monthly SIP, or salary jumps
 * Helps users understand sensitivity to market returns and contribution changes
 */

export interface ScenarioParams {
  currentCorpus: number; // Current portfolio value
  monthlyAmount: number; // Current monthly SIP amount (₹30K default)
  targetCorpus: number; // FI target (default ₹5.5Cr = 5500000)
  cagr: number; // Expected annual return (0.11 to 0.20)
  currentAge: number; // Current age (e.g., 32)
  annualStepUp?: number; // Annual SIP increase % (default 10%)
}

export interface ScenarioResult {
  fiAge: number; // Age when FI reached (e.g., 45.2)
  monthsToFI: number; // Months from now (rounded to nearest integer)
  finalCorpus: number; // Final corpus at FI
  cagr: string; // Display CAGR as "15% CAGR"
}

/**
 * Calculate the age at which Financial Independence (FI) is reached
 * Uses month-by-month simulation for accuracy, accounting for:
 * - Monthly compound returns based on annual CAGR
 * - SIP contributions every month
 * - Annual step-up in SIP amount (default 10% per year)
 *
 * @param params - ScenarioParams with corpus, SIP, target, CAGR, age
 * @returns ScenarioResult with FI age, months to reach target, final corpus
 */
export function calculateFIAge(params: ScenarioParams): ScenarioResult {
  const {
    currentCorpus,
    monthlyAmount,
    targetCorpus,
    cagr,
    currentAge,
    annualStepUp = 0.1,
  } = params;

  // Validate inputs
  if (currentCorpus < 0 || monthlyAmount < 0 || targetCorpus <= 0 || cagr < 0 || currentAge < 0) {
    throw new Error('Invalid parameters for scenario calculation');
  }

  // Calculate monthly return rate from annual CAGR
  // Formula: monthlyReturn = (1 + cagr)^(1/12) - 1
  const monthlyReturn = Math.pow(1 + cagr, 1 / 12) - 1;

  let corpus = currentCorpus;
  let currentSIP = monthlyAmount;
  let month = 0;
  let monthsToFI = 0;

  // Simulate month by month until target is reached
  while (corpus < targetCorpus && month < 1000) {
    // Apply monthly return to current corpus
    corpus = corpus * (1 + monthlyReturn);

    // Add SIP contribution
    corpus = corpus + currentSIP;

    month++;

    // Every 12 months, increase SIP by annualStepUp %
    if (month % 12 === 0) {
      currentSIP = currentSIP * (1 + annualStepUp);
    }

    // Safety check to avoid infinite loops (1000 months = ~83 years)
    if (month >= 1000) {
      break;
    }
  }

  monthsToFI = month;
  const yearsToFI = monthsToFI / 12;
  const fiAge = currentAge + yearsToFI;

  // Format CAGR display
  const cagrDisplay = `${(cagr * 100).toFixed(0)}% CAGR`;

  return {
    fiAge: parseFloat(fiAge.toFixed(1)), // Round to 1 decimal place
    monthsToFI: Math.round(monthsToFI), // Round to nearest integer
    finalCorpus: Math.round(corpus), // Round to nearest rupee
    cagr: cagrDisplay,
  };
}

/**
 * Generate multiple scenarios for comparison
 * Creates scenarios at different CAGR levels (13%, 14%, 15%, 17%)
 *
 * @param baseParams - Base scenario parameters
 * @returns Array of ScenarioResult for different CAGR values
 */
export function generateScenarios(baseParams: Omit<ScenarioParams, 'cagr'>): ScenarioResult[] {
  const cagrValues = [0.13, 0.14, 0.15, 0.17]; // Conservative to optimistic
  return cagrValues.map((cagr) =>
    calculateFIAge({
      ...baseParams,
      cagr,
    })
  );
}
