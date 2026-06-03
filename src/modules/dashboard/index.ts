/**
 * Dashboard Module - Main entry point
 * Exports init(), render(), teardown() for tab-based rendering
 * Displays KPI cards, portfolio composition pie chart, and FI progress
 */

import { totalNetWorth, sipStatus, fiProgress, floatIndicator, portfolioComposition } from './kpis';
import { formatCurrency, formatPercentage, formatNumber } from '../../lib/formatters';
import { D } from '../../main';
import { fetchNAV, getNAVCacheMap } from '../api';
import { getFundSchemeCode } from '../../lib/fundMatcher';
import { renderCoorgWidget } from './coorg-tracker';

import type { CrashAlert } from '../api/nifty-monitor';
import type { WatchdogAlert } from '../watchdog/fund-manager-alerts';
import { renderAdvisorIntegrationWidget } from '../integrations/advisor-webhook';
import { renderExpenseTracker } from '../trackers/expense-tracker';
import './styles.css';

// Module state
let containerId = 'dashboard';
let currentChartType: 'pie' | 'line' = 'pie';
let currentCrashAlert: CrashAlert | null = null;
let currentWatchdogAlerts: WatchdogAlert[] = [];

/**
 * Fetch NAVs for all SIPs with units (holdings)
 * Triggered when portfolio data loads + dashboard renders
 * Fetches sequentially with 100ms delay to avoid API throttling
 */
