import { describe, expect, it } from 'vitest';
import { migratePersistedData, migratePortfolioEnvelope } from './portfolioMigrations';
import { buildEnvelopeFromState } from './merge';
import { initializeState, normalizePersistedState, persistedPortfolioSchema } from '../types/state';
import { isPortfolioEnvelope } from '../types/firebase';

const legacyV4Envelope = {
  schemaVersion: 'fireOS_v4',
  lastSavedAt: '2026-01-01T00:00:00.000Z',
  data: {
    profile: { name: 'Ada', age: 35, annualExpenses: 80000, fiTarget: 24000000, monthlyIncome: 150000 },
    coorgCorpus: 2400000,
    coorgStartDate: '2031-01',
    coorgTarget: 20000000,
    coorgMonthlyAmount: 10000,
    esopDetails: {
      shares: 100,
      grantPrice: 10,
      vestingSchedule: [],
      triggers: { marriage: false, childBirth: true, jobChange: false, coorgConstruction: true },
    },
  },
};

describe('persisted data migrations', () => {
  it('migrates a legacy coorg/triggers envelope into the goals shape without loss', () => {
    const migrated = migratePortfolioEnvelope(legacyV4Envelope) as { data: Record<string, any> };
    expect(isPortfolioEnvelope(migrated)).toBe(true);
    expect('coorgCorpus' in migrated.data).toBe(false);
    expect(migrated.data.goals).toHaveLength(1);
    expect(migrated.data.goals[0]).toMatchObject({
      id: 'goal-home',
      name: 'Home',
      kind: 'home',
      targetToday: 20000000,
      targetDate: '2031-01',
      currentAmount: 2400000,
      monthlyContribution: 10000,
    });
    expect(migrated.data.esopDetails.triggers).toBeUndefined();
    expect(migrated.data.liquidationRules.find((rule: any) => rule.kind === 'childBirth').active).toBe(true);
    expect(migrated.data.liquidationRules.find((rule: any) => rule.kind === 'goal')).toMatchObject({
      active: true,
      goalId: 'goal-home',
      allocateAmount: 500000,
    });
  });

  it('is idempotent', () => {
    const once = migratePersistedData(legacyV4Envelope.data);
    expect(migratePersistedData(once)).toEqual(once);
  });

  it('loads legacy local payloads into the new shape through normalizePersistedState', () => {
    const state = normalizePersistedState({ ...legacyV4Envelope.data });
    expect(state?.goals).toHaveLength(1);
    expect(state?.goals[0].currentAmount).toBe(2400000);
    expect(state?.liquidationRules.some((rule) => rule.kind === 'goal' && rule.active)).toBe(true);
  });

  it('round-trips a current envelope with goals', () => {
    const state = initializeState();
    state.goals = [
      {
        id: 'goal-home',
        name: 'Home',
        kind: 'home',
        targetToday: 1000000,
        targetDate: '2030-01',
        inflation: 'cpi',
        linkedAssetIds: [],
        currentAmount: 250000,
        monthlyContribution: 5000,
        priority: 1,
        riskBucket: 'medium',
      },
    ];
    const envelope = buildEnvelopeFromState(state, {}, '2026-01-01T00:00:00.000Z');
    expect(envelope.schemaVersion).toBe('fireOS_v5');
    expect(isPortfolioEnvelope(envelope)).toBe(true);

    const migrated = migratePortfolioEnvelope(envelope) as { data: Record<string, unknown> };
    expect(migrated.data.goals).toEqual(state.goals);
    expect(normalizePersistedState(migrated.data)?.goals).toEqual(state.goals);
  });

  it('rejects the legacy coorg keys through the strict current schema', () => {
    expect(persistedPortfolioSchema.safeParse({ coorgTarget: 1 }).success).toBe(false);
  });
});
