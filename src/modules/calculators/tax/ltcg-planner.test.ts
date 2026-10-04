import { describe, expect, it } from 'vitest';
import { initializeState } from '../../../types/state';
import { calculateLTCGHarvestPlan } from './ltcg-planner';

describe('calculateLTCGHarvestPlan month boundaries', () => {
  it('does not mark units long-term at 12 inclusive months, but does at 13', () => {
    const state = initializeState();
    state.sip = {
      fund: {
        name: 'Test Fund',
        schemeCode: '123',
        units: 130,
        startDate: '2024-01',
        monthlyAmount: 100,
      },
    };
    state.nav = {
      '123': { schemeCode: '123', nav: 100, timestamp: '2025-01-01T00:00:00Z', ttl: 3600000 },
    };

    const at12Months = calculateLTCGHarvestPlan(state, new Date(2024, 11, 15));
    const at13Months = calculateLTCGHarvestPlan(state, new Date(2025, 0, 15));

    expect(at12Months.recommendations[0].longTermUnits).toBe(0);
    expect(at13Months.recommendations[0].longTermUnits).toBe(10);
  });

  it('rejects non-padded or impossible start months', () => {
    const state = initializeState();
    state.sip = {
      singleDigit: {
        name: 'Single Digit',
        schemeCode: '123',
        units: 130,
        startDate: '2024-1',
        monthlyAmount: 100,
      },
      impossible: {
        name: 'Impossible',
        schemeCode: '123',
        units: 130,
        startDate: '2024-13',
        monthlyAmount: 100,
      },
    };

    const plan = calculateLTCGHarvestPlan(state, new Date(2025, 0, 15));

    expect(plan.recommendations.map((r) => r.longTermUnits)).toEqual([0, 0]);
    expect(plan.totalInvested).toBe(0);
  });

  it('counts a full YYYY-MM-DD startDate from its month', () => {
    const state = initializeState();
    state.sip = {
      fund: {
        name: 'Test Fund',
        schemeCode: '123',
        units: 130,
        startDate: '2026-01-01',
        monthlyAmount: 100,
      },
    };

    const plan = calculateLTCGHarvestPlan(state, new Date(2026, 2, 15));

    expect(plan.totalInvested).toBe(300);
    expect(plan.recommendations[0].longTermUnits).toBe(0);
  });
});
