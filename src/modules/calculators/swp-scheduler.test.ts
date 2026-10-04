import { describe, expect, it } from 'vitest';
import { generateSWPSchedule, getSWPWithdrawalDates } from './swp-scheduler';

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
