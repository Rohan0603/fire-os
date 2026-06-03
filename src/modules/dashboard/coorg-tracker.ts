/**
 * Coorg Goal Tracker Module
 * Tracks progress toward ₹2Cr Coorg property goal by 2036
 */

import type { FireOSState } from '../../types/state';

export interface CoorgTrackerParams {
  currentCorpus: number; // Current Coorg corpus in ₹
  targetCorpus: number; // Target corpus (₹2Cr = 20000000)
  currentDate: string; // YYYY-MM-DD format
  sipStartDate: string; // YYYY-MM format
}

export interface CoorgProgress {
  percentage: number; // % of target reached (0-100)
  remainingAmount: number; // Amount needed to reach target
  yearsUntilStart: number; // Years until SIP starts
  status: "planning" | "in_progress" | "target_reached";
}

/**
 * Calculate Coorg goal progress
 * @param params - Coorg tracker parameters
 * @returns Coorg progress data
 * @throws {Error} if targetCorpus <= 0, currentCorpus < 0, or date format is invalid
 */
export function calculateCoorgProgress(params: CoorgTrackerParams): CoorgProgress {
  const { currentCorpus, targetCorpus, currentDate, sipStartDate } = params;

  // Input validation
  if (targetCorpus <= 0) {
    throw new Error("Target corpus must be > 0");
  }
  if (currentCorpus < 0) {
    throw new Error("Current corpus cannot be negative");
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(currentDate)) {
    throw new Error("Current date must be in YYYY-MM-DD format");
  }

  // Validate SIP start date format (YYYY-MM)
  const sipDateRegex = /^\d{4}-\d{2}$/;
  if (!sipDateRegex.test(sipStartDate)) {
    throw new Error("SIP start date must be in YYYY-MM format");
  }

  // Calculate percentage
  const percentage = (currentCorpus / targetCorpus) * 100;

  // Calculate remaining amount
  const remainingAmount = targetCorpus - currentCorpus;

  // Calculate years until SIP start
  const currentDateObj = new Date(currentDate);
  const sipStartYear = parseInt(sipStartDate.split("-")[0], 10);
  const sipStartMonth = parseInt(sipStartDate.split("-")[1], 10);
  const sipStartDateObj = new Date(sipStartYear, sipStartMonth - 1, 1);

  const monthsDiff =
    (sipStartDateObj.getFullYear() - currentDateObj.getFullYear()) * 12 +
    (sipStartDateObj.getMonth() - currentDateObj.getMonth());

  const yearsUntilStart = monthsDiff / 12;

  // Determine status
  let status: "planning" | "in_progress" | "target_reached";

  if (currentCorpus >= targetCorpus) {
    status = "target_reached";
  } else if (currentDateObj >= sipStartDateObj) {
    status = "in_progress";
  } else {
    status = "planning";
  }

  return {
    percentage: parseFloat(percentage.toFixed(2)),
    remainingAmount,
    yearsUntilStart: parseFloat(yearsUntilStart.toFixed(2)),
    status,
  };
}

/**
 * Render Coorg goal tracker widget HTML
 * @param D - Application state object with Coorg fields
 * @returns HTML string for the widget
 */
export function renderCoorgWidget(D: Pick<FireOSState, 'coorgCorpus' | 'coorgTarget' | 'coorgStartDate'>): string {
  const params: CoorgTrackerParams = {
    currentCorpus: D.coorgCorpus || 0,
    targetCorpus: D.coorgTarget || 20000000,
    currentDate: new Date().toISOString().split("T")[0],
    sipStartDate: D.coorgStartDate || "2031-01",
  };

  const progress = calculateCoorgProgress(params);

  // Format currency in Lac (₹ 1 Lac = 100,000)
  // Explicitly check corpus > 0 for clarity
  const corpusInLac = params.currentCorpus > 0 ? (params.currentCorpus / 100000).toFixed(1) : "0.0";

  // Format target in Cr (₹ 1 Cr = 10,000,000)
  const targetInCr = (D.coorgTarget / 10000000).toFixed(1);

  // Generate status message
  let statusMessage = "";
  if (progress.status === "planning") {
    statusMessage = `SIP starts in ${progress.yearsUntilStart} years`;
  } else if (progress.status === "in_progress") {
    statusMessage = "SIP in progress";
  } else {
    statusMessage = "Target reached! ✓";
  }

  // Generate progress bar HTML
  const progressBarWidth = Math.min(progress.percentage, 100);

  return `
    <div class="coorg-widget">
      <div class="coorg-header">
        <h3 class="coorg-title">Coorg Goal (₹${targetInCr}Cr by 2036)</h3>
      </div>
      <div class="coorg-progress-container">
        <div class="coorg-progress-bar-bg">
          <div class="coorg-progress-bar-fill" style="width: ${progressBarWidth}%"></div>
        </div>
      </div>
      <div class="coorg-status">
        <span class="coorg-current">Current: ₹${corpusInLac}L / ₹${targetInCr}Cr (${progress.percentage}%)</span>
      </div>
      <div class="coorg-timeline">
        <span class="coorg-message">${statusMessage}</span>
      </div>
    </div>
  `;
}
