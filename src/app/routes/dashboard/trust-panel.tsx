/**
 * Data-trust panel and crash-alert banner.
 *
 * The status labels are driven by the reactive stores (`useStore`), so they
 * update live without the legacy imperative repaint. The stale-source list and
 * completeness come from state; the retry calls the shared `refreshStaleData`.
 */
import { useState, type ReactNode } from 'react';
import { Button, Card, CardTitle } from '../../ui';
import { useStore } from '../../hooks/use-store';
import {
  activeScopeStore,
  crashAlertStore,
  marketRefreshStatusStore,
  syncStatusStore,
  type ActiveScopeStatus,
  type MarketRefreshStatus,
} from '../../../core/stores';
import { totalNetWorth } from '../../../modules/dashboard/kpis';
import { refreshStaleData, staleSourceLabels } from '../../../modules/dashboard';
import { formatCurrency } from '../../../lib/formatters';
import { profileCompletenessPercent } from '../../../lib/completeness';
import type { SyncStatus } from '../../../types/firebase';
import type { FireOSState } from '../../../types/state';

const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  idle: 'Synced',
  pending: 'Pending changes',
  syncing: 'Syncing',
  offline: 'Offline',
  error: 'Sync error',
  conflict: 'Sync conflict',
};

const MARKET_REFRESH_LABELS: Record<MarketRefreshStatus, string> = {
  idle: 'Not refreshed yet',
  refreshing: 'Refreshing',
  success: 'Up to date',
  error: 'Refresh failed',
};

const SCOPE_LABELS: Record<ActiveScopeStatus, string> = {
  local: 'Local-only mode',
  cloud: 'Cloud sync enabled',
};

/** Severity banner shown at the top of the dashboard when the monitor fires. */
export function CrashAlertBanner() {
  const alert = useStore(crashAlertStore);
  if (!alert) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-(--color-destructive) bg-(--color-surface) p-4"
    >
      <p className="font-semibold text-(--color-destructive)">
        {`Nifty crashed ${alert.crashPercentage}%`}
      </p>
      <p className="text-sm text-(--color-foreground)">
        {`Deploy ${formatCurrency(alert.deployAmount || 0, 0)} via Wint Wealth (Crash Protocol)`}
      </p>
    </div>
  );
}

function TrustRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="font-semibold text-(--color-foreground)">{label}</span>
      <span className="text-right text-(--color-muted-foreground)">{children}</span>
    </div>
  );
}

export function DataTrustPanel({ state }: { state: FireOSState }) {
  const sync = useStore(syncStatusStore);
  const market = useStore(marketRefreshStatusStore);
  const scope = useStore(activeScopeStore);
  const [refreshing, setRefreshing] = useState(false);

  const staleLabels = staleSourceLabels(state);
  const staleCount = staleLabels.length;
  const completeness = profileCompletenessPercent(state);
  const savedLabel = state._lastSavedAt
    ? `Last saved ${new Date(state._lastSavedAt).toLocaleString()}`
    : 'Not saved yet';
  const shownLabels = staleLabels.slice(0, 5).join(', ');
  const overflow = staleLabels.length > 5 ? ` +${staleLabels.length - 5} more` : '';
  const { liabilities } = totalNetWorth(state);

  const onRefresh = () => {
    setRefreshing(true);
    void refreshStaleData().finally(() => setRefreshing(false));
  };

  return (
    <section aria-label="Data quality and sync status">
      <Card className="flex flex-col gap-2">
        <CardTitle>Data quality</CardTitle>
        <TrustRow label="Quality">
          {staleCount === 0 ? 'Current' : `${staleCount} stale source${staleCount === 1 ? '' : 's'}`}
        </TrustRow>
        {staleCount > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-(--color-muted-foreground)" title="Refresh to update these values">
              {`Stale: ${shownLabels}${overflow}`}
            </span>
            <Button
              id="data-trust-refresh-btn"
              size="sm"
              variant="secondary"
              onClick={onRefresh}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing…' : 'Refresh now'}
            </Button>
          </div>
        ) : null}
        <TrustRow label="Scope">
          <strong id="scope-mode-label" className="font-semibold text-(--color-foreground)">
            {SCOPE_LABELS[scope]}
          </strong>
          <span>{` • ${savedLabel}`}</span>
        </TrustRow>
        <TrustRow label="Sync status">
          <span id="sync-status-value">{SYNC_STATUS_LABELS[sync]}</span>
        </TrustRow>
        <TrustRow label="Market data">
          <span id="market-refresh-value">{MARKET_REFRESH_LABELS[market]}</span>
        </TrustRow>
        <TrustRow label="Completeness">
          {`${completeness}% • Liabilities ${formatCurrency(liabilities, 0)}`}
        </TrustRow>
      </Card>
    </section>
  );
}
