/**
 * Dashboard Module - Main entry point
 * Exports init(), render(), teardown() for tab-based rendering
 * Displays KPI cards, portfolio composition pie chart, and FI progress
 */

import {
  ArcElement,
  CategoryScale,
  Chart,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PieController,
  PointElement,
  Tooltip,
} from 'chart.js';
import { formatCurrency, formatNumber } from '../../lib/formatters';
import { createFeatureContext, type FeatureContext } from '../../core/feature-context';
import { getFundSchemeCode } from '../../lib/fundMatcher';
import { renderCoorgWidget } from './coorg-tracker';
import {
  CHART_RANGES,
  buildBenchmarkSeries,
  buildDrawdownSeries,
  buildSnapshotSeries,
  supportedRanges,
  windowFromRange,
  type ChartSeries,
  type DateWindow,
} from './chart-data';

import type { CrashAlert } from '../api/nifty-monitor';
import type { FireOSState } from '../../types/state';
import type { HistoricalSeries } from '../../types/api';
import type { SyncStatus } from '../../types/firebase';
import {
  activeScopeStore,
  marketRefreshStatusStore,
  syncStatusStore,
  type ActiveScopeStatus,
  type MarketRefreshStatus,
} from '../../core/stores';
import { totalNetWorth, type PortfolioCompositionKPI } from './kpis';
import { profileCompletenessPercent } from '../../lib/completeness';
import './styles.css';

Chart.register(
  PieController,
  ArcElement,
  Tooltip,
  Legend,
  LineController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
);

// Module state
let containerId = 'dashboard';
let currentCrashAlert: CrashAlert | null = null;
let activeContext = createFeatureContext();
let D = activeContext.state;
let themeListenerAttached = false;
let statusUnsubscribes: Array<() => void> = [];
let renderEpoch = 0;
let compositionChart: Chart | null = null;
let netWorthChart: Chart | null = null;
let benchmarkChart: Chart | null = null;
// Fetched market history for the benchmark card, refreshed on each render
// through the bounded history cache (see modules/api).
let benchmarkHistory: HistoricalSeries | null = null;
// Range/view selection for the analytics cards (reset on module init).
let netWorthRangeKey = 'all';
let benchmarkRangeKey = '1y';
let benchmarkView: 'performance' | 'drawdown' = 'performance';

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

