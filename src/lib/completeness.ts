import type { FireOSState } from '../types/state';

export function profileCompletenessPercent(state: FireOSState): number {
  const checks = [
    Boolean(state.profile.name.trim()),
    Boolean(state.profile.dateOfBirth),
    state.profile.annualExpenses > 0,
    state.profile.fiTarget > 0,
    state.profile.monthlyIncome > 0,
    Object.keys(state.sip).length > 0 || Object.keys(state.mf).length > 0,
    Object.keys(state.demat).length > 0 || Object.keys(state.otherHoldings).length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
