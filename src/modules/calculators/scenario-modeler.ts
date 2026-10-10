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
  fiAge: number | null; // Age when FI reached; null when unreachable within the horizon
  monthsToFI: number | null; // Months from now (rounded); null when unreachable
  finalCorpus: number; // Corpus at FI, or the simulated corpus at the horizon cap when unreachable
  cagr: string; // Display CAGR as "15% CAGR"
  unreachable: boolean; // True when the goal is not reached within MAX_FI_MONTHS
}

/** Simulation horizon: 1000 months (~83 years). Beyond this a projection is not meaningful. */
const MAX_FI_MONTHS = 1000;

export interface CoastFireResult {
  coastAge: number | null;
  yearsToCoast: number | null;
  requiredCorpusToday: number;
}

/** Calculate when current assets can reach FI without further contributions. */
export function calculateCoastFire(
  currentCorpus: number,
  targetCorpus: number,
  annualReturn: number,
  currentAge: number,
  retirementAge: number,
): CoastFireResult {
  if ([currentCorpus, targetCorpus, annualReturn, currentAge, retirementAge].some((value) => !Number.isFinite(value))
    || currentCorpus < 0 || targetCorpus <= 0 || annualReturn <= -1 || currentAge < 0 || retirementAge < currentAge) {
    throw new Error('Invalid parameters for Coast FIRE calculation');
  }

  const yearsAvailable = retirementAge - currentAge;
  const requiredCorpusToday = targetCorpus / Math.pow(1 + annualReturn, yearsAvailable);
  if (currentCorpus >= requiredCorpusToday) return { coastAge: currentAge, yearsToCoast: 0, requiredCorpusToday };
  if (currentCorpus <= 0 || annualReturn <= 0) return { coastAge: null, yearsToCoast: null, requiredCorpusToday };

  const yearsToCoast = Math.log(targetCorpus / currentCorpus) / Math.log(1 + annualReturn);
  const coastAge = currentAge + yearsToCoast;
  return coastAge <= retirementAge
    ? { coastAge: Number(coastAge.toFixed(1)), yearsToCoast: Number(yearsToCoast.toFixed(1)), requiredCorpusToday }
    : { coastAge: null, yearsToCoast: null, requiredCorpusToday };
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
  let reached = currentCorpus >= targetCorpus;

  // Simulate month by month until target is reached
  while (!reached && month < MAX_FI_MONTHS) {
    // Apply monthly return to current corpus
    corpus = corpus * (1 + monthlyReturn);

    // Add SIP contribution
    corpus = corpus + currentSIP;

    month++;

    // Every 12 months, increase SIP by annualStepUp %
    if (month % 12 === 0) {
      currentSIP = currentSIP * (1 + annualStepUp);
    }

    if (corpus >= targetCorpus) reached = true;
  }

  // Format CAGR display
  const cagrDisplay = `${(cagr * 100).toFixed(0)}% CAGR`;

  // Goal not reached within the horizon: report explicitly instead of a capped,
  // fake "FI in 83 years" projection.
  if (!reached) {
    return { fiAge: null, monthsToFI: null, finalCorpus: Math.round(corpus), cagr: cagrDisplay, unreachable: true };
  }

  const yearsToFI = month / 12;
  const fiAge = currentAge + yearsToFI;

  return {
    fiAge: parseFloat(fiAge.toFixed(1)), // Round to 1 decimal place
    monthsToFI: Math.round(month), // Round to nearest integer
    finalCorpus: Math.round(corpus), // Round to nearest rupee
    cagr: cagrDisplay,
    unreachable: false,
  };
}

/** Assumptions for one FI planning scenario (percent-based, UI-facing). */
export interface FIScenarioInput {
  label: string;
  currentCorpus: number;
  monthlySip: number;
  annualStepUpPercent: number;
  annualReturnPercent: number;
  fiGoal: number;
  currentAge: number;
}

/** Projected outcome for one scenario. Values are estimates, not guarantees. */
export interface FIScenarioResult {
  label: string;
  monthsToGoal: number | null; // null when the goal is unreachable within the horizon
  ageAtGoal: number | null; // null when the goal is unreachable within the horizon
  projectedCorpus: number;
  unreachable: boolean;
  assumptions: FIScenarioInput;
}

function isValidScenario(scenario: FIScenarioInput): boolean {
  return (
    Number.isFinite(scenario.currentCorpus) &&
    scenario.currentCorpus >= 0 &&
    Number.isFinite(scenario.monthlySip) &&
    scenario.monthlySip >= 0 &&
    Number.isFinite(scenario.annualStepUpPercent) &&
    scenario.annualStepUpPercent >= 0 &&
    Number.isFinite(scenario.annualReturnPercent) &&
    scenario.annualReturnPercent >= 0 &&
    Number.isFinite(scenario.fiGoal) &&
    scenario.fiGoal > 0 &&
    Number.isFinite(scenario.currentAge) &&
    scenario.currentAge >= 0
  );
}

/**
 * Compare FI planning scenarios side by side.
 * Reuses calculateFIAge (same month-by-month compounding math) per scenario.
 * Invalid scenarios (non-finite or negative/zero-where-meaningless assumptions)
 * are filtered out; no exceptions escape and input order is preserved.
 */
export function compareFIScenarios(scenarios: FIScenarioInput[]): FIScenarioResult[] {
  if (!Array.isArray(scenarios)) return [];

  const results: FIScenarioResult[] = [];
  for (const scenario of scenarios) {
    if (!scenario || typeof scenario !== 'object' || !isValidScenario(scenario)) continue;

    const projected = calculateFIAge({
      currentCorpus: scenario.currentCorpus,
      monthlyAmount: scenario.monthlySip,
      targetCorpus: scenario.fiGoal,
      cagr: scenario.annualReturnPercent / 100,
      currentAge: scenario.currentAge,
      annualStepUp: scenario.annualStepUpPercent / 100,
    });

    results.push({
      label: scenario.label,
      monthsToGoal: projected.monthsToFI,
      ageAtGoal: projected.fiAge,
      projectedCorpus: projected.finalCorpus,
      unreachable: projected.unreachable,
      assumptions: { ...scenario },
    });
  }
  return results;
}