function setStatusLabel(id: string, text: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

/**
 * Subscribe the trust-panel status labels to the reactive stores. Deduped:
 * every call first drops the previous subscriptions, so repeated dashboard
 * mounts never stack callbacks.
 */
function attachStatusSubscriptions(): void {
  detachStatusSubscriptions();
  statusUnsubscribes = [
    syncStatusStore.subscribe((status) => setStatusLabel('sync-status-value', SYNC_STATUS_LABELS[status])),
    marketRefreshStatusStore.subscribe((status) =>
      setStatusLabel('market-refresh-value', MARKET_REFRESH_LABELS[status]),
    ),
    activeScopeStore.subscribe((scope) => setStatusLabel('scope-mode-label', SCOPE_LABELS[scope])),
  ];
}

function detachStatusSubscriptions(): void {
  for (const unsubscribe of statusUnsubscribes) unsubscribe();
  statusUnsubscribes = [];
}

function handleThemeChanged(): void {
  const container = document.getElementById(containerId);
  if (container && container.innerHTML.trim() !== '') void renderDashboard();
}

function attachThemeListener(): void {
  if (themeListenerAttached) return;
  window.addEventListener('themeChanged', handleThemeChanged);
  themeListenerAttached = true;
}

/**
 * Fetch NAVs for all SIPs with units (holdings)
 * Triggered when portfolio data loads + dashboard renders
 * Fetches sequentially with 100ms delay to avoid API throttling
 */
export function fetchSIPNAVs(context: FeatureContext = activeContext): Promise<void> {
  return context.ports.marketData.refreshPortfolioNAVs(context.state);
}

/**
 * Update the current crash alert state
 * Called by monitoring module when crash detected
 * @param alert - CrashAlert object or null if cleared
 */
export function updateCrashAlert(alert: CrashAlert | null): void {
  currentCrashAlert = alert;
  // Re-render dashboard if it's visible
  const container = document.getElementById(containerId);
  if (container && container.offsetParent !== null) {
    // Container is visible, re-render to show alert
    renderDashboard();
  }
}


/**
 * Initialize the dashboard module
 * Called once when the app starts
 */
export function initDashboardModule(container: string = 'dashboard', context: FeatureContext = activeContext): void {
  containerId = container;
  activeContext = context;
  D = context.state;
  netWorthRangeKey = 'all';
  benchmarkRangeKey = '1y';
  benchmarkView = 'performance';
  benchmarkHistory = null;
  attachThemeListener();
}

/**
 * Render the dashboard UI
 * Called whenever data changes or user switches to Dashboard tab
 */
export async function renderDashboard(context: FeatureContext = activeContext): Promise<void> {
  const epoch = ++renderEpoch;
  attachThemeListener();
  activeContext = context;
  D = context.state;
  const container = document.getElementById(containerId);
  if (!container) return;

  // Render a loading spinner if cache is missing or stale
  const sipsToFetch = Object.entries(D.sip).filter(([, fund]) => fund.units && fund.units > 0);
  const hasStaleCache = sipsToFetch.some(([, fund]) => {
    const schemeCode = fund.schemeCode || getFundSchemeCode(fund.name);
    if (!schemeCode) return false;
    const cached = D.nav[schemeCode];
    // Cache TTL is 4 hours (14400000ms)
    return !cached || (Date.now() - new Date(cached.timestamp).getTime() > 4 * 60 * 60 * 1000);
  });

  if (hasStaleCache) {
    destroyCompositionChart();
    destroyNetWorthChart();
    destroyBenchmarkChart();
    container.innerHTML = `
      <div class="flex-col flex-align-center flex-justify-center gap-1 text-center" style="padding: 6rem 2rem;">
        <div class="loading-spinner"></div>
        <div style="color: var(--text-secondary); font-weight: 500; font-size: 1.1rem;">Updating portfolio NAVs and rates...</div>
      </div>
    `;
  }

  // Fetch fresh NAVs for active SIPs; start the benchmark history fetch in
  // parallel so the analytics card does not add render latency. A rejected
  // history fetch degrades only the benchmark card to its unavailable state.
  const benchmarkPromise = context.ports.marketData.fetchNiftyHistory().catch(() => null);
  await fetchSIPNAVs();

  // A newer render or a module teardown superseded this one while the fetch
  // was in flight (tab navigation unmounts without awaiting): drop it so a
  // retired render cannot repaint the container or re-attach subscriptions.
  if (epoch !== renderEpoch) return;

  // Resolve the parallel fetch locally and write the module value only after
  // the second guard: a superseded render must not clobber benchmark history
  // that a newer render or a teardown already established.
  const benchmarkResult = await benchmarkPromise;
  if (epoch !== renderEpoch) return;
  benchmarkHistory = benchmarkResult;

  // Calculate all KPIs from current state
  const netWorth = context.ports.calculations.totalNetWorth(D);
  const sip = context.ports.calculations.sipStatus(D);
  const fi = context.ports.calculations.fiProgress(D);
  const nifty = context.ports.calculations.floatIndicator(D);
  const composition = context.ports.calculations.portfolioComposition(D);

  // Analytics series are shaped from real source series only: persisted
  // snapshots for the trend card, fetched market history for the benchmark.
  const snapshotSeries = buildSnapshotSeries(D.netWorthHistory, currentSnapshotWindow());
  const { displayed: benchmarkSeries } = currentBenchmarkSeries();

  // Build the dashboard HTML (the previous canvas dies with the old markup)
  destroyCompositionChart();
  destroyNetWorthChart();
  destroyBenchmarkChart();
  container.innerHTML = `
    <div class="dashboard-container">
      <!-- Crash Alert (if present) -->
      ${currentCrashAlert ? renderCrashAlertBanner(currentCrashAlert) : ''}


      <!-- KPI Cards Grid -->
      <div class="kpi-grid">
        ${renderNetWorthCard(netWorth.netWorth, netWorth.assets, netWorth.liabilities)}
        ${renderSIPStatusCard(sip.totalCurrentValue, sip.totalInvested)}
        ${renderFIProgressCard(fi.progressPercent)}
        ${renderFloatIndicatorCard(nifty.drawdownPercent)}
      </div>

      <!-- Cashflow Summary Card -->
      ${context.ports.widgets.renderCashflowSummary(D)}

      ${renderDataTrustPanel(D)}

      <!-- Portfolio Summary Section -->
      ${renderPortfolioSummary(netWorth.breakdown, sip.totalCurrentValue, fi)}



      <!-- SWP Schedule Widget (if SWP enabled) -->
      ${D.swpSchedule?.enabled ? renderSWPScheduleWidget(D) : ''}

      <!-- Tax Optimization Widget (if SWP enabled) -->
      ${D.swpSchedule?.enabled ? renderTaxOptimizationWidget(D) : ''}

      <!-- Advisor Integration Widget (if SWP enabled) -->
      ${D.swpSchedule?.enabled ? context.ports.widgets.renderAdvisorIntegrationWidget(D) : ''}

      <!-- Expense Tracker Widget (if SWP enabled) -->
      ${D.swpSchedule?.enabled ? context.ports.widgets.renderExpenseTracker(D) : ''}

      <!-- Charts Section -->
      <div class="charts-section">
        ${renderCompositionChart(composition)}
        ${renderFIProgressChart(fi)}
        ${renderNetWorthTrendCard(snapshotSeries)}
        ${renderBenchmarkCard(benchmarkSeries)}
      </div>
    </div>
  `;

  // Attach event listeners
  attachDashboardEventListeners();
  attachStatusSubscriptions();
  mountCompositionChart('composition-chart', composition.categories);
  mountNetWorthChart('networth-chart', snapshotSeries);
  mountBenchmarkChart('benchmark-chart', benchmarkSeries);
}

/**
 * Human labels for cached NAVs of held funds and FX rates that are past their
 * TTL, so the trust panel can say which values are stale instead of only how
 * many. `status` is absent on entries restored from persistence before the
 * first refresh, so freshness falls back to the entry timestamp.
 */
function staleSourceLabels(state: FireOSState): string[] {
  const namesByCode = new Map<string, string>();
  const holdings = [...Object.values(state.sip || {}), ...Object.values(state.mf || {})];
  for (const fund of holdings) {
    const schemeCode = fund.schemeCode || getFundSchemeCode(fund.name);
    if (schemeCode && !namesByCode.has(schemeCode)) namesByCode.set(schemeCode, fund.name);
  }
  const isStale = (timestamp: string, ttl: number | undefined, status?: string): boolean =>
    status ? status === 'stale' : Date.now() - new Date(timestamp).getTime() > (ttl ?? 4 * 60 * 60 * 1000);
  const navLabels = Object.values(state.nav || {})
    .filter((entry) => isStale(entry.timestamp, entry.ttl, entry.status))
    .map((entry) => namesByCode.get(entry.schemeCode))
    .filter((name): name is string => Boolean(name));
  const currencyLabels = Object.entries(state.currencyRates || {})
    .filter(([, entry]) => entry.status === 'stale')
    .map(([key, entry]) =>
      entry.sourceCurrency && entry.targetCurrency
        ? `${entry.sourceCurrency}→${entry.targetCurrency} rate`
        : `${key} rate`,
    );
  return [...navLabels, ...currencyLabels];
}

function renderDataTrustPanel(state: FireOSState): string {
  const staleLabels = staleSourceLabels(state);
  const staleCount = staleLabels.length;
  const scopeLabel = SCOPE_LABELS[activeScopeStore.get()];
  const completeness = profileCompletenessPercent(state);
  const { liabilities } = totalNetWorth(state);
  const savedLabel = state._lastSavedAt ? `Last saved ${new Date(state._lastSavedAt).toLocaleString()}` : 'Not saved yet';
  const shownLabels = staleLabels.slice(0, 5).join(', ');
  const overflow = staleLabels.length > 5 ? ` +${staleLabels.length - 5} more` : '';
  return `<section class="data-trust-panel" aria-label="Data quality and sync status">
    <div><strong>Data quality</strong><span>${staleCount === 0 ? 'Current' : `${staleCount} stale source${staleCount === 1 ? '' : 's'}`}</span></div>
    ${staleCount > 0 ? `<div class="data-trust-stale"><span title="Refresh to update these values">Stale: ${shownLabels}${overflow}</span><button type="button" id="data-trust-refresh-btn">Refresh now</button></div>` : ''}
    <div><strong id="scope-mode-label">${scopeLabel}</strong><span>${savedLabel}</span></div>
    <div><strong>Sync status</strong><span id="sync-status-value">${SYNC_STATUS_LABELS[syncStatusStore.get()]}</span></div>
    <div><strong>Market data</strong><span id="market-refresh-value">${MARKET_REFRESH_LABELS[marketRefreshStatusStore.get()]}</span></div>
    <div><strong>Completeness</strong><span>${completeness}% • Liabilities ${formatCurrency(liabilities, 0)}</span></div>
  </section>`;
}

/**
 * Render individual KPI cards with data and formatting
 */
function renderNetWorthCard(value: number, assets: number, liabilities: number): string {
  return `
    <div class="kpi-card neutral">
      <div class="kpi-card-title">Total Net Worth</div>
      <div class="kpi-card-value">${formatCurrency(value, 0)}</div>
      <div class="kpi-card-subtitle">Assets ${formatCurrency(assets, 0)} • Liabilities ${formatCurrency(liabilities, 0)}</div>
    </div>
  `;
}

function renderSIPStatusCard(currentValue: number, invested: number): string {
  const pl = currentValue - invested;
  const cardClass = pl >= 0 ? 'positive' : 'negative';

  return `
    <div class="kpi-card ${cardClass}">
      <div class="kpi-card-title">SIP P&L</div>
      <div class="kpi-card-value">${formatCurrency(pl, 0)}</div>
      <div class="kpi-card-subtitle">Invested Value ₹${formatNumber(invested)} • Current ${formatCurrency(currentValue, 0)}</div>
    </div>
  `;
}

function renderFIProgressCard(progressPercent: number): string {
  const displayPercent = Math.min(progressPercent, 100); // Cap at 100%
  const cardClass = progressPercent >= 100 ? 'positive' : 'neutral';

  return `
    <div class="kpi-card ${cardClass}">
      <div class="kpi-card-title">FI Progress</div>
      <div class="kpi-card-value">${displayPercent.toFixed(0)}%</div>
      <div class="kpi-card-subtitle">${progressPercent >= 100 ? 'Financial Freedom Achieved!' : 'Towards FI goal'}</div>
    </div>
  `;
}

function renderFloatIndicatorCard(drawdownPercent: number): string {
  const cardClass = drawdownPercent > 15 ? 'positive' : drawdownPercent > 5 ? 'neutral' : 'positive';

  return `
    <div class="kpi-card ${cardClass}">
      <div class="kpi-card-title">Market Drawdown</div>
      <div class="kpi-card-value">${drawdownPercent.toFixed(0)}%</div>
      <div class="kpi-card-subtitle">From 52-week high</div>
    </div>
  `;
}

/**
 * Render crash alert banner
 * Displays at top of dashboard when crash detected
 */
function renderCrashAlertBanner(alert: CrashAlert): string {
  const iconMap = {
    low: '⚠️',
    medium: '⚠️',
    high: '🔴',
    critical: '🔴',
  };

  const icon = iconMap[alert.severity];

  return `
    <div class="crash-alert-banner alert-${alert.severity}">
      <div class="crash-alert-content">
        <span class="crash-alert-icon">${icon}</span>
        <div class="crash-alert-text">
          <strong>Nifty crashed ${alert.crashPercentage}%!</strong>
          <p>Deploy ₹${formatNumber(alert.deployAmount || 0)} via Wint Wealth (Crash Protocol)</p>
        </div>
      </div>
    </div>
  `;
}


/**
 * Render Portfolio Summary Section
 */
function renderPortfolioSummary(breakdown: any, sipValue: number, fi: any): string {
  return `
    <div class="portfolio-summary">
      <div class="portfolio-summary-grid">
        <div class="portfolio-summary-item">
          <div class="portfolio-summary-label">Total Corpus</div>
          <div class="portfolio-summary-value">${formatCurrency(fi.currentCorpus, 0)}</div>
        </div>
        <div class="portfolio-summary-item">
          <div class="portfolio-summary-label">FI Target</div>
          <div class="portfolio-summary-value">${formatCurrency(fi.fiTarget, 0)}</div>
        </div>
        <div class="portfolio-summary-item">
          <div class="portfolio-summary-label">Annual Expenses</div>
          <div class="portfolio-summary-value">${formatCurrency((D.profile.annualExpenses || 0) * 12, 0)}</div>
        </div>
        <div class="portfolio-summary-item">
          <div class="portfolio-summary-label">Monthly Buffer</div>
          <div class="portfolio-summary-value">${formatCurrency(D.profile.annualExpenses || 0, 0)}</div>
        </div>
      </div>

      <!-- FI Progress Bar -->
      <div class="fi-progress-section">
        <div class="fi-progress-title">Financial Independence Progress</div>
        <div class="fi-progress-bar-container">
          <div class="fi-progress-bar-fill" style="width: ${Math.min(fi.progressPercent, 100)}%">
            <span class="fi-progress-percent">${fi.progressPercent.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      <!-- Coorg Goal Widget -->
      ${renderCoorgWidget(D)}
    </div>
  `;
}



/**
 * Render Portfolio Composition Pie Chart
 */
function renderCompositionChart(composition: any): string {
  if (composition.categories.length === 0) {
    return `
      <div class="chart-container">
        <div class="chart-title">Portfolio Composition</div>
        <div class="dashboard-empty" style="padding: 2rem;">
          <div class="dashboard-empty-message">No holdings yet. Add data in Profile tab.</div>
        </div>
      </div>
    `;
  }

  const colors = ['var(--accent)', 'var(--status-good-text)', 'var(--status-warn-text)', 'var(--status-bad-text)', '#6f42c1', '#20c997', '#fd7e14'];
  const legendHtml = composition.categories
    .map(
      (cat: any, idx: number) => `
    <div class="legend-item">
      <div class="legend-color" style="background-color: ${colors[idx % colors.length]}"></div>
      <div>
        <div style="color: var(--text-primary);">${cat.name}</div>
        <div style="font-size: 0.8rem; color: var(--text-secondary);">${cat.percentage.toFixed(0)}% • ${formatCurrency(cat.value, 0)}</div>
      </div>
    </div>
  `
    )
    .join('');

  const ariaLabel = `Portfolio composition: ${composition.categories
    .map((cat: any) => `${cat.name} ${cat.percentage.toFixed(0)}%`)
    .join(', ')}`;

  return `
    <div class="chart-container">
      <div class="chart-title">📊 Portfolio Breakdown</div>
      <div class="pie-chart">
        <canvas id="composition-chart" role="img" aria-label="${ariaLabel}"></canvas>
      </div>
      <div class="pie-chart-legend">
        ${legendHtml}
      </div>
    </div>
  `;
}

/**
 * Render FI Progress Chart
 */
function renderFIProgressChart(fi: any): string {
  const remaining = Math.max(0, fi.fiTarget - fi.currentCorpus);

  return `
    <div class="chart-container">
      <div class="chart-title" style="color: var(--text-primary);">📈 FI Goal Progress</div>
      <div class="line-chart" id="fi-progress-chart">
        <div style="padding: 2rem; text-align: center;">
          <div style="font-size: 3rem; font-weight: 700; color: var(--accent);">${fi.progressPercent.toFixed(0)}%</div>
          <div style="color: var(--text-secondary); margin-top: 1rem;">
            <div>${formatCurrency(fi.currentCorpus, 0)} / ${formatCurrency(fi.fiTarget, 0)}</div>
            <div style="font-size: 0.9rem; margin-top: 0.5rem; color: ${remaining > 0 ? 'var(--text-tertiary)' : 'var(--status-good-text)'};">
              ${remaining > 0 ? `${formatCurrency(remaining, 0)} remaining` : '✨ FI Achieved!'}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Resolve a CSS theme variable with a fallback (same convention as the
 * composition chart so theme switches pick up current colors).
 */
function resolveCss(variable: string, fallback: string): string {
  if (typeof getComputedStyle !== 'function') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback;
}

function rangeMonths(key: string): number {
  return CHART_RANGES.find((range) => range.key === key)?.months ?? 0;
}

function currentSnapshotWindow(): DateWindow | null {
  return windowFromRange(
    D.netWorthHistory.map((snapshot) => snapshot.date),
    rangeMonths(netWorthRangeKey),
  );
}

function currentBenchmarkWindow(): DateWindow | null {
  return windowFromRange(
    (benchmarkHistory?.points ?? []).map((point) => point.date),
    rangeMonths(benchmarkRangeKey),
  );
}

/** Raw benchmark series plus the active view (performance or drawdown). */
function currentBenchmarkSeries(): { raw: ChartSeries; displayed: ChartSeries } {
  const raw = buildBenchmarkSeries(benchmarkHistory, currentBenchmarkWindow());
  const displayed = benchmarkView === 'drawdown' ? buildDrawdownSeries(raw) : raw;
  return { raw, displayed };
}

/** Plain-text provenance line: source, freshness, coverage, span, point count. */
function seriesMetaText(series: ChartSeries): string {
  const { meta, points } = series;
  const parts: string[] = [meta.source || 'unknown source'];
  parts.push(meta.status === 'stale' ? 'stale (cached)' : meta.status);
  if (meta.fetchedAt) parts.push(`fetched ${meta.fetchedAt.slice(0, 10)}`);
  if (points.length > 0) {
    parts.push(`${points.length} points`, `${points[0].date} to ${points[points.length - 1].date}`);
  }
  if (meta.coverage === 'partial') parts.push('partial coverage');
  if (meta.coverage === 'gaps-expected') parts.push('gaps are days without a snapshot');
  return parts.join(' • ');
}

function seriesAriaText(series: ChartSeries): string {
  const { meta, points } = series;
  if (points.length === 0) return `${meta.label}: no data points`;
  return `${meta.label}: ${points.length} points from ${points[0].date} to ${
    points[points.length - 1].date
  }, source ${meta.source}, status ${meta.status}`;
}

/**
 * Render the net-worth trend card. Shows the recorded snapshots only; an
 * empty history renders an empty state with no range controls or canvas.
 */
function renderNetWorthTrendCard(series: ChartSeries): string {
  const title = '<div class="chart-title">📉 Net Worth Trend</div>';
  if (series.points.length === 0) {
    return `
      <div class="chart-container">
        ${title}
        <div class="dashboard-empty" style="padding: 2rem 1rem;">
          <div class="dashboard-empty-message">No history recorded yet. Snapshots are taken automatically.</div>
        </div>
      </div>
    `;
  }

  const support = supportedRanges(D.netWorthHistory.map((snapshot) => snapshot.date));
  const buttons = support
    .map(
      (range) => `
      <button type="button" class="chart-range-btn" id="nw-range-${range.key}" aria-pressed="${
        range.key === netWorthRangeKey
      }" ${range.enabled ? '' : 'disabled'}>${range.label}</button>`,
    )
    .join('');

  return `
    <div class="chart-container">
      ${title}
      <div class="chart-meta" id="networth-chart-meta">${seriesMetaText(series)}</div>
      <div class="chart-range-controls" role="group" aria-label="Net worth trend range">${buttons}</div>
      <div class="line-chart">
        <canvas id="networth-chart" role="img" aria-label="${seriesAriaText(series)}"></canvas>
      </div>
    </div>
  `;
}

