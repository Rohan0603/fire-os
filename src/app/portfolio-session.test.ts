import { describe, expect, it, vi } from 'vitest';
import type { PortfolioEnvelope } from '../types/firebase';
import type { SyncCoordinator } from '../lib/syncCoordinator';
import { PortfolioSession } from './portfolio-session';

function createEnvelope(): PortfolioEnvelope {
  return {
    schemaVersion: 'fireOS_v3',
    lastSavedAt: '2026-01-01T00:00:00.000Z',
    data: {},
  };
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
});
