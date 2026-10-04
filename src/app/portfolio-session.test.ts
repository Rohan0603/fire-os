import { describe, expect, it, vi } from 'vitest';
import type { PortfolioEnvelope, SyncStatus } from '../types/firebase';
import { SyncCoordinator } from '../lib/syncCoordinator';
import { activeScopeStore, marketRefreshStatusStore, syncStatusStore } from '../core/stores';
import { PortfolioSession } from './portfolio-session';

function createEnvelope(): PortfolioEnvelope {
  return {
    schemaVersion: 'fireOS_v3',
    lastSavedAt: '2026-01-01T00:00:00.000Z',
    data: {},
  };
}

function createSession(): PortfolioSession {
  return new PortfolioSession({
    configureSync: vi.fn(),
    clearStorageScope: vi.fn(),
    resetState: vi.fn(),
    warn: vi.fn(),
  });
}

function createCoordinator(uid: string): SyncCoordinator {
  return new SyncCoordinator({
    uid,
    save: vi.fn(async () => undefined),
    debounceMs: 60_000,
    initialOnline: true,
    onStatusChange: (status) => syncStatusStore.set(status),
  });
}

function resetSignals(): void {
  syncStatusStore.set('idle');
  marketRefreshStatusStore.set('idle');
  activeScopeStore.set('local');
}

