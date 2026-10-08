import { describe, expect, it } from 'vitest';
import {
  applyPersistedState,
  HISTORY_CACHE_MAX_ENTRIES,
  initializeState,
  isPersistedPortfolioData,
  normalizePersistedState,
  PERSISTED_STATE_KEYS,
  persistedPortfolioSchema,
} from './state';

describe('persisted portfolio validation and normalization', () => {
  it('accepts partial legacy payloads and fills newer sections with defaults', () => {
    const legacy = {
      profile: {
        name: 'Legacy user',
        age: 35,
        annualExpenses: 80000,
        fiTarget: 24000000,
        monthlyIncome: 150000,
      },
      sip: {},
    };

    expect(isPersistedPortfolioData(legacy)).toBe(true);
    const normalized = normalizePersistedState(legacy);

    expect(normalized?.profile).toMatchObject({
      name: 'Legacy user',
      age: 35,
      taxSlabRate: 30,
    });
    expect(normalized?.insurance).toEqual(initializeState().insurance);
    expect(normalized?.esopDetails).toEqual(initializeState().esopDetails);
  });

  it('rejects unknown keys, non-finite amounts, and malformed nested records', () => {
    expect(isPersistedPortfolioData({ unexpected: true })).toBe(false);
    expect(isPersistedPortfolioData({ profile: { ...initializeState().profile, age: Infinity } })).toBe(false);
    expect(isPersistedPortfolioData({ liabilities: { loan: { name: 'Loan', amount: 'large' } } })).toBe(false);
    expect(normalizePersistedState({ profile: { name: 7 } })).toBeNull();
  });

  it('does not mutate the supplied legacy payload while normalizing', () => {
    const legacy = { profile: { name: 'Account holder', age: 30 } };
    const snapshot = JSON.parse(JSON.stringify(legacy));

    normalizePersistedState(legacy);

    expect(legacy).toEqual(snapshot);
  });

  it('rejects unknown nested keys and non-finite values through the schema', () => {
    expect(persistedPortfolioSchema.safeParse({ profile: { ...initializeState().profile, unexpected: true } }).success).toBe(false);
    expect(persistedPortfolioSchema.safeParse({ nav: { '123': { schemeCode: '123', nav: Number.NaN, timestamp: new Date().toISOString(), ttl: 1 } } }).success).toBe(false);
  });

  it('keeps the schema allowlist aligned and excludes runtime-only state', () => {
    expect(Object.keys(persistedPortfolioSchema.shape).sort()).toEqual([...PERSISTED_STATE_KEYS].sort());
    expect(isPersistedPortfolioData({ currentUser: null })).toBe(false);
    expect(isPersistedPortfolioData({ _lastSavedAt: new Date().toISOString() })).toBe(false);
    expect(isPersistedPortfolioData({ _syncMetadata: { isDirty: false } })).toBe(false);
  });

  it('rejects explicitly undefined persisted values while accepting omitted optional fields', () => {
    expect(isPersistedPortfolioData({ eurInr: undefined })).toBe(false);
    expect(isPersistedPortfolioData({ currencyRates: { EURINR: {
      rate: 1, timestamp: new Date().toISOString(), source: undefined,
    } } })).toBe(false);
    expect(isPersistedPortfolioData({})).toBe(true);
  });

  it('rejects more than 50 liabilities through the schema', () => {
    const liabilities = Object.fromEntries(Array.from({ length: 51 }, (_, index) => [`loan-${index}`, { name: 'Loan', amount: 1 }]));
    expect(persistedPortfolioSchema.safeParse({ liabilities }).success).toBe(false);
  });

  it('accepts optional legacy fields and normalized partial data through the schema', () => {
    const legacy = { profile: { name: 'Legacy', age: 35, annualExpenses: 80000, fiTarget: 24000000, monthlyIncome: 150000 } };

    expect(persistedPortfolioSchema.safeParse(legacy).success).toBe(true);
    expect(isPersistedPortfolioData(legacy)).toBe(true);
    expect(normalizePersistedState(legacy)).toMatchObject({
      profile: { name: 'Legacy', taxSlabRate: 30 },
      insurance: initializeState().insurance,
      esopDetails: initializeState().esopDetails,
    });
  });
});

