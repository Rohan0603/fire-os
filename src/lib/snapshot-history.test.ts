import { describe, expect, it, beforeEach, vi } from 'vitest';
import { initializeState } from '../types/state';
import { recordPortfolioSnapshot, undoLastPortfolioSnapshot } from './snapshot-history';

describe('snapshot history', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      clear: () => values.clear(),
    });
  });

  it('restores the previous validated portfolio snapshot and bounds history', () => {
    const first = initializeState();
    first.profile.name = 'First';
    const second = { ...first, profile: { ...first.profile, name: 'Second' } };

    const { currentUser: firstUser, _syncMetadata: firstMetadata, _lastSavedAt: firstSavedAt, ...firstPersisted } = first;
    const { currentUser: secondUser, _syncMetadata: secondMetadata, _lastSavedAt: secondSavedAt, ...secondPersisted } = second;
    void firstUser;
    void firstMetadata;
    void firstSavedAt;
    void secondUser;
    void secondMetadata;
    void secondSavedAt;
    recordPortfolioSnapshot('test', firstPersisted);
    recordPortfolioSnapshot('test', secondPersisted);

    const current = { ...second, profile: { ...second.profile, name: 'Changed' } };
    expect(undoLastPortfolioSnapshot('test', current)).toBe(true);
    expect(current.profile.name).toBe('First');
  });

  it('does not undo when there is no prior snapshot', () => {
    const state = initializeState();
    const { currentUser, _syncMetadata, _lastSavedAt, ...persisted } = state;
    void currentUser;
    void _syncMetadata;
    void _lastSavedAt;
    recordPortfolioSnapshot('test', persisted);
    expect(undoLastPortfolioSnapshot('test', state)).toBe(false);
  });
});