/**
 * Render the Nifty benchmark card. The meta line always identifies provider,
 * freshness and span, and the series is market benchmark data only — never
 * the user's portfolio return. Missing history renders an unavailable state
 * without controls or a canvas; current-value KPIs are unaffected.
 */
function renderBenchmarkCard(displayed: ChartSeries): string {
  const title = '<div class="chart-title">📈 Nifty 50 Benchmark</div>';
  if (displayed.points.length === 0) {
    return `
      <div class="chart-container">
        ${title}
        <div class="dashboard-empty" style="padding: 2rem 1rem;">
          <div class="dashboard-empty-message">Market history unavailable — current dashboard values are unaffected.</div>
        </div>
      </div>
    `;
  }

  const rangeButtons = CHART_RANGES.map(
    (range) => `
      <button type="button" class="chart-range-btn" id="bm-range-${range.key}" aria-pressed="${
      range.key === benchmarkRangeKey
    }">${range.label}</button>`,
  ).join('');
  const viewButtons = ([
    ['performance', 'Performance'],
    ['drawdown', 'Drawdown'],
  ] as const)
    .map(
      ([view, label]) => `
      <button type="button" class="chart-range-btn" id="bm-view-${view}" aria-pressed="${
        view === benchmarkView
      }">${label}</button>`,
    )
    .join('');

  return `
    <div class="chart-container">
      ${title}
      <div class="chart-meta" id="benchmark-chart-meta">${seriesMetaText(displayed)}</div>
      <div class="chart-controls-row">
        <div class="chart-range-controls" role="group" aria-label="Benchmark range">${rangeButtons}</div>
        <div class="chart-range-controls" role="group" aria-label="Benchmark view">${viewButtons}</div>
      </div>
      <div class="line-chart">
        <canvas id="benchmark-chart" role="img" aria-label="${seriesAriaText(displayed)}"></canvas>
      </div>
    </div>
  `;
}

