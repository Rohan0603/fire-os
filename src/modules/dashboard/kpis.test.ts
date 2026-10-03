import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeState } from '../../types/state';
import { attributeNetWorthChange, esopConcentration, sipStatus, summarizeOtherHoldings, totalNetWorth } from './kpis';
import { calculateCoastFire } from '../calculators/scenario-modeler';
import { createFeaturePorts } from '../../core/feature-ports';
import { calculateXirr } from '../../lib/calculations';

afterEach(() => {
  vi.useRealTimers();
});

describe('XIRR calculations', () => {
  it('calculates annualized return from dated cash flows', () => {
    const xirr = calculateXirr([
      { date: new Date('2024-01-01'), amount: -1000 },
      { date: new Date('2025-01-01'), amount: 1100 },
    ]);

    expect(xirr).not.toBeNull();
    expect(xirr!).toBeCloseTo(0.0997, 4);
  });

  it('returns null when cash flows do not contain both signs', () => {
    expect(calculateXirr([
      { date: new Date('2024-01-01'), amount: 1000 },
      { date: new Date('2025-01-01'), amount: 1100 },
    ])).toBeNull();
  });

  it('exposes calculated XIRR through SIP status', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const state = initializeState();
    state.sip = {
      fund: {
        name: 'Test Fund',
        schemeCode: '123',
        units: 12,
        startDate: '2024-01',
        monthlyAmount: 1000,
      },
    };
    state.nav = {
      '123': { schemeCode: '123', nav: 1100, timestamp: '2025-01-01T00:00:00Z', ttl: 3600000 },
    };

    const result = sipStatus(state);

    expect(result.funds[0].xirr).not.toBeNull();
    expect(result.totalXIRR).toBe(result.funds[0].xirr);
  });
});

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

  it('does not count mirrored core holdings as other holdings', () => {
    const state = initializeState();
    state.fd = { fd1: { amount: 540000, currency: 'INR' } };
    state.epf = { epf1: { amount: 194000, currency: 'INR' } };
    state.bonds = { bonds1: { amount: 51270, currency: 'INR' } };
    state.otherHoldings = {
      otherHolding51: { name: 'Fixed Deposits', amount: 540000, annualReturn: 0 },
      otherHolding52: { name: 'EPF', amount: 194000, annualReturn: 0 },
      otherHolding53: { name: 'Bonds', amount: 51270, annualReturn: 0 },
      gold: { name: 'Gold', amount: 100000, annualReturn: 8 },
    };

    expect(totalNetWorth(state).breakdown.otherHoldings).toBe(100000);
    expect(totalNetWorth(state).assets).toBe(885270);
  });
});

describe('roadmap calculations', () => {
  it('exposes the canonical net-worth calculator through feature ports', () => {
    expect(createFeaturePorts().calculations.totalNetWorth).toBe(totalNetWorth);
  });

  it('attributes net-worth change between contributions and investment return', () => {
    expect(attributeNetWorthChange(100000, 130000, 20000)).toEqual({
      startingValue: 100000,
      contributions: 20000,
      investmentReturn: 10000,
      endingValue: 130000,
    });
  });

  it('calculates Coast FIRE age when growth alone reaches target', () => {
    const result = calculateCoastFire(1000000, 2000000, 0.1, 30, 40);
    expect(result.coastAge).toBe(30);
    expect(result.yearsToCoast).toBe(0);
  });

  it('calculates employer-equity concentration against assets', () => {
    const state = initializeState();
    state.esop = { employer: { amount: 250000, currency: 'INR' } };
    state.otherHoldings = { savings: { name: 'Savings', amount: 750000, annualReturn: 4 } };
    expect(esopConcentration(state)).toBe(0.25);
  });
});