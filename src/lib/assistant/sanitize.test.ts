import { describe, expect, it } from 'vitest';
import { bucketBalance, buildContextSummary, redactPII } from './sanitize';
import { initializeState } from '../../types/state';

describe('bucketBalance', () => {
  it('maps amounts to the documented ranges', () => {
    expect(bucketBalance(0)).toBe('<1L');
    expect(bucketBalance(99999)).toBe('<1L');
    expect(bucketBalance(100000)).toBe('1–5L');
    expect(bucketBalance(499999)).toBe('1–5L');
    expect(bucketBalance(500000)).toBe('5–25L');
    expect(bucketBalance(2499999)).toBe('5–25L');
    expect(bucketBalance(2500000)).toBe('25L–1Cr');
    expect(bucketBalance(9999999)).toBe('25L–1Cr');
    expect(bucketBalance(10000000)).toBe('1Cr+');
    expect(bucketBalance(100000000)).toBe('1Cr+');
  });
});

describe('buildContextSummary', () => {
  it('redacts identity: no name, email, uid, or DOB in default context', () => {
    const state = initializeState();
    state.profile.name = 'Jane Doe';
    state.profile.dateOfBirth = '1990-05-15';
    state.profile.age = 35;
    state.mf = {
      mf1: {
        name: 'Parag Parikh Flexi',
        schemeCode: '122639',
        units: 100,
        startDate: '2020-01-01',
        monthlyAmount: 5000,
        costBasis: 100000,
      },
    };

    const ctx = buildContextSummary(state, false);
    const serialized = JSON.stringify(ctx);

    expect(ctx.userLabel).toBe('User');
    expect(serialized).not.toContain('Jane Doe');
    expect(serialized).not.toContain('1990-05-15');
    expect(serialized).not.toContain('dateOfBirth');
    expect(serialized).not.toMatch(/@[a-z]+\./i);
    expect(serialized).not.toContain('122639');
    expect(ctx.ageBand).toBe('30s');
  });

  it('never includes exact balances when sendExact is false', () => {
    const state = initializeState();
    state.fd = { fd1: { amount: 5555555, currency: 'INR' } };

    const ctx = buildContextSummary(state, false);
    const serialized = JSON.stringify(ctx);

    expect(ctx.sendExact).toBe(false);
    expect(ctx.exact).toBeUndefined();
    expect(serialized).not.toContain('5555555');
    expect(ctx.holdingsSummary.fd?.count).toBe(1);
    expect(ctx.holdingsSummary.fd?.totalRange).toBe('25L–1Cr');
  });

  it('includes exact block only when sendExact is true', () => {
    const state = initializeState();
    state.fd = { fd1: { amount: 750000, currency: 'INR' } };
    state.sip = {
      sip1: { name: 'Fund 1', units: 100, startDate: '2024-01', monthlyAmount: 12000 },
      sip2: { name: 'Fund 2', units: 50, startDate: '2024-01', monthlyAmount: 18000 },
    };

    const ctx = buildContextSummary(state, true);
    expect(ctx.sendExact).toBe(true);
    expect(ctx.exact?.holdings.fd).toBe(750000);
    expect(ctx.exact?.fiTarget).toBe(state.profile.fiTarget);
    expect(ctx.exact?.netWorth).toBe(750000);
    expect(ctx.exact?.monthlySipContribution).toBe(30000);
    expect(ctx.netWorthRange).toBe('5–25L');
  });

  it('summarizes demat holdings via currentValue', () => {
    const state = initializeState();
    state.demat = {
      d1: { isin: 'INE000A01036', quantity: 10, currentValue: 300000, name: 'Reliance' },
      d2: { isin: 'INE000B01026', quantity: 5, currentValue: 100000, name: 'TCS' },
    };

    const ctx = buildContextSummary(state, false);
    expect(ctx.holdingsSummary.demat).toEqual({ count: 2, totalRange: '1–5L' });
    expect(JSON.stringify(ctx)).not.toContain('INE000A01036');
    expect(JSON.stringify(ctx)).not.toContain('Reliance');
  });

  it('omits NAV cache, currency rates, and expense records', () => {
    const state = initializeState();
    state.nav = { '122639': { schemeCode: '122639', nav: 50, timestamp: '2026-01-01', ttl: 1000 } };
    state.expenses = [{ date: '2026-01-01', category: 'Food', amount: 500, linkedToSWP: false }];

    const ctx = buildContextSummary(state, false);
    const serialized = JSON.stringify(ctx);
    expect(serialized).not.toContain('122639');
    expect(serialized).not.toContain('Food');
    expect(serialized).not.toContain('"nav"');
    expect(serialized).not.toContain('"ttl"');
  });

  it('keeps tax slab and FI target metadata available for advice', () => {
    const state = initializeState();
    state.profile.taxSlabRate = 30;
    state.profile.fiTarget = 55000000;

    const ctx = buildContextSummary(state, false);
    expect(ctx.taxSlabRate).toBe(30);
    expect(ctx.fiTargetRange).toBe('1Cr+');
    expect(ctx.profileMasked.fiTarget).toBe('1Cr+');
  });

  it('includes Nifty level, 52-week high, drawdown, and freshness metadata', () => {
    const state = initializeState();
    const timestamp = new Date().toISOString();
    state.niftyData = {
      level: 24000,
      high52w: 25000,
      timestamp,
      source: 'Yahoo Finance',
      status: 'live',
    };

    const ctx = buildContextSummary(state);
    expect(ctx.nifty50).toMatchObject({
      level: 24000,
      high52w: 25000,
      drawdownPercent: 4,
      asOf: timestamp,
      freshness: 'fresh',
      source: 'Yahoo Finance',
      status: 'live',
    });
  });

  it('marks old Nifty data stale and omits invalid market data', () => {
    const state = initializeState();
    state.niftyData = {
      level: 24000,
      high52w: 25000,
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      source: 'Yahoo Finance',
      status: 'cache-fresh',
    };
    expect(buildContextSummary(state).nifty50?.freshness).toBe('stale');

    state.niftyData.timestamp = 'not-a-timestamp';
    expect(buildContextSummary(state).nifty50).toBeNull();
  });
});

describe('redactPII', () => {
  it('redacts emails and uid tokens', () => {
    expect(redactPII('contact jane@example.com now')).toBe('contact [email] now');
    expect(redactPII('uid: abc123 leaked')).toBe('uid=[redacted] leaked');
    expect(redactPII('uid=xyz456')).toBe('uid=[redacted]');
  });

  it('leaves ordinary text untouched', () => {
    expect(redactPII('my portfolio is balanced')).toBe('my portfolio is balanced');
  });
});
