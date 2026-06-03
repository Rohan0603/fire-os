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
import './styles.css';

// Module state
let containerId = 'dashboard';
let currentChartType: 'pie' | 'line' = 'pie';

/**
 * Fetch NAVs for all SIPs with active monthly amounts
 * Triggered when dashboard loads to populate cache
 * Fetches sequentially with 100ms delay to avoid API throttling
 */
async function fetchSIPNAVs(): Promise<void> {
  const sipsToFetch = Object.entries(D.sip).filter(([, fund]) => fund.monthlyAmount && fund.monthlyAmount > 0);

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
      <!-- KPI Cards Grid -->
      <div class="kpi-grid">
        ${renderNetWorthCard(netWorth.netWorth)}
        ${renderSIPStatusCard(sip.totalCurrentValue, sip.totalInvested)}
        ${renderFIProgressCard(fi.progressPercent)}
        ${renderFloatIndicatorCard(nifty.drawdownPercent)}
      </div>

      <!-- Portfolio Summary Section -->
      ${renderPortfolioSummary(netWorth.breakdown, sip.totalCurrentValue, fi)}

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

  const colors = ['#0066cc', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#20c997', '#fd7e14'];
  const legendHtml = composition.categories
    .map(
      (cat: any, idx: number) => `
    <div class="legend-item">
      <div class="legend-color" style="background-color: ${colors[idx % colors.length]}"></div>
      <div>
        <div>${cat.name}</div>
        <div style="font-size: 0.8rem; color: #6c757d;">${cat.percentage.toFixed(1)}% • ${formatCurrency(cat.value, 0)}</div>
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
      <div class="chart-title">📈 FI Goal Progress</div>
      <div class="line-chart" id="fi-progress-chart">
        <div style="padding: 2rem; text-align: center;">
          <div style="font-size: 3rem; font-weight: 700; color: #0066cc;">${fi.progressPercent.toFixed(1)}%</div>
          <div style="color: #6c757d; margin-top: 1rem;">
            <div>${formatCurrency(fi.currentCorpus, 0)} / ${formatCurrency(fi.fiTarget, 0)}</div>
            <div style="font-size: 0.9rem; margin-top: 0.5rem;">
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

  const colors = ['#0066cc', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#20c997', '#fd7e14'];
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) return;

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 20;

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

    ctx.fillStyle = '#ffffff';
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
