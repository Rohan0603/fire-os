import type { PortfolioEnvelope } from '../types/firebase';
import type { SyncCoordinator } from '../lib/syncCoordinator';
import { clearPortfolioStorageScope, configurePortfolioSync } from '../lib/storage';

export interface PortfolioSessionDependencies {
  clearStorageScope: typeof clearPortfolioStorageScope;
  configureSync: typeof configurePortfolioSync;
  resetState: () => void;
  warn: (message: string, error: unknown) => void;
}

const defaultDependencies: PortfolioSessionDependencies = {
  clearStorageScope: clearPortfolioStorageScope,
  configureSync: configurePortfolioSync,
  resetState: () => undefined,
  warn: (message, error) => console.warn(message, error),
};

/** Owns listeners and pending writes associated with the active portfolio session. */
export class PortfolioSession {
  private portfolioUnsubscribe: (() => void) | null = null;
  private syncCoordinator: SyncCoordinator | null = null;
  private niftyMonitorCleanup: (() => void) | null = null;
  private envelope: PortfolioEnvelope | null = null;

  private readonly dependencies: PortfolioSessionDependencies;

  constructor(dependencies: Partial<PortfolioSessionDependencies> = {}) {
    this.dependencies = { ...defaultDependencies, ...dependencies };
  }

  get coordinator(): SyncCoordinator | null {
    return this.syncCoordinator;
  }

  get currentEnvelope(): PortfolioEnvelope | null {
    return this.envelope;
  }

  setPortfolioUnsubscribe(unsubscribe: (() => void) | null): void {
    this.portfolioUnsubscribe?.();
    this.portfolioUnsubscribe = unsubscribe;
  }

  setSyncCoordinator(coordinator: SyncCoordinator | null): void {
    this.syncCoordinator = coordinator;
    this.dependencies.configureSync(coordinator, this.envelope);
  }

  setEnvelope(envelope: PortfolioEnvelope | null): void {
    this.envelope = envelope;
    this.dependencies.configureSync(this.syncCoordinator, envelope);
  }

  setNiftyMonitorCleanup(cleanup: (() => void) | null): void {
    this.niftyMonitorCleanup?.();
    this.niftyMonitorCleanup = cleanup;
  }

  async teardown(): Promise<void> {
    this.setPortfolioUnsubscribe(null);

    const coordinator = this.syncCoordinator;
    this.syncCoordinator = null;
    if (coordinator) {
      coordinator.pause();
      try {
        await coordinator.flush({ timeoutMs: 5000 });
      } catch (error) {
        this.dependencies.warn('[Auth] Failed to flush pending portfolio changes:', error);
      }
      coordinator.dispose();
    }

    this.setNiftyMonitorCleanup(null);
    this.envelope = null;
    this.dependencies.configureSync(null, null);
    this.dependencies.clearStorageScope();
    this.dependencies.resetState();
  }
}
