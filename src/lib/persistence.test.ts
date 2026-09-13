import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEnvelopeFromState, mergeEnvelopes } from './merge';
import { SyncCoordinator } from './syncCoordinator';
import { initializeState, isFireOSState } from '../types/state';
import { isPortfolioEnvelope } from '../types/firebase';
import { configurePortfolioStorageScope, configurePortfolioSync, loadData, persistPortfolioState } from './storage';

const client = { clientId: 'test-client', lastWriteId: 'write-1' };

function createLocalStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  };
}

describe('portfolio persistence contracts', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorage());
    configurePortfolioStorageScope(null);
    configurePortfolioSync(null, null);
  });

  afterEach(() => {
    configurePortfolioStorageScope(null);
    configurePortfolioSync(null, null);
    vi.unstubAllGlobals();
  });

  it('validates the complete initialized state and rejects malformed nested data', () => {
    const state = initializeState();
    expect(isFireOSState(state)).toBe(true);
    expect(isPortfolioEnvelope({
      ...buildEnvelopeFromState(state, client),
      data: { ...buildEnvelopeFromState(state, client).data, nav: { bad: { nav: 'not-a-number' } } },
    })).toBe(false);
  });

  it('rejects runtime fields and normalizes omitted top-level persisted sections', () => {
    localStorage.setItem('fireOS_v2', '{malformed');
    expect(loadData()).toBeNull();

    localStorage.setItem('fireOS_v2', JSON.stringify({
      profile: { name: 'Ada', age: 35, annualExpenses: 100, fiTarget: 200, monthlyIncome: 300 },
      currentUser: { uid: 'should-not-load' },
    }));
    expect(loadData()).toBeNull();

    localStorage.setItem('fireOS_v2', JSON.stringify({
      profile: { name: 'Ada', age: 35, annualExpenses: 100, fiTarget: 200, monthlyIncome: 300 },
    }));
    const normalized = loadData();
    expect(normalized?.profile.name).toBe('Ada');
    expect(normalized?.insurance.health.familySize).toBe(1);
    expect(normalized?.currentUser).toBeNull();
  });

  it('writes locally before enqueueing exactly one authenticated cloud write', () => {
    const events: string[] = [];
    const coordinator = {
      markDirty: vi.fn(() => events.push('cloud')),
    } as unknown as SyncCoordinator;
    const state = initializeState();
    state.currentUser = { uid: 'user-1' } as typeof state.currentUser;
    configurePortfolioStorageScope('user-1');
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => events.push('local'));
    configurePortfolioSync(coordinator);

    persistPortfolioState(state);

    expect(events).toEqual(['local', 'cloud']);
    expect(coordinator.markDirty).toHaveBeenCalledOnce();
  });

  it('keeps local data when cloud enqueue fails', async () => {
    const coordinator = {
      markDirty: vi.fn(() => { throw new Error('offline'); }),
    } as unknown as SyncCoordinator;
    const state = initializeState();
    state.currentUser = { uid: 'user-1' } as typeof state.currentUser;
    configurePortfolioStorageScope('user-1');
    configurePortfolioSync(coordinator);

    persistPortfolioState(state);
    await Promise.resolve();

    expect(localStorage.getItem('fireOS_v2:user:user-1')).not.toBeNull();
  });

  it('rejects malformed envelopes at the runtime boundary', () => {
    expect(isPortfolioEnvelope({ schemaVersion: 'fireOS_v3' })).toBe(false);
    expect(isPortfolioEnvelope({
      schemaVersion: 'fireOS_v3',
      lastSavedAt: 'not-a-date',
      data: {},
    })).toBe(false);
    const valid = buildEnvelopeFromState(initializeState(), client, '2025-01-01T00:00:00.000Z');
    expect(isPortfolioEnvelope({ ...valid, data: { ...valid.data, unknownField: true } })).toBe(false);
    expect(isPortfolioEnvelope({ ...valid, data: { ...valid.data, niftyHigh: Number.NaN } })).toBe(false);
    expect(isPortfolioEnvelope({ ...valid, client: { platform: 'cordova' } })).toBe(false);
  });

  it('retains clocks for sections unchanged since the previous envelope', () => {
    const state = initializeState();
    const previous = buildEnvelopeFromState(state, client, '2025-01-01T00:00:00.000Z');
    const next = buildEnvelopeFromState(state, client, '2025-01-02T00:00:00.000Z', previous);

    expect(next.sectionUpdatedAt?.profile).toBe('2025-01-01T00:00:00.000Z');
    expect(next.lastSavedAt).toBe('2025-01-02T00:00:00.000Z');
  });

  it('resolves equal timestamps with the client tie-breaker', () => {
    const state = initializeState();
    state.profile.name = 'local';
    const local = buildEnvelopeFromState(state, { clientId: 'z-client' }, '2025-01-01T00:00:00.000Z');
    state.profile.name = 'remote';
    const remote = buildEnvelopeFromState(state, { clientId: 'a-client' }, '2025-01-01T00:00:00.000Z');

    expect(mergeEnvelopes(local, remote).envelope.data.profile?.name).toBe('local');
  });

  it('coalesces pending writes before flush', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const coordinator = new SyncCoordinator({ uid: 'user-1', save, debounceMs: 60_000, initialOnline: true });
    const state = initializeState();
    const first = buildEnvelopeFromState(state, client, '2025-01-01T00:00:00.000Z');
    state.profile.name = 'latest';
    const latest = buildEnvelopeFromState(state, client, '2025-01-02T00:00:00.000Z', first);

    coordinator.markDirty(first);
    coordinator.markDirty(latest);
    await coordinator.flush();

    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith('user-1', latest);
    coordinator.dispose();
  });
});