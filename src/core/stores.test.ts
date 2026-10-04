import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncCoordinator } from '../lib/syncCoordinator';
import {
  configurePortfolioStorageScope,
  configurePortfolioSync,
  persistPortfolioState,
} from '../lib/storage';
import { initializeState, type FireOSState } from '../types/state';
import type { PortfolioEnvelope, SyncStatus } from '../types/firebase';
import { refreshPortfolioNAVs } from './feature-ports';
import {
  activeScopeStore,
  marketRefreshStatusStore,
  notifyPortfolioSaved,
  portfolioSavedStore,
  resetScopeStatuses,
  syncStatusStore,
} from './stores';
import type { ActiveScopeStatus, MarketRefreshStatus } from './stores';

function createLocalStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  };
}

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

function createEnvelope(): PortfolioEnvelope {
  return {
    schemaVersion: 'fireOS_v3',
    lastSavedAt: '2026-01-01T00:00:00.000Z',
    data: {},
  };
}

describe('portfolio save signal', () => {
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

  it('notifies subscribers synchronously on every save', () => {
    const seen: number[] = [];
    const unsubscribe = portfolioSavedStore.subscribe((value) => seen.push(value));
    const before = seen.length;

    notifyPortfolioSaved();
    notifyPortfolioSaved();

    expect(seen.length).toBe(before + 2);
    expect(seen[seen.length - 1]).toBeGreaterThan(seen[seen.length - 2]);
    unsubscribe();
  });

  it('signals the guest dashboard refresh without a cloud write', () => {
    const coordinator = { markDirty: vi.fn() };
    configurePortfolioSync(coordinator as unknown as SyncCoordinator);
    const state = initializeState();
    state.profile.name = 'Guest reviewer';
    let notified = 0;
    const unsubscribe = portfolioSavedStore.subscribe(() => {
      notified += 1;
    });
    const before = notified;

    persistPortfolioState(state, { sync: true });

    expect(typeof document).toBe('undefined');
    expect(notified).toBe(before + 1);
    expect(coordinator.markDirty).not.toHaveBeenCalled();
    expect(localStorage.getItem('fireOS_v2:anonymous')).not.toBeNull();
    unsubscribe();
  });

  it('delivers rapid saves synchronously so coalescing stays with the subscriber', () => {
    let delivered = 0;
    const unsubscribe = portfolioSavedStore.subscribe(() => {
      delivered += 1;
    });
    const before = delivered;

    for (let i = 0; i < 5; i += 1) notifyPortfolioSaved();

    expect(delivered).toBe(before + 5);
    unsubscribe();
  });

  it('does not leak callbacks when subscribers mount and unmount repeatedly', () => {
    let calls = 0;
    for (let i = 0; i < 50; i += 1) {
      const unsubscribe = portfolioSavedStore.subscribe(() => {
        calls += 1;
      });
      notifyPortfolioSaved();
      unsubscribe();
    }

    expect(calls).toBe(100);
    notifyPortfolioSaved();
    expect(calls).toBe(100);
  });

  it('wires save invalidation through the store in storage and main', () => {
    const storage = readSource('../lib/storage.ts');
    expect(storage).toMatch(/notifyPortfolioSaved\(\)/);
    expect(storage).not.toContain('portfolioStateSaved');

    const main = readSource('../main.ts');
    expect(main).toContain('portfolioSavedStore.subscribe(refreshDashboard)');
    expect(main).not.toContain("addEventListener('portfolioStateSaved'");
    expect(main).toContain('if (renderQueued) return;');
    expect(main).toMatch(/requestAnimationFrame\(/);
    expect(main).toMatch(/renderDashboard\(/);
    expect(main).toContain('pagehide');
  });
});

describe('sync status signal', () => {
  beforeEach(() => {
    syncStatusStore.set('idle');
  });

  it('starts idle and only reports changed values to subscribers', () => {
    expect(syncStatusStore.get()).toBe('idle');
    const seen: SyncStatus[] = [];
    const unsubscribe = syncStatusStore.subscribe((status) => seen.push(status));
    expect(seen).toEqual(['idle']);

    syncStatusStore.set('pending');
    syncStatusStore.set('pending');
    expect(seen).toEqual(['idle', 'pending']);

    unsubscribe();
    syncStatusStore.set('idle');
    expect(seen).toEqual(['idle', 'pending']);
  });

  it('publishes offline, pending, syncing and synced transitions from the coordinator', async () => {
    const statuses: SyncStatus[] = [];
    const unsubscribe = syncStatusStore.subscribe((status) => statuses.push(status));
    const envelope = createEnvelope();

    const offline = new SyncCoordinator({
      uid: 'user-1',
      save: vi.fn(async () => undefined),
      initialOnline: false,
      onStatusChange: (status) => syncStatusStore.set(status),
    });
    offline.markDirty(envelope);
    expect(syncStatusStore.get()).toBe('offline');
    offline.dispose();

    const online = new SyncCoordinator({
      uid: 'user-1',
      save: vi.fn(async () => undefined),
      debounceMs: 60_000,
      initialOnline: true,
      onStatusChange: (status) => syncStatusStore.set(status),
    });
    online.markDirty(envelope);
    expect(syncStatusStore.get()).toBe('pending');
    await online.flush();
    expect(syncStatusStore.get()).toBe('idle');

    expect(statuses).toEqual(expect.arrayContaining(['offline', 'pending', 'syncing', 'idle']));
    online.dispose();
    unsubscribe();
  });

  it('publishes the error status when a cloud write fails', async () => {
    const save = vi.fn().mockRejectedValue(new Error('network failure'));
    const coordinator = new SyncCoordinator({
      uid: 'user-1',
      save,
      debounceMs: 60_000,
      maxRetries: 0,
      initialOnline: true,
      onStatusChange: (status) => syncStatusStore.set(status),
    });
    coordinator.markDirty(createEnvelope());

    await coordinator.flush().catch(() => undefined);

    expect(syncStatusStore.get()).toBe('error');
    coordinator.dispose();
  });

  it('wires coordinator status through the store in the auth session controller', () => {
    const controller = readSource('../app/auth-session-controller.ts');
    expect(controller).toContain('syncStatusStore.set(status)');
    expect(controller).not.toContain('syncStatusChanged');
  });
});

describe('active scope signal', () => {
  beforeEach(() => {
    activeScopeStore.set('local');
    marketRefreshStatusStore.set('idle');
    syncStatusStore.set('idle');
  });

  it('starts local and reports scope changes to subscribers', () => {
    expect(activeScopeStore.get()).toBe('local');
    const seen: ActiveScopeStatus[] = [];
    const unsubscribe = activeScopeStore.subscribe((scope) => seen.push(scope));

    activeScopeStore.set('cloud');
    activeScopeStore.set('cloud');
    expect(seen).toEqual(['local', 'cloud']);

    unsubscribe();
    activeScopeStore.set('local');
    expect(seen).toEqual(['local', 'cloud']);
  });

  it('clears scope-specific transient statuses on reset', () => {
    syncStatusStore.set('error');
    marketRefreshStatusStore.set('success');
    activeScopeStore.set('cloud');

    resetScopeStatuses();

    expect(syncStatusStore.get()).toBe('idle');
    expect(marketRefreshStatusStore.get()).toBe('idle');
    expect(activeScopeStore.get()).toBe('local');
  });
});

describe('market refresh signal', () => {
  beforeEach(() => {
    marketRefreshStatusStore.set('idle');
  });

  it('starts idle and reports refresh cycle states to subscribers', () => {
    expect(marketRefreshStatusStore.get()).toBe('idle');
    const seen: MarketRefreshStatus[] = [];
    const unsubscribe = marketRefreshStatusStore.subscribe((status) => seen.push(status));

    marketRefreshStatusStore.set('refreshing');
    marketRefreshStatusStore.set('refreshing');
    expect(seen).toEqual(['idle', 'refreshing']);

    unsubscribe();
    marketRefreshStatusStore.set('idle');
    expect(seen).toEqual(['idle', 'refreshing']);
  });

  it('publishes refreshing then success for a completed refresh cycle', async () => {
    const seen: MarketRefreshStatus[] = [];
    const unsubscribe = marketRefreshStatusStore.subscribe((status) => seen.push(status));

    await refreshPortfolioNAVs(initializeState());

    expect(marketRefreshStatusStore.get()).toBe('success');
    expect(seen).toEqual(['idle', 'refreshing', 'success']);
    unsubscribe();
  });

  it('publishes the error status when the refresh cycle fails', async () => {
    const seen: MarketRefreshStatus[] = [];
    const unsubscribe = marketRefreshStatusStore.subscribe((status) => seen.push(status));

    await expect(refreshPortfolioNAVs({} as FireOSState)).rejects.toThrow();

    expect(marketRefreshStatusStore.get()).toBe('error');
    expect(seen).toEqual(['idle', 'refreshing', 'error']);
    unsubscribe();
    marketRefreshStatusStore.set('idle');
  });
});
