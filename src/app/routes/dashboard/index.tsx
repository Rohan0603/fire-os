/**
 * Dashboard route.
 *
 * `Dashboard` is presentational: it renders KPI, trust, widget and chart cards
 * from a state snapshot plus benchmark history, so it can be rendered
 * deterministically (and statically) in tests. `DashboardRoute` supplies the
 * shared `appState`, kicks off the coalesced NAV/FX + benchmark refresh once on
 * mount, and re-renders on portfolio saves and market-refresh transitions —
 * the React replacement for the legacy `renderDashboard` + auto-refresh wiring.
 */
import { useEffect, useState } from 'react';
import { appState } from '../../../lib/appState';
import { createFeatureContext } from '../../../core/feature-context';
import { marketRefreshStatusStore } from '../../../core/stores';
import { refreshStaleData } from '../../../modules/dashboard';
import { useStore } from '../../hooks/use-store';
import { usePortfolioSaved } from '../../providers';
import type { HistoricalSeries } from '../../../types/api';
import type { FireOSState } from '../../../types/state';
import { BenchmarkCard, CompositionCard, FiGoalCard, NetWorthTrendCard } from './charts';
import { KpiRow, PortfolioSummary } from './kpi-cards';
import { CrashAlertBanner, DataTrustPanel } from './trust-panel';
import {
  AdvisorWidget,
  CashflowSummary,
  ExpenseTracker,
  SwpScheduleWidget,
  TaxOptimizationWidget,
} from './widgets';

export function Dashboard({
  state,
  history,
}: {
  state: FireOSState;
  history: HistoricalSeries | null;
}) {
  const swpEnabled = state.swpSchedule.enabled;

  return (
    <div className="flex flex-col gap-6">
      <CrashAlertBanner />
      <KpiRow state={state} />
      <CashflowSummary state={state} />
      <DataTrustPanel state={state} />
      <PortfolioSummary state={state} />

      {swpEnabled ? (
        <>
          <SwpScheduleWidget state={state} />
          <TaxOptimizationWidget state={state} />
          <AdvisorWidget state={state} />
          <ExpenseTracker state={state} />
        </>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <CompositionCard state={state} />
        <FiGoalCard state={state} />
        <NetWorthTrendCard state={state} />
        <BenchmarkCard history={history} />
      </div>
    </div>
  );
}

/** Refresh held-fund NAVs/FX and fetch benchmark history in parallel. */
async function refreshMarketData(): Promise<HistoricalSeries | null> {
  const context = createFeatureContext();
  const [history] = await Promise.all([
    context.ports.marketData.fetchNiftyHistory().catch(() => null),
    refreshStaleData(context).catch(() => undefined),
  ]);
  return history;
}

/** Route entry: wires the shared state, one-shot market refresh and saves. */
export function DashboardRoute() {
  // Re-render on portfolio saves and on market-refresh transitions so KPI
  // values reflect freshly fetched NAVs without an imperative repaint.
  usePortfolioSaved();
  useStore(marketRefreshStatusStore);

  const [history, setHistory] = useState<HistoricalSeries | null>(null);

  useEffect(() => {
    let cancelled = false;
    void refreshMarketData().then((result) => {
      if (!cancelled) setHistory(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <Dashboard state={appState} history={history} />;
}
