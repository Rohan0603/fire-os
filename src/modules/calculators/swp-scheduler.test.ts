import { describe, expect, it } from 'vitest';
import { generateSWPSchedule, getSWPWithdrawalDates, executeMonthlyWithdrawal } from './swp-scheduler';

describe('SWP month transition', () => {
  it('produces consecutive first-of-month dates across the December/January boundary', () => {
    expect(getSWPWithdrawalDates('2024-12').slice(0, 3)).toEqual([
      '2024-12-01',
      '2025-01-01',
      '2025-02-01',
    ]);
  });

  it('stores the configured start month and enables the schedule', () => {
    const state = { swpSchedule: { enabled: false, startDate: '', monthlyAmount: 1000, rate: 3 } };

    generateSWPSchedule(state, '2024-12');

    expect(state.swpSchedule.enabled).toBe(true);
    expect(state.swpSchedule.startDate).toBe('2024-12');
  });

  it('rejects malformed start months', () => {
    expect(() => getSWPWithdrawalDates('2024-13')).toThrow(RangeError);
    expect(() => getSWPWithdrawalDates('2024-1')).toThrow(RangeError);

    const state = { swpSchedule: { enabled: false, startDate: '', monthlyAmount: 1000, rate: 3 } };
    expect(() => generateSWPSchedule(state, '2024-13')).toThrow(RangeError);
  });
});

describe('executeMonthlyWithdrawal', () => {
  it('records only the actual redeemed amount when holdings cover the target', async () => {
    const state: any = {
      swpSchedule: { enabled: true, startDate: '2024-12', monthlyAmount: 1000, rate: 3 },
      sip: {
        sip1: { name: 'Large Cap Fund', schemeCode: '122639', units: 10, monthlyAmount: 500 },
      },
      mf: {},
      nav: { 122639: { nav: 100 } },
      expenses: [],
    };

    const { actualAmount } = await executeMonthlyWithdrawal(state);

    expect(actualAmount).toBe(1000); // 10 units * 100 NAV
    expect(state.sip.sip1.units).toBe(0);
    expect(state.expenses[0]).toEqual({
      date: expect.any(String),
      category: 'SWP',
      amount: 1000,
      linkedToSWP: true,
    });
  });

  it('records reduced amount and does not over-redeem when holdings are short', async () => {
    const state: any = {
      swpSchedule: { enabled: true, startDate: '2024-12', monthlyAmount: 5000, rate: 3 },
      sip: {
        sip1: { name: 'Large Cap Fund', schemeCode: '122639', units: 5, monthlyAmount: 500 },
      },
      mf: {},
      nav: { 122639: { nav: 100 } },
      expenses: [],
    };

    const { actualAmount } = await executeMonthlyWithdrawal(state);

    expect(actualAmount).toBe(500); // 5 units * 100 NAV
    expect(state.sip.sip1.units).toBe(0); // all units redeemed
    expect(state.expenses[0]).toEqual({
      date: expect.any(String),
      category: 'SWP',
      amount: 500,
      linkedToSWP: true,
    });
  });

  it('returns without mutating when SWP is disabled', async () => {
    const state: any = {
      swpSchedule: { enabled: false, monthlyAmount: 1000, rate: 3 },
      sip: { sip1: { name: 'X', units: 10, monthlyAmount: 500 } },
      nav: {},
      expenses: [],
    };
    const copy = JSON.stringify(state);

    const res = await executeMonthlyWithdrawal(state);

    expect(res.actualAmount).toBe(0);
    expect(JSON.stringify(state)).toBe(copy);
    expect(state.expenses).toHaveLength(0);
  });
});