export async function fetchSIPNAVs(): Promise<void> {
  const sipsToFetch = Object.entries(D.sip).filter(([, fund]) => fund.units && fund.units > 0);

  for (const [key, fund] of sipsToFetch) {
    const schemeCode = fund.schemeCode || getFundSchemeCode(fund.name);
    if (schemeCode) {
      try {
        await fetchNAV(schemeCode);
        // Sync fetched NAV from cache to state.nav so KPI calc can find it
        const navCache = getNAVCacheMap();
        if (navCache[schemeCode]) {
          D.nav[schemeCode] = navCache[schemeCode];
        }
      } catch (e) {
        console.warn(`[Dashboard] Failed to fetch NAV for SIP ${key}:`, e);
      }
    }
    // Small delay between requests to avoid API throttling
    await new Promise(resolve => setTimeout(resolve, 100));
  }
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
 * Update watchdog alerts (fund health monitoring)
 * Called by watchdog monitoring when alerts are generated
 * @param alerts - Array of WatchdogAlert objects
 */
export function updateWatchdogAlerts(alerts: WatchdogAlert[]): void {
  currentWatchdogAlerts = alerts;
  // Re-render dashboard if it's visible
  const container = document.getElementById(containerId);
  if (container && container.offsetParent !== null) {
    // Container is visible, re-render to show alerts
    renderDashboard();
  }
}

/**
 * Initialize the dashboard module
 * Called once when the app starts
 */
export function initDashboardModule(container: string = 'dashboard'): void {
  containerId = container;
}

/**
 * Render the dashboard UI
 * Called whenever data changes or user switches to Dashboard tab
 */
export async function renderDashboard(): Promise<void> {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Fetch fresh NAVs for active SIPs
  await fetchSIPNAVs();

  // Calculate all KPIs from current state
  const netWorth = totalNetWorth(D);
  const sip = sipStatus(D);
  const fi = fiProgress(D);
  const nifty = floatIndicator(D);
  const composition = portfolioComposition(D);



  // Build the dashboard HTML
  container.innerHTML = `
    <div class="dashboard-container">
      <!-- Crash Alert (if present) -->
      ${currentCrashAlert ? renderCrashAlertBanner(currentCrashAlert) : ''}

      <!-- Watchdog Alerts (if present) -->
      ${currentWatchdogAlerts.length > 0 ? renderWatchdogAlertsBanner(currentWatchdogAlerts) : ''}

      <!-- KPI Cards Grid -->
      <div class="kpi-grid">
        ${renderNetWorthCard(netWorth.netWorth)}
        ${renderSIPStatusCard(sip.totalCurrentValue, sip.totalInvested)}
        ${renderFIProgressCard(fi.progressPercent)}
        ${renderFloatIndicatorCard(nifty.drawdownPercent)}
      </div>

      <!-- Portfolio Summary Section -->
      ${renderPortfolioSummary(netWorth.breakdown, sip.totalCurrentValue, fi)}



      <!-- SWP Schedule Widget (if SWP enabled) -->
      ${D.swpSchedule?.enabled ? renderSWPScheduleWidget(D) : ''}

      <!-- Tax Optimization Widget (if SWP enabled) -->
      ${D.swpSchedule?.enabled ? renderTaxOptimizationWidget(D) : ''}

      <!-- Advisor Integration Widget (if SWP enabled) -->
      ${D.swpSchedule?.enabled ? renderAdvisorIntegrationWidget(D) : ''}

      <!-- Expense Tracker Widget (if SWP enabled) -->
      ${D.swpSchedule?.enabled ? renderExpenseTracker(D) : ''}

      <!-- Charts Section -->
      <div class="charts-section">
        ${renderCompositionChart(composition)}
        ${renderFIProgressChart(fi)}
      </div>
    </div>
  `;

  // Attach event listeners
  attachDashboardEventListeners();
}

/**
 * Render individual KPI cards with data and formatting
 */
function renderNetWorthCard(value: number): string {
  return `
    <div class="kpi-card neutral">
      <div class="kpi-card-title">Total Net Worth</div>
      <div class="kpi-card-value">${formatCurrency(value, 0)}</div>
      <div class="kpi-card-subtitle">All holdings combined</div>
    </div>
  `;
}

function renderSIPStatusCard(currentValue: number, invested: number): string {
  const pl = currentValue - invested;
  const plPercent = invested > 0 ? (pl / invested) * 100 : 0;
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
      <div class="kpi-card-value">${displayPercent.toFixed(1)}%</div>
      <div class="kpi-card-subtitle">${progressPercent >= 100 ? 'Financial Freedom Achieved!' : 'Towards FI goal'}</div>
    </div>
  `;
}

function renderFloatIndicatorCard(drawdownPercent: number): string {
  const cardClass = drawdownPercent > 15 ? 'positive' : drawdownPercent > 5 ? 'neutral' : 'positive';

  return `
    <div class="kpi-card ${cardClass}">
      <div class="kpi-card-title">Market Drawdown</div>
      <div class="kpi-card-value">${drawdownPercent.toFixed(2)}%</div>
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
 * Render watchdog alerts banner
 * Displays fund health alerts (AUM breach, block threshold, manager exit)
 */
function renderWatchdogAlertsBanner(alerts: WatchdogAlert[]): string {
  // Helper to escape HTML special characters
  const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const iconMap: { [key: string]: string } = {
    'manager-exit': '🔴',
    'aum-breach': '⚠️',
    'block-threshold': '⚡',
  };

  const alertItems = alerts.map(alert => {
    const icon = iconMap[alert.type] || '⚠️';
    const alertClass = `watchdog-alert-item alert-${alert.severity}`;

    return `
      <div class="${alertClass}">
        <div class="watchdog-alert-header">
          <span class="watchdog-alert-icon">${icon}</span>
          <div class="watchdog-alert-title">${escapeHtml(alert.fund)}: ${alert.type.replace('-', ' ').toUpperCase()}</div>
        </div>
        <div class="watchdog-alert-message">${escapeHtml(alert.message)}</div>
        <div class="watchdog-alert-action">Action: ${escapeHtml(alert.action)}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="watchdog-alerts-banner">
      <div class="watchdog-alerts-title">📊 Fund Health Alerts</div>
      <div class="watchdog-alerts-list">
        ${alertItems}
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
          <div class="portfolio-summary-value">${formatCurrency(D.profile.annualExpenses, 0)}</div>
        </div>
        <div class="portfolio-summary-item">
          <div class="portfolio-summary-label">Monthly Buffer</div>
          <div class="portfolio-summary-value">${formatCurrency(D.profile.annualExpenses / 12, 0)}</div>
        </div>
      </div>

      <!-- FI Progress Bar -->
      <div class="fi-progress-section">
        <div class="fi-progress-title">Financial Independence Progress</div>
        <div class="fi-progress-bar-container">
          <div class="fi-progress-bar-fill" style="width: ${Math.min(fi.progressPercent, 100)}%">
            <span class="fi-progress-percent">${fi.progressPercent.toFixed(1)}%</span>
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
        <div style="font-size: 0.8rem; color: var(--text-secondary);">${cat.percentage.toFixed(1)}% • ${formatCurrency(cat.value, 0)}</div>
      </div>
    </div>
  `
    )
    .join('');

  return `
    <div class="chart-container">
      <div class="chart-title">📊 Portfolio Breakdown</div>
      <div class="pie-chart">
        <canvas id="composition-chart"></canvas>
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
          <div style="font-size: 3rem; font-weight: 700; color: var(--accent);">${fi.progressPercent.toFixed(1)}%</div>
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
 * Simple pie chart renderer using canvas
 */
function drawPieChart(canvasId: string, data: any[]): void {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  const computedStyle = getComputedStyle(document.documentElement);
  const colors = [
    computedStyle.getPropertyValue('--accent').trim() || '#007bff',
    computedStyle.getPropertyValue('--status-good-text').trim() || '#28a745',
    computedStyle.getPropertyValue('--status-warn-text').trim() || '#ffc107',
    computedStyle.getPropertyValue('--status-bad-text').trim() || '#dc3545',
    '#6f42c1', '#20c997', '#fd7e14'
  ];
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) return;

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 20;

  if (radius <= 0) return;

  let currentAngle = -Math.PI / 2;

  data.forEach((item, idx) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;

    // Draw slice
    ctx.fillStyle = colors[idx % colors.length];
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.closePath();
    ctx.fill();

    // Draw label
    const labelAngle = currentAngle + sliceAngle / 2;
    const labelX = centerX + Math.cos(labelAngle) * (radius * 0.65);
    const labelY = centerY + Math.sin(labelAngle) * (radius * 0.65);

    ctx.fillStyle = computedStyle.getPropertyValue('--text-inverse').trim() || '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const percentage = ((item.value / total) * 100).toFixed(0);
    if (parseFloat(percentage) > 5) {
      ctx.fillText(`${percentage}%`, labelX, labelY);
    }

    currentAngle += sliceAngle;
  });
}

/**
 * Attach event listeners to dashboard elements
 */
function attachDashboardEventListeners(): void {
  // Draw pie chart if data exists
  const canvas = document.getElementById('composition-chart');
  if (canvas) {
    const composition = portfolioComposition(D);
    if (composition.categories.length > 0) {
      drawPieChart('composition-chart', composition.categories);
    }
  }
}

// Re-render dashboard when theme changes to update canvas colors
window.addEventListener('themeChanged', () => {
  const container = document.getElementById(containerId);
  if (container && container.innerHTML.trim() !== '') {
    renderDashboard();
  }
});

/**
 * Teardown the dashboard module
 * Called when user navigates away or app shuts down
 */
export function teardownDashboard(): void {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
  }
}

/**
 * Listen for state changes and re-render dashboard
 */
export function observeDashboardChanges(): void {
  // Create a proxy that re-renders on any property change
  const handler = {
    set: (target: any, property: string, value: any) => {
      target[property] = value;
      // Debounce re-render to avoid excessive updates
      clearTimeout((window as any).dashboardRenderTimeout);
      (window as any).dashboardRenderTimeout = setTimeout(() => {
        renderDashboard();
      }, 500);
      return true;
    },
  };

  // Note: Full proxy wrapping would be done in main.ts
  // This is a helper that individual modules can call
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
      <p>LTCG Harvest Target: ₹${(state.taxCalendar.harvestTarget / 100000).toFixed(2)}L</p>
      <p>Last Harvest: ${state.taxCalendar.lastLTCGHarvestDate || 'None'}</p>
    </div>
  `;
}
