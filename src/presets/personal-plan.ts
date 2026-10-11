/**
 * Personal plan preset (not shipped in the general app).
 *
 * This directory is excluded from `scripts/check-personal-identifiers.mjs`, so a
 * deployment can keep its own goal names, amounts, and milestones here without
 * leaking them into the default state/config modules. Wire a preset in per
 * deployment (apply `goals` and `liquidationRules` onto the loaded state); the
 * app itself only reads the general state shape.
 */

import type { Goal, LiquidationRule } from '../types/state';

export interface PersonalPlanPreset {
  goals: Goal[];
  liquidationRules: LiquidationRule[];
}

export const personalPlanPreset: PersonalPlanPreset = {
  goals: [
    {
      id: 'goal-home',
      name: 'Coorg Home',
      kind: 'home',
      targetToday: 20000000,
      targetDate: '2031-01',
      inflation: 'cpi',
      linkedAssetIds: [],
      currentAmount: 0,
      monthlyContribution: 10000,
      priority: 1,
      riskBucket: 'medium',
    },
  ],
  liquidationRules: [
    { id: 'marriage', kind: 'marriage', label: 'Marriage Plan', active: false },
    { id: 'childBirth', kind: 'childBirth', label: 'Child Birth', active: false },
    { id: 'jobChange', kind: 'jobChange', label: 'Employment Change', active: false },
    {
      id: 'goal-home',
      kind: 'goal',
      label: 'Coorg Construction',
      active: false,
      goalId: 'goal-home',
      allocateAmount: 500000,
      note: 'Allocate up to ₹5L of ESOP proceeds to the home goal.',
    },
  ],
};

/** Return a mutable deep copy so callers never mutate the shared preset. */
export function loadPersonalPlanPreset(): PersonalPlanPreset {
  return JSON.parse(JSON.stringify(personalPlanPreset)) as PersonalPlanPreset;
}
