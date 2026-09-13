import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeState } from '../types/state';
import {
  clearPortfolioStorageScope,
  configurePortfolioStorageScope,
  configurePortfolioSync,
  loadData,
  persistPortfolioState,
} from './storage';

function createLocalStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  };
}

describe('authenticated session storage isolation', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorage());
    configurePortfolioStorageScope(null);
    configurePortfolioSync(null, null);
  });

  afterEach(() => {
    clearPortfolioStorageScope();
    configurePortfolioSync(null, null);
    vi.unstubAllGlobals();
  });

  it('keeps A data out of B while retaining each user cache for return', () => {
    const userAState = initializeState();
    userAState.currentUser = { uid: 'user-a' } as typeof userAState.currentUser;
    userAState.profile.name = 'User A';

    configurePortfolioStorageScope('user-a');
    persistPortfolioState(userAState, { sync: false });

    clearPortfolioStorageScope();
    configurePortfolioStorageScope('user-b');
    expect(loadData()).toBeNull();

    const userBState = initializeState();
    userBState.currentUser = { uid: 'user-b' } as typeof userBState.currentUser;
    userBState.profile.name = 'User B';
    persistPortfolioState(userBState, { sync: false });

    configurePortfolioStorageScope('user-a');
    expect(loadData()?.profile.name).toBe('User A');
    configurePortfolioStorageScope('user-b');
    expect(loadData()?.profile.name).toBe('User B');
  });

  it('rejects stale-user writes after the active scope changes', () => {
    const userAState = initializeState();
    userAState.currentUser = { uid: 'user-a' } as typeof userAState.currentUser;
    userAState.profile.name = 'User A';

    configurePortfolioStorageScope('user-b');
    persistPortfolioState(userAState, { sync: false });

    expect(localStorage.getItem('fireOS_v2:user:user-b')).toBeNull();
  });

  it('keeps legacy data anonymous and never promotes it to an account', () => {
    localStorage.setItem('fireOS_v2', JSON.stringify({
      profile: { name: 'Legacy User', age: 35, annualExpenses: 100, fiTarget: 200, monthlyIncome: 300 },
    }));

    configurePortfolioStorageScope(null);
    expect(loadData()?.profile.name).toBe('Legacy User');
    expect(localStorage.getItem('fireOS_v2:anonymous')).not.toBeNull();

    configurePortfolioStorageScope('user-b');
    expect(loadData()).toBeNull();
  });

  it('clears the active scope idempotently without deleting retained caches', () => {
    configurePortfolioStorageScope('user-a');
    clearPortfolioStorageScope();
    clearPortfolioStorageScope();

    expect(loadData()).toBeNull();
    expect(localStorage.getItem('fireOS_v2:user:user-a')).toBeNull();
  });
});
