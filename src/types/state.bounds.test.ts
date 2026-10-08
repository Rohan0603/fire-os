import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { HISTORY_CACHE_MAX_ENTRIES, initializeState, persistedPortfolioSchema } from './state';

/**
 * Characterization tests for the persisted-portfolio schema's bounds.
 *
 * These pin behaviour that a mechanical valibot -> Zod rewrite would most
 * plausibly break: numeric ranges, string limits, and collection caps. They
 * assert accept/reject outcomes only, never error shapes, so they stay valid
 * across the library swap.
 *
 * The explicitly-undefined behaviour of `exactOptional` is pinned separately in
 * state.test.ts, along with strict-mode unknown-key rejection.
 */
const parses = (payload: unknown): boolean =>
  v.safeParse(persistedPortfolioSchema, payload).success;

describe('persisted schema bounds', () => {
  it('accepts a liability name at the 100 character limit and rejects 101', () => {
    const atLimit = 'L'.repeat(100);
    const overLimit = 'L'.repeat(101);

    expect(parses({ liabilities: { loan: { name: atLimit, amount: 1 } } })).toBe(true);
    expect(parses({ liabilities: { loan: { name: overLimit, amount: 1 } } })).toBe(false);
  });

  it('rejects negative liability amounts and accepts zero', () => {
    expect(parses({ liabilities: { loan: { name: 'Loan', amount: 0 } } })).toBe(true);
    expect(parses({ liabilities: { loan: { name: 'Loan', amount: -1 } } })).toBe(false);
  });

  it('accepts exactly 50 liabilities and rejects 51', () => {
    const build = (count: number) =>
      Object.fromEntries(
        Array.from({ length: count }, (_, index) => [`loan-${index}`, { name: 'Loan', amount: 1 }]),
      );

    expect(parses({ liabilities: build(50) })).toBe(true);
    expect(parses({ liabilities: build(51) })).toBe(false);
  });

  it('constrains other holdings to a non-negative amount and 0-100% annual return', () => {
    expect(parses({ otherHoldings: { gold: { name: 'Gold', amount: 0, annualReturn: 0 } } })).toBe(true);
    expect(parses({ otherHoldings: { gold: { name: 'Gold', amount: 0, annualReturn: 100 } } })).toBe(true);
    expect(parses({ otherHoldings: { gold: { name: 'Gold', amount: -1, annualReturn: 5 } } })).toBe(false);
    expect(parses({ otherHoldings: { gold: { name: 'Gold', amount: 1, annualReturn: 101 } } })).toBe(false);
    expect(parses({ otherHoldings: { gold: { name: 'Gold', amount: 1, annualReturn: -1 } } })).toBe(false);
  });

  it('rejects an empty other-holding name', () => {
    expect(parses({ otherHoldings: { gold: { name: '   ', amount: 1, annualReturn: 5 } } })).toBe(false);
  });

  it('accepts exactly 20 ESOP holdings and rejects 21', () => {
    const holding = { name: 'Acme', symbol: 'ACME', quantity: 1, currency: 'INR' };
    const build = (count: number) => Array.from({ length: count }, () => holding);

    const base = { ...initializeState().esopDetails, holdings: build(20) };
    expect(parses({ esopDetails: base })).toBe(true);

    expect(parses({ esopDetails: { ...base, holdings: build(21) } })).toBe(false);
  });

  it('accepts market history at the entry cap and rejects one beyond it', () => {
    const series = {
      points: [{ date: '2026-10-01', value: 25000 }],
      source: 'test',
      fetchedAt: '2026-10-03T10:00:00.000Z',
      status: 'live',
    };
    const build = (count: number) =>
      Object.fromEntries(Array.from({ length: count }, (_, index) => [`key-${index}`, series]));

    expect(parses({ marketHistory: build(HISTORY_CACHE_MAX_ENTRIES) })).toBe(true);
    expect(parses({ marketHistory: build(HISTORY_CACHE_MAX_ENTRIES + 1) })).toBe(false);
  });

  it('rejects a malformed market-history status', () => {
    const now = new Date().toISOString();
    expect(
      parses({
        marketHistory: {
          nifty: { points: [{ date: '2026-10-01', value: 1 }], source: 's', fetchedAt: now, status: 'bogus' },
        },
      }),
    ).toBe(false);
  });

  it('rejects a non-numeric date in a market-history point', () => {
    const now = new Date().toISOString();
    expect(
      parses({
        marketHistory: {
          nifty: { points: [{ date: 20261001, value: 1 }], source: 's', fetchedAt: now, status: 'live' },
        },
      }),
    ).toBe(false);
  });

  it('accepts a complete initialized-state profile', () => {
    expect(parses({ profile: initializeState().profile })).toBe(true);
  });
});