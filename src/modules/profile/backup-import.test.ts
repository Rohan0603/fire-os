import { describe, expect, it, vi } from 'vitest';
import { createFeatureContext } from '../../core/feature-context';
import { initializeState } from '../../types/state';
import { parsePortfolioBackup, restorePortfolioBackup } from './backup-import';

describe('parsePortfolioBackup', () => {
  it('rejects malformed JSON', () => {
    expect(parsePortfolioBackup('{')).toMatchObject({ data: null });
  });

  it('rejects an invalid nested shape', () => {
    expect(parsePortfolioBackup(JSON.stringify({ profile: { age: 'old' } }))).toMatchObject({ data: null });
  });

  it('does not import runtime-only fields', () => {
    const result = parsePortfolioBackup(JSON.stringify({ profile: { name: 'A', age: 1, annualExpenses: 1, fiTarget: 1, monthlyIncome: 1 }, currentUser: { uid: 'other' }, _syncMetadata: { isDirty: true } }));
    expect(result.issues).toEqual([]);
    expect(result.data).not.toHaveProperty('currentUser');
    expect(result.data).not.toHaveProperty('_syncMetadata');
  });

  it('rejects backups containing only unsupported top-level fields', () => {
    expect(parsePortfolioBackup(JSON.stringify({ unsupported: true }))).toMatchObject({ data: null });
  });

  it('rejects unsupported fields mixed with persisted data', () => {
    expect(parsePortfolioBackup(JSON.stringify({ profile: { name: 'A', age: 1, annualExpenses: 1, fiTarget: 1, monthlyIncome: 1 }, unsupported: true })))
      .toMatchObject({ data: null });
  });

  it('accepts a valid partial backup', () => {
    expect(parsePortfolioBackup(JSON.stringify({ profile: { name: 'A', age: 30, annualExpenses: 1, fiTarget: 2, monthlyIncome: 3 } })).data)
      .toMatchObject({ profile: { name: 'A' } });
  });
});

describe('restorePortfolioBackup', () => {
  it('does not mutate or save when cancelled', async () => {
    const state = initializeState();
    const context = createFeatureContext(state);
    const save = vi.spyOn(context.portfolio, 'save');
    const before = structuredClone(state);
    const backup = parsePortfolioBackup(JSON.stringify({ profile: { name: 'Restored', age: 30, annualExpenses: 1, fiTarget: 2, monthlyIncome: 3 } })).data!;
    await restorePortfolioBackup(backup, context, false);
    expect(state).toEqual(before);
    expect(save).not.toHaveBeenCalled();
  });

  it('normalizes and saves confirmed data through the active repository', async () => {
    const state = initializeState();
    state.currentUser = { uid: 'active-user' } as typeof state.currentUser;
    state._syncMetadata = { lastSavedAt: '2026-10-03T00:00:00.000Z', isDirty: true };
    const context = createFeatureContext(state);
    const save = vi.spyOn(context.portfolio, 'save').mockResolvedValue();
    const backup = parsePortfolioBackup(JSON.stringify({ profile: { name: 'Restored', age: 30, annualExpenses: 1, fiTarget: 2, monthlyIncome: 3 } })).data!;
    await restorePortfolioBackup(backup, context, true);
    expect(state.profile.name).toBe('Restored');
    expect(state.sip).toEqual({});
    expect(state.currentUser).toEqual({ uid: 'active-user' });
    expect(state._syncMetadata?.isDirty).toBe(true);
    expect(save).toHaveBeenCalledWith(state);
  });

  it('leaves active state unchanged when repository save rejects', async () => {
    const state = initializeState();
    const context = createFeatureContext(state);
    vi.spyOn(context.portfolio, 'save').mockRejectedValue(new Error('storage failed'));
    const before = structuredClone(state);
    const backup = parsePortfolioBackup(JSON.stringify({ profile: { name: 'Restored', age: 30, annualExpenses: 1, fiTarget: 2, monthlyIncome: 3 } })).data!;
    await expect(restorePortfolioBackup(backup, context, true)).rejects.toThrow('storage failed');
    expect(state).toEqual(before);
  });
});
