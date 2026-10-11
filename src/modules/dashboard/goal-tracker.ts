/**
 * Goal Progress Tracker Module
 * Computes progress toward a general planning goal (corpus vs target, time to
 * the funding start date). Used by the dashboard goal cards.
 */

export interface GoalTrackerParams {
  currentCorpus: number; // Corpus saved towards the goal so far (₹)
  targetCorpus: number; // Target corpus (₹)
  currentDate: string; // YYYY-MM-DD format
  sipStartDate: string; // YYYY-MM format
}

export interface GoalProgress {
  percentage: number; // % of target reached (0-100)
  remainingAmount: number; // Amount needed to reach target
  yearsUntilStart: number; // Years until funding starts
  status: 'planning' | 'in_progress' | 'target_reached';
}

/**
 * Calculate goal progress
 * @param params - goal tracker parameters
 * @returns goal progress data
 * @throws {Error} if targetCorpus <= 0, currentCorpus < 0, or date format is invalid
 */
export function calculateGoalProgress(params: GoalTrackerParams): GoalProgress {
  const { currentCorpus, targetCorpus, currentDate, sipStartDate } = params;

  // Input validation
  if (targetCorpus <= 0) {
    throw new Error('Target corpus must be > 0');
  }
  if (currentCorpus < 0) {
    throw new Error('Current corpus cannot be negative');
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(currentDate)) {
    throw new Error('Current date must be in YYYY-MM-DD format');
  }

  // Validate SIP start date format (YYYY-MM)
  const sipDateRegex = /^\d{4}-\d{2}$/;
  if (!sipDateRegex.test(sipStartDate)) {
    throw new Error('SIP start date must be in YYYY-MM format');
  }

  // Calculate percentage
  const percentage = (currentCorpus / targetCorpus) * 100;

  // Calculate remaining amount
  const remainingAmount = targetCorpus - currentCorpus;

  // Calculate years until funding start
  const currentDateObj = new Date(currentDate);
  const sipStartYear = parseInt(sipStartDate.split('-')[0], 10);
  const sipStartMonth = parseInt(sipStartDate.split('-')[1], 10);
  const sipStartDateObj = new Date(sipStartYear, sipStartMonth - 1, 1);

  const monthsDiff =
    (sipStartDateObj.getFullYear() - currentDateObj.getFullYear()) * 12 +
    (sipStartDateObj.getMonth() - currentDateObj.getMonth());

  const yearsUntilStart = monthsDiff / 12;

  // Determine status
  let status: 'planning' | 'in_progress' | 'target_reached';

  if (currentCorpus >= targetCorpus) {
    status = 'target_reached';
  } else if (currentDateObj >= sipStartDateObj) {
    status = 'in_progress';
  } else {
    status = 'planning';
  }

  return {
    percentage: parseFloat(percentage.toFixed(2)),
    remainingAmount,
    yearsUntilStart: parseFloat(yearsUntilStart.toFixed(2)),
    status,
  };
}
