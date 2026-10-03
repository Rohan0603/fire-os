import { describe, expect, it } from 'vitest';
import {
  initializeState,
  isPersistedPortfolioData,
  normalizePersistedState,
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
});