function setPressedState(id: string, pressed: boolean): void {
  const element = document.getElementById(id) as { setAttribute?: (name: string, value: string) => void } | null;
  if (!element || typeof element.setAttribute !== 'function') return;
  element.setAttribute('aria-pressed', pressed ? 'true' : 'false');
}

function setAriaLabel(id: string, label: string): void {
  const element = document.getElementById(id) as { setAttribute?: (name: string, value: string) => void } | null;
  if (!element || typeof element.setAttribute !== 'function') return;
  element.setAttribute('aria-label', label);
}

/**
 * Rebuild the net-worth trend chart and its provenance line in place after a
 * range change (no full dashboard repaint, so no NAV refetch).
 */
function refreshNetWorthTrendChart(): void {
  const series = buildSnapshotSeries(D.netWorthHistory, currentSnapshotWindow());
  setStatusLabel('networth-chart-meta', seriesMetaText(series));
  for (const option of CHART_RANGES) {
    setPressedState(`nw-range-${option.key}`, option.key === netWorthRangeKey);
  }
  setAriaLabel('networth-chart', seriesAriaText(series));
  mountNetWorthChart('networth-chart', series);
}

/** Rebuild the benchmark chart after a range or view change. */
function refreshBenchmarkChart(): void {
  const { raw, displayed } = currentBenchmarkSeries();
  if (raw.points.length === 0) return;
  setStatusLabel('benchmark-chart-meta', seriesMetaText(displayed));
  for (const option of CHART_RANGES) {
    setPressedState(`bm-range-${option.key}`, option.key === benchmarkRangeKey);
  }
  setPressedState('bm-view-performance', benchmarkView === 'performance');
  setPressedState('bm-view-drawdown', benchmarkView === 'drawdown');
  setAriaLabel('benchmark-chart', seriesAriaText(displayed));
  mountBenchmarkChart('benchmark-chart', displayed);
}

