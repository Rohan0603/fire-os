import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEnvelopeFromState, mergeEnvelopes } from './merge';
import { SyncCoordinator } from './syncCoordinator';
import { applyPersistedState, HISTORY_CACHE_MAX_BYTES, initializeState, isFireOSState } from '../types/state';
import type { HistoricalSeries } from '../types/api';
import { isPortfolioEnvelope } from '../types/firebase';
import {
  configurePortfolioStorageScope,
  configurePortfolioSync,
  getPortfolioStorageKey,
  loadData,
  persistPortfolioState,
  undoLastSavedPortfolioChange,
  PERSISTED_PAYLOAD_CEILING,
} from './storage';
import { getHistoryCacheMap, initAPIModule, initializeHistoryCache } from '../modules/api';
import { NAV_HISTORY_MAX_POINTS } from '../modules/api/mfapi';
import { NIFTY_HISTORY_MAX_POINTS } from '../modules/api/nifty';
import { createFeatureContext, type FeatureContext } from '../core/feature-context';
import { restorePortfolioBackup } from '../modules/profile/backup-import';
import { FeatureRegistry, type FeatureModule } from '../app/feature-registry';
import { createPortfolioRepository } from '../core/persistence/portfolio-repository';

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

function makeHistorySeries(count: number, start = '2015-01-01'): HistoricalSeries {
  const startMs = Date.parse(start);
  return {
    points: Array.from({ length: count }, (_, index) => ({
      date: new Date(startMs + index * 86_400_000).toISOString().slice(0, 10),
      value: 100 + index * 0.5,
    })),
    source: 'test-provider',
    fetchedAt: new Date().toISOString(),
    status: 'live',
  };
}