describe('persisted market history cache', () => {
  const validHistory = {
    nifty: {
      points: [{ date: '2026-10-01', value: 25000 }],
      source: 'Yahoo Finance API (corsproxy)',
      fetchedAt: '2026-10-03T10:00:00.000Z',
      status: 'live',
    },
  };
  const validProfile = {
    name: 'Ada',
    age: 35,
    annualExpenses: 80000,
    fiTarget: 24000000,
    monthlyIncome: 150000,
  };

  function parseWithHistory(mutate: (history: any) => void): boolean {
    const history = JSON.parse(JSON.stringify(validHistory));
    mutate(history);
    return persistedPortfolioSchema.safeParse({ marketHistory: history }).success;
  }

  it('accepts typed history entries and rejects malformed shapes', () => {
    expect(persistedPortfolioSchema.safeParse({ marketHistory: validHistory }).success).toBe(true);
    expect(isPersistedPortfolioData({ marketHistory: validHistory })).toBe(true);

    expect(parseWithHistory((history) => { history.nifty.points[0].value = 0; })).toBe(false);
    expect(parseWithHistory((history) => { history.nifty.points[0].value = '25000'; })).toBe(false);
    expect(parseWithHistory((history) => { history.nifty.points[0].date = '10-01-2026'; })).toBe(false);
    expect(parseWithHistory((history) => { history.nifty.points = 'nope'; })).toBe(false);
    expect(parseWithHistory((history) => { history.nifty.fetchedAt = 'not-a-date'; })).toBe(false);
    expect(parseWithHistory((history) => { history.nifty.status = 'fresh'; })).toBe(false);
    expect(parseWithHistory((history) => { history.nifty.unexpected = true; })).toBe(false);
  });

  it('rejects more than HISTORY_CACHE_MAX_ENTRIES cached series', () => {
    const tooMany = Object.fromEntries(
      Array.from({ length: HISTORY_CACHE_MAX_ENTRIES + 1 }, (_, index) => [`nav:${index}`, validHistory.nifty]),
    );
    expect(persistedPortfolioSchema.safeParse({ marketHistory: tooMany }).success).toBe(false);
  });

  it('defaults market history and safely discards malformed persisted history', () => {
    expect(initializeState().marketHistory).toEqual({});
    expect(isPersistedPortfolioData({ marketHistory: { nifty: { points: 'nope' } } })).toBe(false);

    const discarded = normalizePersistedState({
      profile: validProfile,
      marketHistory: { nifty: { points: 'nope' } },
    });
    expect(discarded?.profile.name).toBe('Ada');
    expect(discarded?.marketHistory).toEqual({});

    const retained = normalizePersistedState({
      profile: validProfile,
      marketHistory: validHistory,
    });
    expect(retained?.marketHistory).toEqual(validHistory);
  });

  it('applyPersistedState adopts history that Object.assign would drop', () => {
    const source = initializeState();
    source.profile.name = 'Ada';
    source.marketHistory = validHistory as never;

    const target = initializeState();
    applyPersistedState(target, source);

    expect(target.profile.name).toBe('Ada');
    expect(target.marketHistory).toEqual(validHistory);
    // The field must stay invisible to JSON/spread consumers.
    expect(Object.keys(target)).not.toContain('marketHistory');
    expect(JSON.stringify(target)).not.toContain('marketHistory');
    expect({ ...target }).not.toHaveProperty('marketHistory');

    // Plain Object.assign (the pre-fix handoff) loses it:
    const dropped = initializeState();
    Object.assign(dropped, source);
    expect(dropped.marketHistory).toEqual({});
  });
});
