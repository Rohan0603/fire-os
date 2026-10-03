import { describe, expect, it } from 'vitest';
import { initializeState } from '../types/state';
import { profileCompletenessPercent } from './completeness';

describe('profile completeness', () => {
  it('uses the same score for profile and dashboard consumers', () => {
    const state = initializeState();
    expect(profileCompletenessPercent(state)).toBe(0);

    state.profile.name = 'Investor';
    state.profile.dateOfBirth = '1990-01-01';
    state.profile.annualExpenses = 100000;
    state.profile.fiTarget = 10000000;
    state.profile.monthlyIncome = 200000;
    state.sip.sip1 = { name: 'Fund', units: 10, startDate: '2026-01-01', monthlyAmount: 10000 };
    expect(profileCompletenessPercent(state)).toBe(86);
  });
});