function attachChartButtonListener(id: string, onClick: () => void): void {
  const element = document.getElementById(id) as { addEventListener?: (type: string, listener: () => void) => void } | null;
  if (!element || typeof element.addEventListener !== 'function') return;
  element.addEventListener('click', onClick);
}

/**
 * Destroy the live composition chart instance, if any.
 * Called before the dashboard markup (and its canvas) is replaced and on
 * module teardown so no canvas or Chart.js listeners survive a rerender.
 */
export function destroyCompositionChart(): void {
  if (!compositionChart) return;
  compositionChart.destroy();
  compositionChart = null;
}

/**
 * Create the composition pie chart, replacing any previous instance.
 * No-ops without a canvas or usable 2D context (headless tests, odd
 * browsers): the HTML legend and labels still render.
 */
export function mountCompositionChart(
  canvasId: string,
  categories: PortfolioCompositionKPI['categories'],
): void {
  destroyCompositionChart();

  const total = categories.reduce((sum, cat) => sum + cat.value, 0);
  if (total <= 0) return;

  const ctx = getChartContext(canvasId);
  if (!ctx) return;

  const colors = [
    resolveCss('--accent', '#007bff'),
    resolveCss('--status-good-text', '#28a745'),
    resolveCss('--status-warn-text', '#ffc107'),
    resolveCss('--status-bad-text', '#dc3545'),
    '#6f42c1',
    '#20c997',
    '#fd7e14',
  ];

  compositionChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: categories.map((cat) => cat.name),
      datasets: [
        {
          data: categories.map((cat) => cat.value),
          backgroundColor: categories.map((_, idx) => colors[idx % colors.length]),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        // The HTML legend below the canvas is the accessible, always-visible legend.
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => {
              const cat = categories[item.dataIndex];
              return `${cat.name}: ${formatCurrency(cat.value, 0)} (${cat.percentage.toFixed(0)}%)`;
            },
          },
        },
      },
    },
  });
}

