import { describe, expect, it } from 'vitest';
import { initializeState } from '../../types/state';
import { summarizeOtherHoldings, totalNetWorth } from './kpis';

describe('Other Holdings KPI calculations', () => {
  it('includes holding values and calculates value-weighted annual return', () => {
    const state = initializeState();
    state.otherHoldings = {
      gold: { name: 'Gold', amount: 100000, annualReturn: 8 },
      rental: { name: 'Rental Property', amount: 300000, annualReturn: 6 },
    };

    expect(summarizeOtherHoldings(state)).toEqual({
      totalValue: 400000,
      weightedAnnualReturn: 6.5,
    });
    expect(totalNetWorth(state).netWorth).toBe(400000);
    expect(totalNetWorth(state).breakdown.otherHoldings).toBe(400000);
  });

  it('handles missing or empty holdings safely', () => {
    const state = initializeState();
    state.otherHoldings = {};

    expect(summarizeOtherHoldings(state)).toEqual({ totalValue: 0, weightedAnnualReturn: 0 });
    expect(totalNetWorth(state).breakdown.otherHoldings).toBe(0);
  });
});