describe('PortfolioSession', () => {
  it('configures the active sync pair when coordinator and envelope change', () => {
    const configureSync = vi.fn();
    const session = new PortfolioSession({
      configureSync,
      clearStorageScope: vi.fn(),
      resetState: vi.fn(),
      warn: vi.fn(),
    });
    const coordinator = { pause: vi.fn() } as unknown as SyncCoordinator;
    const envelope = createEnvelope();

    session.setEnvelope(envelope);
    session.setSyncCoordinator(coordinator);

    expect(session.currentEnvelope).toBe(envelope);
    expect(session.coordinator).toBe(coordinator);
    expect(configureSync).toHaveBeenLastCalledWith(coordinator, envelope);
  });

  it('unsubscribes, flushes and disposes sync resources before resetting session scope', async () => {
    const order: string[] = [];
    const configureSync = vi.fn(() => order.push('configure'));
    const coordinator = {
      pause: vi.fn(() => order.push('pause')),
      flush: vi.fn(async () => order.push('flush')),
      dispose: vi.fn(() => order.push('dispose')),
    } as unknown as SyncCoordinator;
    const session = new PortfolioSession({
      configureSync,
      clearStorageScope: () => order.push('clear-scope'),
      resetState: () => order.push('reset-state'),
      warn: vi.fn(),
    });
    session.setPortfolioUnsubscribe(() => order.push('unsubscribe'));
    session.setSyncCoordinator(coordinator);
    session.setNiftyMonitorCleanup(() => order.push('stop-monitor'));
    session.setEnvelope(createEnvelope());

    await session.teardown();

    expect(order).toEqual([
      'configure',
      'configure',
      'unsubscribe',
      'pause',
      'flush',
      'dispose',
      'stop-monitor',
      'configure',
      'clear-scope',
      'reset-state',
    ]);
    expect(session.coordinator).toBeNull();
    expect(session.currentEnvelope).toBeNull();
  });

  it('continues teardown when a pending cloud flush fails', async () => {
    const warn = vi.fn();
    const resetState = vi.fn();
    const coordinator = {
      pause: vi.fn(),
      flush: vi.fn().mockRejectedValue(new Error('offline')),
      dispose: vi.fn(),
    } as unknown as SyncCoordinator;
    const session = new PortfolioSession({
      configureSync: vi.fn(),
      clearStorageScope: vi.fn(),
      resetState,
      warn,
    });
    session.setSyncCoordinator(coordinator);

    await expect(session.teardown()).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledOnce();
    expect(coordinator.dispose).toHaveBeenCalledOnce();
    expect(resetState).toHaveBeenCalledOnce();
  });

  it('teardown unsubscribes observers and stops stale sync status updates', async () => {
    syncStatusStore.set('idle');
    const statuses: SyncStatus[] = [];
    const publish = (status: SyncStatus) => syncStatusStore.set(status);
    const session = new PortfolioSession({
      configureSync: vi.fn(),
      clearStorageScope: vi.fn(),
      resetState: vi.fn(),
      warn: vi.fn(),
    });
    const coordinator = new SyncCoordinator({
      uid: 'user-1',
      save: vi.fn(async () => undefined),
      debounceMs: 60_000,
      initialOnline: true,
      onStatusChange: publish,
    });
    const unsubscribe = syncStatusStore.subscribe((status) => statuses.push(status));
    session.setSyncCoordinator(coordinator);
    session.setPortfolioUnsubscribe(unsubscribe);

    coordinator.markDirty(createEnvelope());
    expect(syncStatusStore.get()).toBe('pending');
    expect(statuses).toEqual(['idle', 'pending']);

    await session.teardown();

    expect(syncStatusStore.get()).toBe('idle');
    const delivered = statuses.length;

    coordinator.markDirty(createEnvelope());
    expect(syncStatusStore.get()).toBe('idle');
    publish('error');
    expect(statuses.length).toBe(delivered);
    syncStatusStore.set('idle');
  });

  it('clears transient scope statuses across a guest-to-user transition', async () => {
    resetSignals();
    const session = createSession();
    // Guest scope: a market refresh just finished, sync has nothing pending.
    marketRefreshStatusStore.set('success');

    await session.teardown();

    expect(syncStatusStore.get()).toBe('idle');
    expect(marketRefreshStatusStore.get()).toBe('idle');
    expect(activeScopeStore.get()).toBe('local');

    const coordinator = createCoordinator('user-1');
    session.setSyncCoordinator(coordinator);

    expect(activeScopeStore.get()).toBe('cloud');
    expect(syncStatusStore.get()).toBe('idle');
    expect(marketRefreshStatusStore.get()).toBe('idle');

    coordinator.markDirty(createEnvelope());
    expect(syncStatusStore.get()).toBe('pending');
    coordinator.dispose();
    resetSignals();
  });

  it('clears transient scope statuses across a user-to-user transition', async () => {
    resetSignals();
    const session = createSession();
    const first = createCoordinator('user-1');
    session.setSyncCoordinator(first);
    first.markDirty(createEnvelope());
    marketRefreshStatusStore.set('success');
    expect(activeScopeStore.get()).toBe('cloud');
    expect(syncStatusStore.get()).toBe('pending');

    await session.teardown();

    expect(syncStatusStore.get()).toBe('idle');
    expect(marketRefreshStatusStore.get()).toBe('idle');
    expect(activeScopeStore.get()).toBe('local');

    const second = createCoordinator('user-2');
    session.setSyncCoordinator(second);

    expect(activeScopeStore.get()).toBe('cloud');
    expect(syncStatusStore.get()).toBe('idle');
    expect(marketRefreshStatusStore.get()).toBe('idle');

    second.markDirty(createEnvelope());
    expect(syncStatusStore.get()).toBe('pending');
    second.dispose();
    resetSignals();
  });

  it('does not surface raw teardown-window status publishes after a user-to-guest switch', async () => {
    resetSignals();
    const session = createSession();
    const publish = (status: SyncStatus) => syncStatusStore.set(status);
    // The retiring scope fails its teardown flush and publishes raw status.
    const retiring = {
      pause: vi.fn(),
      flush: vi.fn(async () => publish('error')),
      dispose: vi.fn(() => publish('idle')),
    } as unknown as SyncCoordinator;
    session.setSyncCoordinator(retiring);
    syncStatusStore.set('error');
    marketRefreshStatusStore.set('error');

    await session.teardown();

    expect(retiring.flush).toHaveBeenCalledOnce();
    expect(syncStatusStore.get()).toBe('idle');
    expect(marketRefreshStatusStore.get()).toBe('idle');
    expect(activeScopeStore.get()).toBe('local');
    resetSignals();
  });
});