/**
 * Resolve a canvas and its 2D context, or null when unavailable (headless
 * tests, odd browsers): charts then no-op and HTML labels still render.
 */
function getChartContext(canvasId: string): CanvasRenderingContext2D | null {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas || typeof canvas.getContext !== 'function') return null;
  try {
    return canvas.getContext('2d');
  } catch {
    return null;
  }
}

/**
 * Create a line chart for an already shaped series. Chart.js config only:
 * the data comes untouched from chart-data, the HTML meta line carries
 * source/freshness, and the built-in legend stays off in favor of that line.
 */
function createLineChart(
  canvasId: string,
  series: ChartSeries,
  color: string,
  formatValue: (value: number) => string,
): Chart | null {
  if (series.points.length === 0) return null;
  const ctx = getChartContext(canvasId);
  if (!ctx) return null;

  const axisColor = resolveCss('--text-tertiary', '#888888');
  const gridColor = resolveCss('--card-border', 'rgba(148, 163, 184, 0.25)');

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: series.points.map((point) => point.date),
      datasets: [
        {
          label: series.meta.label,
          data: series.points.map((point) => point.value),
          borderColor: color,
          backgroundColor: color,
          borderWidth: 2,
          pointRadius: series.points.length > 60 ? 0 : 2,
          pointHoverRadius: 4,
          // Straight segments between recorded points: bezier curves would
          // imply values that were never recorded.
          tension: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        // The chart-meta HTML line above the canvas is the accessible legend.
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => `${series.meta.label}: ${formatValue(Number(item.parsed.y))}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: axisColor, maxTicksLimit: 8, maxRotation: 0 },
          grid: { color: gridColor },
        },
        y: {
          ticks: { color: axisColor, callback: (value) => formatValue(Number(value)) },
          grid: { color: gridColor },
        },
      },
    },
  });
}

/**
 * Destroy the live net-worth trend chart, if any (rerender + teardown paths).
 */
export function destroyNetWorthChart(): void {
  if (!netWorthChart) return;
  netWorthChart.destroy();
  netWorthChart = null;
}

/**
 * Destroy the live benchmark chart, if any (rerender + teardown paths).
 */
export function destroyBenchmarkChart(): void {
  if (!benchmarkChart) return;
  benchmarkChart.destroy();
  benchmarkChart = null;
}

/**
 * Create the net-worth trend line chart, replacing any previous instance.
 * No-ops on empty series or without a 2D context (headless tests).
 */
export function mountNetWorthChart(canvasId: string, series: ChartSeries): void {
  destroyNetWorthChart();
  netWorthChart = createLineChart(
    canvasId,
    series,
    resolveCss('--accent', '#F59E0B'),
    (value) => formatCurrency(value, 0),
  );
}

/**
 * Create the benchmark chart for the active view (performance = provider
 * index level, drawdown = percent below the window running maximum). No-ops
 * on empty series or without a 2D context (headless tests).
 */
export function mountBenchmarkChart(canvasId: string, series: ChartSeries): void {
  destroyBenchmarkChart();
  const color =
    benchmarkView === 'drawdown'
      ? resolveCss('--status-bad-text', '#dc3545')
      : '#6f42c1';
  const formatValue =
    benchmarkView === 'drawdown'
      ? (value: number) => `${value.toFixed(1)}%`
      : (value: number) => formatNumber(value, 0);
  benchmarkChart = createLineChart(canvasId, series, color, formatValue);
}

/**
 * Attach event listeners to dashboard elements
 */
function attachDashboardEventListeners(): void {
  // Analytics chart range/view controls: rebuild only the affected chart in
  // place (guards keep this a no-op where elements are stubs without DOM APIs).
  for (const option of CHART_RANGES) {
    attachChartButtonListener(`nw-range-${option.key}`, () => {
      netWorthRangeKey = option.key;
      refreshNetWorthTrendChart();
    });
    attachChartButtonListener(`bm-range-${option.key}`, () => {
      benchmarkRangeKey = option.key;
      refreshBenchmarkChart();
    });
  }
  attachChartButtonListener('bm-view-performance', () => {
    benchmarkView = 'performance';
    refreshBenchmarkChart();
  });
  attachChartButtonListener('bm-view-drawdown', () => {
    benchmarkView = 'drawdown';
    refreshBenchmarkChart();
  });

  // Manual retry for stale NAV/FX entries: re-fetch, then repaint so the
  // stale list and count reflect what the refresh actually recovered. The
  // refresh port coalesces concurrent calls, so repeats are harmless.
  attachChartButtonListener('data-trust-refresh-btn', () => {
    fetchSIPNAVs()
      .catch(() => undefined)
      .finally(() => {
        void renderDashboard();
      });
  });

  // Advisor review button event listener
  const advisorBtn = document.getElementById('request-advisor-review-btn');
  if (advisorBtn) {
    advisorBtn.addEventListener('click', async () => {
      advisorBtn.setAttribute('disabled', 'true');
      advisorBtn.textContent = '⏳ Requesting...';
      try {
        const { netWorth } = activeContext.ports.calculations.totalNetWorth(D);
        const holdings: Record<string, number> = {
          PPFCF: 0,
          NipponGrowth: 0,
          NipponSmallCap: 0,
          Gold: 0,
        };

        const processFund = (fund: any) => {
          const schemeCode = fund.schemeCode || getFundSchemeCode(fund.name);
          const nav = schemeCode ? D.nav[schemeCode]?.nav ?? 0 : 0;
          const value = fund.units * nav;
          if (value > 0) {
            if (schemeCode === '122639') holdings.PPFCF += value;
            else if (schemeCode === '118668') holdings.NipponGrowth += value;
            else if (schemeCode === '118778') holdings.NipponSmallCap += value;
            else if (schemeCode === '135106') holdings.Gold += value;
          }
        };

        if (D.sip) Object.values(D.sip).forEach(processFund);
        if (D.mf) Object.values(D.mf).forEach(processFund);

        const drift = activeContext.ports.calculations.calculateAllocationDrift(holdings, netWorth);

        const result = await activeContext.ports.widgets.registerAdvisorReview({
          userEmail: D.currentUser?.email || 'user@example.com',
          portfolioSummary: {
            totalCorpus: netWorth,
            allocation: drift.current,
          },
        });

        if (result.status === 'review_request_sent' && result.reviewUrl) {
          activeContext.ports.ui.showToast('✓ Review request sent! Opening link...', 3000, 'success');
          window.open(result.reviewUrl, '_blank');
        } else {
          activeContext.ports.ui.showToast(result.error || 'Failed to request review', 4000, 'warning');
        }
      } catch {
        activeContext.ports.ui.showToast('Error requesting review', 4000, 'warning');
      } finally {
        advisorBtn.removeAttribute('disabled');
        advisorBtn.textContent = 'Request Review';
      }
    });
  }

  // Add Expense button event listener
  const addExpenseBtn = document.getElementById('add-expense-btn');
  if (addExpenseBtn) {
    addExpenseBtn.addEventListener('click', () => {
      const modalContent = `
        <div class="form-container" style="display: flex; flex-direction: column; gap: 1.25rem;">
          <div class="form-group" style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label for="expense-amount" style="font-size: 0.9rem; font-weight: 500; color: #e0e0e0;">Amount (₹)</label>
            <input type="number" id="expense-amount" placeholder="e.g. 5000" style="padding: 0.875rem 1rem; background: #2d2d2d; border: 1px solid #3a3a3a; border-radius: 8px; font-size: 1rem; color: #ffffff; outline: none; box-sizing: border-box; width: 100%;">
          </div>
          <div class="form-group" style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label for="expense-category" style="font-size: 0.9rem; font-weight: 500; color: #e0e0e0;">Category</label>
            <select id="expense-category" style="padding: 0.875rem 1rem; background: #2d2d2d; border: 1px solid #3a3a3a; border-radius: 8px; font-size: 1rem; color: #ffffff; outline: none; cursor: pointer; box-sizing: border-box; width: 100%;">
              <option value="SWP">SWP</option>
              <option value="Rent">Rent</option>
              <option value="Food">Food</option>
              <option value="Travel">Travel</option>
              <option value="Utilities">Utilities</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div class="form-group" style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label for="expense-date" style="font-size: 0.9rem; font-weight: 500; color: #e0e0e0;">Date</label>
            <input type="date" id="expense-date" value="${new Date().toISOString().split('T')[0]}" style="padding: 0.875rem 1rem; background: #2d2d2d; border: 1px solid #3a3a3a; border-radius: 8px; font-size: 1rem; color: #ffffff; outline: none; box-sizing: border-box; width: 100%;">
          </div>
        </div>
      `;

      activeContext.ports.ui.createModal('Add Expense', modalContent, [
        {
          label: 'Cancel',
          onClick: () => activeContext.ports.ui.closeModal(),
        },
        {
          label: 'Add',
          isPrimary: true,
          onClick: () => {
            const amountInput = document.getElementById('expense-amount') as HTMLInputElement;
            const categorySelect = document.getElementById('expense-category') as HTMLSelectElement;
            const dateInput = document.getElementById('expense-date') as HTMLInputElement;

            const amount = parseFloat(amountInput.value);
            const category = categorySelect.value;
            const date = dateInput.value;

            if (!amount || amount <= 0) {
              activeContext.ports.ui.showToast('Please enter a valid positive amount', 4000, 'warning');
              return;
            }

            if (!D.expenses) {
              D.expenses = [];
            }

            D.expenses.push({
              date,
              category,
              amount,
              linkedToSWP: category === 'SWP',
            });

            activeContext.portfolio.save(D);

            activeContext.ports.ui.showToast('✓ Expense added successfully', 3000, 'success');
            activeContext.ports.ui.closeModal();
            renderDashboard();
          },
        },
      ]);
    });
  }
}

/**
 * Teardown the dashboard module
 * Called when user navigates away or app shuts down
 */
export function teardownDashboard(): void {
  renderEpoch += 1;
  destroyCompositionChart();
  destroyNetWorthChart();
  destroyBenchmarkChart();
  benchmarkHistory = null;
  window.removeEventListener('themeChanged', handleThemeChanged);
  themeListenerAttached = false;
  detachStatusSubscriptions();
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
  }
}

/**
 * Listen for state changes and re-render dashboard
 */
export function observeDashboardChanges(): void {
  renderDashboard();
}

/**
 * Render SWP Schedule Widget
 */
function renderSWPScheduleWidget(state: any): string {
  if (!state.swpSchedule?.enabled) return '';
  return `
    <div class="swp-schedule-widget">
      <h3>SWP Schedule</h3>
      <p>Status: Active</p>
      <p>Monthly Amount: ₹${(state.swpSchedule.monthlyAmount / 1000).toFixed(0)}K</p>
      <p>Start Date: ${state.swpSchedule.startDate}</p>
    </div>
  `;
}

/**
 * Render Tax Optimization Widget
 */
function renderTaxOptimizationWidget(state: any): string {
  if (!state.swpSchedule?.enabled) return '';
  return `
    <div class="tax-optimization-widget">
      <h3>Tax Optimization</h3>
            <p>LTCG Harvest Target: ₹${(state.taxCalendar.harvestTarget / 100000).toFixed(0)}L</p>
      <p>Last Harvest: ${state.taxCalendar.lastLTCGHarvestDate || 'None'}</p>
    </div>
  `;
}
