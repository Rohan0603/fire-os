import { describe, expect, it } from 'vitest';
import { calculateXirr } from './calculations';

describe('calculateXirr', () => {
  it('matches a known annualized result for irregular dated flows', () => {
    const rate = calculateXirr([
      { date: new Date('2016-01-15'), amount: -1000 },
      { date: new Date('2016-02-08'), amount: -2500 },
      { date: new Date('2016-04-17'), amount: -1000 },
      { date: new Date('2016-08-24'), amount: 5050 },
    ]);

    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(0.2504, 4);
  });

  it('annualizes a sub-year irregular interval', () => {
    const rate = calculateXirr([
      { date: new Date('2024-01-01'), amount: -1000 },
      { date: new Date('2024-07-01'), amount: 1050 },
    ]);

    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(0.1028, 3);
  });

  it('returns null for same-sign flows', () => {
    expect(
      calculateXirr([
        { date: new Date('2024-01-01'), amount: 1000 },
        { date: new Date('2025-01-01'), amount: 1100 },
      ]),
    ).toBeNull();
    expect(
      calculateXirr([
        { date: new Date('2024-01-01'), amount: -1000 },
        { date: new Date('2025-01-01'), amount: -1100 },
      ]),
    ).toBeNull();
  });

  it('returns null when a positive or negative flow is missing', () => {
    expect(
      calculateXirr([
        { date: new Date('2024-01-01'), amount: -1000 },
        { date: new Date('2025-01-01'), amount: 0 },
      ]),
    ).toBeNull();
    expect(
      calculateXirr([
        { date: new Date('2024-01-01'), amount: 1000 },
        { date: new Date('2025-01-01'), amount: 0 },
      ]),
    ).toBeNull();
  });

  it('returns null for invalid dates or non-finite amounts', () => {
    expect(
      calculateXirr([
        { date: new Date('not-a-date'), amount: -1000 },
        { date: new Date('2025-01-01'), amount: 1100 },
      ]),
    ).toBeNull();
    expect(
      calculateXirr([
        { date: new Date('2024-01-01'), amount: -1000 },
        { date: new Date('2025-01-01'), amount: NaN },
      ]),
    ).toBeNull();
    expect(
      calculateXirr([
        { date: new Date('2024-01-01'), amount: -1000 },
        { date: new Date('2025-01-01'), amount: Infinity },
      ]),
    ).toBeNull();
  });

  it('drops invalid flows but still computes when two valid flows remain', () => {
    const rate = calculateXirr([
      { date: new Date('not-a-date'), amount: -500 },
      { date: new Date('2024-01-01'), amount: -1000 },
      { date: new Date('2025-01-01'), amount: 1100 },
    ]);

    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(0.0997, 4);
  });

  it('returns null when all flows fall on the same day', () => {
    expect(
      calculateXirr([
        { date: new Date('2024-01-01'), amount: -1000 },
        { date: new Date('2024-01-01T12:00:00Z'), amount: 1100 },
      ]),
    ).toBeNull();
  });

  it('returns null for fewer than two flows', () => {
    expect(calculateXirr([])).toBeNull();
    expect(calculateXirr([{ date: new Date('2024-01-01'), amount: -1000 }])).toBeNull();
  });

  it('returns null instead of throwing when the rate cannot be converged', () => {
    expect(
      calculateXirr([
        { date: new Date('2024-01-01'), amount: -1000 },
        { date: new Date('2024-01-02'), amount: 1 },
      ]),
    ).toBeNull();
  });

  it('does not throw on multiple-root inputs and returns a valid root', () => {
    const rate = calculateXirr([
      { date: new Date('2024-06-01'), amount: -1000 },
      { date: new Date('2025-06-01'), amount: 3000 },
      { date: new Date('2026-06-01'), amount: -2100 },
    ]);

    expect(rate === null || Math.abs(rate - 0.1127) < 5e-3 || Math.abs(rate - 0.8873) < 5e-3).toBe(
      true,
    );
  });

  it('does not depend on input order', () => {
    const flows = [
      { date: new Date('2016-01-15'), amount: -1000 },
      { date: new Date('2016-02-08'), amount: -2500 },
      { date: new Date('2016-04-17'), amount: -1000 },
      { date: new Date('2016-08-24'), amount: 5050 },
    ];

    const forward = calculateXirr(flows);
    const reversed = calculateXirr([...flows].reverse());

    expect(forward).not.toBeNull();
    expect(reversed).not.toBeNull();
    expect(reversed!).toBeCloseTo(forward!, 3);
  });
});
