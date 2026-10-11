/**
 * Example plan preset (generic, non-identifying sample data only).
 *
 * `presets/` is excluded from `scripts/check-personal-identifiers.mjs` on the
 * understanding that it holds only generic sample templates — like this one —
 * that demonstrate the `goals` / `liquidationRules` shape. Every value here is
 * fictitious: round illustrative amounts, a placeholder date, and generic
 * labels. Real personal plans belong in the user's own imported account state;
 * they must never be committed to this public repository, even inside
 * `presets/`. Wire a preset in per deployment (apply `goals` and
 * `liquidationRules` onto the loaded state); the app itself only reads the
 * general state shape.
 */

import type { Goal, LiquidationRule } from '../types/state';

export interface PersonalPlanPreset {
  goals: Goal[];
  liquidationRules: LiquidationRule[];
}

export const personalPlanPreset: PersonalPlanPreset = {
  goals: [
    {
      id: 'goal-sample',
      name: 'Sample Home',
      kind: 'home',
      targetToday: 10000000,
      targetDate: '2030-06',
      inflation: 'cpi',
      linkedAssetIds: [],
      currentAmount: 0,
      monthlyContribution: 5000,
      priority: 1,
      riskBucket: 'medium',
    },
  ],
  liquidationRules: [
    { id: 'marriage', kind: 'marriage', label: 'Marriage Plan', active: false },
    { id: 'childBirth', kind: 'childBirth', label: 'Child Birth', active: false },
    { id: 'jobChange', kind: 'jobChange', label: 'Employment Change', active: false },
    {
      id: 'goal-sample',
      kind: 'goal',
      label: 'Sample Goal Allocation',
      active: false,
      goalId: 'goal-sample',
      allocateAmount: 200000,
      note: 'Allocate up to 200000 of ESOP proceeds to the sample goal.',
    },
  ],
};

/** Return a mutable deep copy so callers never mutate the shared preset. */
export function loadPersonalPlanPreset(): PersonalPlanPreset {
  return JSON.parse(JSON.stringify(personalPlanPreset)) as PersonalPlanPreset;
}