describe('portfolio persistence contracts', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorage());
    configurePortfolioStorageScope(null);
    configurePortfolioSync(null, null);
    initializeHistoryCache({});
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

  it('accepts valid other holdings and rejects invalid values', () => {
    const valid = buildEnvelopeFromState(initializeState(), client);
    expect(isPortfolioEnvelope({
      ...valid,
      data: {
        ...valid.data,
        otherHoldings: {
          gold: { name: 'Gold', amount: 100000, annualReturn: 8 },
        },
      },
    })).toBe(true);
    expect(isPortfolioEnvelope({
      ...valid,
      data: {
        ...valid.data,
        otherHoldings: {
          invalid: { name: ' ', amount: -1, annualReturn: 101 },
        },
      },
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
    expect(normalized?.otherHoldings).toEqual({});
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

  it('keeps guest changes in anonymous local storage without cloud enqueueing', () => {
    const coordinator = {
      markDirty: vi.fn(),
    } as unknown as SyncCoordinator;
    const state = initializeState();
    state.profile.name = 'Guest reviewer';
    configurePortfolioSync(coordinator);

    persistPortfolioState(state, { sync: true });

    expect(localStorage.getItem('fireOS_v2:anonymous')).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('fireOS_v2:anonymous')!).profile.name).toBe('Guest reviewer');
    expect(coordinator.markDirty).not.toHaveBeenCalled();
  });

  it('persists Nifty market data locally for subsequent assistant context builds', () => {
    const state = initializeState();
    state.niftyHigh = 25000;
    state.niftyData = {
      level: 24000,
      high52w: 25000,
      timestamp: '2026-10-03T10:00:00.000Z',
      source: 'Yahoo Finance',
      status: 'live',
    };

    persistPortfolioState(state, { sync: false });

    expect(loadData()?.niftyData).toEqual(state.niftyData);
    expect(loadData()?.niftyHigh).toBe(25000);
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

  it('preserves injected feature dependencies and registry lifecycle dispatch', async () => {
    const state = initializeState();
    const portfolio = { load: () => state, save: vi.fn() };
    const context = createFeatureContext(state, portfolio);
    const container = {} as HTMLElement;
    const mount = vi.fn();
    const unmount = vi.fn();
    const module: FeatureModule = { id: 'reports', label: 'Reports', mount, unmount };
    const registry = new FeatureRegistry(context);

    registry.register(module);
    await registry.mount('reports', container);
    await registry.unmount('reports', container);

    expect(context.state).toBe(state);
    expect(context.portfolio).toBe(portfolio);
    expect(registry.get('reports')).toBe(module);
    expect(mount).toHaveBeenCalledWith(container, context);
    expect(unmount).toHaveBeenCalledWith(container, context);
  });

  it('rejects duplicate and unknown feature registrations', async () => {
    const registry = new FeatureRegistry(createFeatureContext(initializeState()));
    const module: FeatureModule = { id: 'reports', label: 'Reports', mount: vi.fn() };

    registry.register(module);

    expect(() => registry.register(module)).toThrow('Feature already registered: reports');
    await expect(registry.mount('missing', {} as HTMLElement)).rejects.toThrow(
      'Unknown feature: missing',
    );
  });

  it('keeps repository local data when cloud enqueue fails', async () => {
    const repository = createPortfolioRepository();
    const state = initializeState();
    state.currentUser = { uid: 'user-1' } as typeof state.currentUser;
    const coordinator = {
      markDirty: vi.fn(() => {
        throw new Error('offline');
      }),
    };

    configurePortfolioStorageScope('user-1');
    configurePortfolioSync(coordinator as never);

    repository.save(state);
    await Promise.resolve();

    expect(repository.load()).not.toBeNull();
    expect(coordinator.markDirty).toHaveBeenCalledOnce();
  });

  it('returns the cloud persistence promise when awaitCloud is requested', async () => {
    const repository = createPortfolioRepository();
    const state = initializeState();
    state.currentUser = { uid: 'user-1' } as typeof state.currentUser;
    const coordinator = { markDirty: vi.fn(), flush: vi.fn(async () => undefined) };

    configurePortfolioStorageScope('user-1');
    configurePortfolioSync(coordinator as never);

    await expect(repository.save(state, { awaitCloud: true })).resolves.toBeUndefined();

    expect(repository.load()).not.toBeNull();
    expect(coordinator.markDirty).toHaveBeenCalledOnce();
    expect(coordinator.flush).toHaveBeenCalledOnce();
  });

  it('persists market history locally and keeps it inside the active scope', () => {
    const state = initializeState();
    state.marketHistory = { nifty: makeHistorySeries(5) };

    persistPortfolioState(state, { sync: false });
    expect(loadData()?.marketHistory).toEqual(state.marketHistory);

    configurePortfolioStorageScope('user-history');
    const otherState = initializeState();
    otherState.currentUser = { uid: 'user-history' } as typeof otherState.currentUser;
    persistPortfolioState(otherState, { sync: false });
    expect(loadData()?.marketHistory).toEqual({});

    configurePortfolioStorageScope(null);
    expect(loadData()?.marketHistory).toEqual(state.marketHistory);
  });

  it('mirrors the module history cache into persisted state on save', () => {
    const series = makeHistorySeries(5);
    initializeHistoryCache({ nifty: series });

    persistPortfolioState(initializeState(), { sync: false });

    expect(loadData()?.marketHistory).toEqual({ nifty: series });
  });

  it('hands persisted history through loadData → app state → initAPIModule → save', () => {
    const series = makeHistorySeries(5);
    localStorage.setItem(getPortfolioStorageKey()!, JSON.stringify({
      profile: { name: 'Ada', age: 35, annualExpenses: 80000, fiTarget: 24000000, monthlyIncome: 150000 },
      marketHistory: { nifty: series },
    }));

    const appState = initializeState();
    const cachedState = loadData();
    expect(cachedState?.marketHistory?.nifty?.points).toHaveLength(5);
    // The real wiring used by main.ts and the auth-session controller:
    // applyPersistedState copies the non-enumerable history field that
    // Object.assign drops (that drop was the H1 bug).
    applyPersistedState(appState, cachedState!);
    initAPIModule(appState);

    expect(getHistoryCacheMap().nifty?.points).toHaveLength(5);

    persistPortfolioState(appState, { sync: false });
    const saved = JSON.parse(localStorage.getItem(getPortfolioStorageKey()!)!);
    expect(saved.marketHistory?.nifty?.points).toHaveLength(5);
  });

  it('persists existing history when both the module cache and state are empty', () => {
    const series = makeHistorySeries(5);
    localStorage.setItem(getPortfolioStorageKey()!, JSON.stringify({
      profile: { name: 'Ada', age: 35, annualExpenses: 80000, fiTarget: 24000000, monthlyIncome: 150000 },
      marketHistory: { nifty: series },
    }));
    // Module cache deliberately unwarmed (beforeEach resets it); app state
    // freshly initialized, so both in-memory sources are empty.
    const appState = initializeState();

    persistPortfolioState(appState, { sync: false });

    const saved = JSON.parse(localStorage.getItem(getPortfolioStorageKey()!)!);
    expect(saved.marketHistory?.nifty?.points).toHaveLength(5);
  });

  it('drops malformed persisted history without discarding the portfolio', () => {
    localStorage.setItem('fireOS_v2', JSON.stringify({
      profile: { name: 'Ada', age: 35, annualExpenses: 80000, fiTarget: 24000000, monthlyIncome: 150000 },
      marketHistory: { nifty: { points: 'nope' } },
    }));

    const loaded = loadData();

    expect(loaded?.profile.name).toBe('Ada');
    expect(loaded?.marketHistory).toEqual({});
    expect(loaded?.otherHoldings).toEqual({});
  });

  it('enforces per-series point caps and the byte budget before persisting', () => {
    initializeHistoryCache({
      nifty: makeHistorySeries(1400),
      'nav:122639': makeHistorySeries(3000),
    });

    persistPortfolioState(initializeState(), { sync: false });

    const raw = localStorage.getItem(getPortfolioStorageKey()!)!;
    const history = JSON.parse(raw).marketHistory;
    expect(history.nifty.points).toHaveLength(NIFTY_HISTORY_MAX_POINTS);
    expect(history['nav:122639'].points).toHaveLength(NAV_HISTORY_MAX_POINTS);
    expect(JSON.stringify(history).length).toBeLessThanOrEqual(HISTORY_CACHE_MAX_BYTES);
    expect(raw.length).toBeLessThanOrEqual(PERSISTED_PAYLOAD_CEILING);
  });

  it('keeps the persisted payload under the ceiling by dropping history first', () => {
    const state = initializeState();
    state.expenses = Array.from({ length: 10600 }, () => ({
      date: '2026-01-01',
      category: 'misc',
      amount: 1,
      linkedToSWP: false,
    }));
    state.marketHistory = { nifty: makeHistorySeries(NIFTY_HISTORY_MAX_POINTS) };
    // marketHistory is non-enumerable on state, so measure the would-be
    // persisted payload by adding its history bytes explicitly.
    const baseBytes = JSON.stringify(state).length;
    const historyBytes = JSON.stringify(state.marketHistory).length;
    expect(baseBytes).toBeLessThanOrEqual(PERSISTED_PAYLOAD_CEILING);
    expect(baseBytes + historyBytes).toBeGreaterThan(PERSISTED_PAYLOAD_CEILING);

    persistPortfolioState(state, { sync: false });

    const raw = localStorage.getItem(getPortfolioStorageKey()!)!;
    const persisted = JSON.parse(raw);
    expect(raw.length).toBeLessThanOrEqual(PERSISTED_PAYLOAD_CEILING);
    expect(persisted.marketHistory).toBeUndefined();
    expect(persisted.expenses).toHaveLength(10600);
    expect(loadData()?.expenses).toHaveLength(10600);
  });

  it('excludes market history from the cloud envelope', () => {
    const coordinator = { markDirty: vi.fn(), flush: vi.fn(async () => undefined) };
    const state = initializeState();
    state.currentUser = { uid: 'user-1' } as typeof state.currentUser;
    configurePortfolioStorageScope('user-1');
    configurePortfolioSync(coordinator as never);
    initializeHistoryCache({ nifty: makeHistorySeries(5) });

    persistPortfolioState(state, { sync: true });

    expect(coordinator.markDirty).toHaveBeenCalledOnce();
    const envelope = coordinator.markDirty.mock.calls[0][0];
    expect('marketHistory' in envelope.data).toBe(false);
    expect(isPortfolioEnvelope(envelope)).toBe(true);
    expect(loadData()?.marketHistory?.nifty).toBeDefined();
  });

  it('keeps market history through an undo snapshot restore', () => {
    vi.stubGlobal('sessionStorage', createLocalStorage());
    const series = makeHistorySeries(5);
    initializeHistoryCache({ nifty: series });
    const state = initializeState();

    persistPortfolioState(state, { sync: false }); // snapshot 1
    state.niftyHigh = 12345;
    state.marketHistory = { nifty: makeHistorySeries(3) };
    persistPortfolioState(state, { sync: false }); // snapshot 2

    const snapshots = JSON.parse(sessionStorage.getItem('fireOS_v2:anonymous:snapshots')!);
    expect(snapshots).toHaveLength(2);
    expect(snapshots.every((entry: Record<string, unknown>) => !('marketHistory' in entry))).toBe(true);

    expect(undoLastSavedPortfolioChange(state)).toBe(true);
    expect(state.niftyHigh).toBe(0); // snapshot 1 values restored
    expect(state.marketHistory?.nifty?.points).toHaveLength(3); // history survives undo
  });

  it('keeps market history through a portfolio backup restore', async () => {
    const series = makeHistorySeries(5);
    initializeHistoryCache({ nifty: series });
    const state = initializeState();
    state.marketHistory = { nifty: series };
    persistPortfolioState(state, { sync: false });

    const context = {
      state,
      portfolio: {
        save: vi.fn(async (candidate: typeof state) => {
          persistPortfolioState(candidate, { sync: false });
        }),
      },
    } as unknown as FeatureContext;

    await restorePortfolioBackup({ profile: { ...initializeState().profile, name: 'Restored' } }, context, true);

    expect(state.profile.name).toBe('Restored'); // restore actually applied
    expect(state.marketHistory?.nifty?.points).toHaveLength(5); // in-memory history survives
    const saved = JSON.parse(localStorage.getItem(getPortfolioStorageKey()!)!);
    expect(saved.marketHistory?.nifty?.points).toHaveLength(5); // payload keeps it too
  });

  it('adopts scoped history on a scope switch and mirrors the global cache (intentional)', () => {
    // The module cache is global by design (M2): market history is public
    // market data, so a scope switch does not re-hydrate it.
    initializeHistoryCache({ nifty: makeHistorySeries(5) });
    localStorage.setItem('fireOS_v2:user:user-1', JSON.stringify({
      profile: { name: 'User', age: 30, annualExpenses: 1, fiTarget: 2, monthlyIncome: 3 },
      marketHistory: { nifty: makeHistorySeries(3) },
    }));

    configurePortfolioStorageScope('user-1');
    const appState = initializeState();
    applyPersistedState(appState, loadData()!);
    expect(appState.marketHistory?.nifty?.points).toHaveLength(3); // state adopts scope history

    appState.currentUser = { uid: 'user-1' } as typeof appState.currentUser;
    persistPortfolioState(appState, { sync: false });
    const saved = JSON.parse(localStorage.getItem('fireOS_v2:user:user-1')!);
    expect(saved.marketHistory?.nifty?.points).toHaveLength(5); // global cache mirrors in
  });
});
