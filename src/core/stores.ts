/**
 * Ephemeral reactive UI signals (Nanostores atoms only — vanilla `nanostores`,
 * never `@nanostores/persistent`). Durable portfolio persistence stays in
 * PortfolioRepository/storage with identity-scoped localStorage and the
 * Firestore sync queue; these stores only invalidate/notify UI subscribers.
 *
 * Subscriptions return Nanostores unsubscribe callbacks (`() => void`) and
 * work in DOM-less environments (tests, non-browser runtimes).
 */
import { atom } from 'nanostores';
import type { CrashAlert } from '../modules/api/nifty-monitor';
import type { SyncStatus } from '../types/firebase';

/**
 * Monotonic save counter. Every local portfolio save increments it, so
 * subscribers are notified on every save; the value itself is only an
 * invalidation token, not portfolio data.
 */
export const portfolioSavedStore = atom(0);

/**
 * Latest ephemeral sync status from the active `SyncCoordinator`
 * (`idle` = synced / no pending cloud work). Reset to `idle` when the
 * session's coordinator is disposed on teardown.
 */
export const syncStatusStore = atom<SyncStatus>('idle');

/**
 * Identity-neutral scope of the active portfolio (`local` = guest or no
 * coordinator attached, `cloud` = authenticated portfolio syncing). The
 * active uid itself is never mirrored here — `PortfolioSession` owns it;
 * the session publishes these values.
 */
export type ActiveScopeStatus = 'local' | 'cloud';

/** Lifecycle of one market-data refresh cycle. */
export type MarketRefreshStatus = 'idle' | 'refreshing' | 'success' | 'error';

export const activeScopeStore = atom<ActiveScopeStatus>('local');

export const marketRefreshStatusStore = atom<MarketRefreshStatus>('idle');

/**
 * Latest market crash alert published by the Nifty monitor
 * (`updateCrashAlert`). `null` = no active alert. The dashboard reads this
 * atom for its banner instead of re-rendering imperative HTML.
 */
export const crashAlertStore = atom<CrashAlert | null>(null);

/** Publish a save invalidation after the local write completes. */
export function notifyPortfolioSaved(): void {
  portfolioSavedStore.set(portfolioSavedStore.get() + 1);
}

/**
 * Clear scope-specific transient statuses on an account/guest switch.
 * `PortfolioSession.teardown()` calls this as its final step so status
 * publications emitted while the retiring scope is being torn down (a
 * failing flush, coordinator disposal) cannot surface as stale status to
 * the next scope's subscribers.
 */
export function resetScopeStatuses(): void {
  syncStatusStore.set('idle');
  marketRefreshStatusStore.set('idle');
  activeScopeStore.set('local');
}
