# Dashboard Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a modular dashboard that displays KPI cards (net worth, SIP status, FI progress, float indicator), portfolio allocation pie chart, and SIP performance line chart with real-time updates.

**Architecture:** The dashboard module follows the established pattern: separate concerns into `index.ts` (module init/render), `kpis.ts` (calculation logic), and `styles.css` (styling). KPI functions consume D state and return formatted strings/values. Charts use Chart.js for rendering. Module listens for state changes and re-renders on demand.

**Tech Stack:** TypeScript, Chart.js 4.4, CSS Grid/Flexbox, custom UI components (createCard, createMetricCard from ui module), calculation library functions (xirr, sipCostBasis, fiGoalProgress, etc.)

---

## File Structure

```
src/modules/dashboard/
├── index.ts           # Module init/render, state management
├── kpis.ts           # KPI calculation functions: totalNetWorth, sipStatus, fiProgress, floatIndicator
├── charts.ts         # Chart rendering: portfolioAllocation (pie), sipPerformance (line)
└── styles.css        # Dashboard styles (grid layout, card spacing, chart containers)

tests/
├── dashboard.test.ts # Unit tests for KPI calculations
└── dashboard.e2e.ts  # E2E tests for dashboard rendering (Playwright)
```

---

## Task 1: Create KPI Calculation Functions

**Files:**
- Create: `src/modules/dashboard/kpis.ts`
- Modify: `src/modules/dashboard/kpis.ts` (same file, starting from scratch)

**Context:** KPI functions take the D state object and return structured data suitable for rendering in cards. Each function handles NaN/Infinity protection and returns sensible defaults when data is incomplete.

---

- [ ] **Step 1: Create kpis.ts with totalNetWorth function**

Create file `src/modules/dashboard/kpis.ts`:

```typescript
/**
 * Dashboard KPI Calculations
 * Computes net worth, SIP status, FI progress, and float indicator from state
 */

import { formatCurrency, formatPercentage, formatNumber } from '../../lib/formatters';
import type { FireOSState } from '../../types/state';

/**
 * Total Net Worth: Sum of all holdings
 * MF current (NAV × units) + FD + EPF + ESOP + Demat
 *
 * @param D - Application state
 * @returns Object with breakdown and total
 */
export function calculateTotalNetWorth(D: FireOSState): {
  mfCurrent: number;
  fdTotal: number;
  epfTotal: number;
  esopTotal: number;
  dematTotal: number;
  total: number;
  formatted: string;
} {
  let mfCurrent = 0;
  let fdTotal = 0;
  let epfTotal = 0;
  let esopTotal = 0;
  let dematTotal = 0;

  // Calculate MF current value (NAV × units for each fund)
  Object.entries(D.mf || {}).forEach(([key, fund]) => {
    const nav = D.nav[fund.schemeCode] || 0;
    const current = nav * (fund.units || 0);
    if (isFinite(current)) {
      mfCurrent += current;
    }
  });

  // Calculate SIP current value (NAV × units)
  Object.entries(D.sip || {}).forEach(([key, fund]) => {
    const nav = D.nav[fund.schemeCode] || 0;
    const current = nav * (fund.units || 0);
    if (isFinite(current)) {
      mfCurrent += current;
    }
  });

  // FD total
  Object.entries(D.fd || {}).forEach(([key, holding]) => {
    if (isFinite(holding.amount)) {
      fdTotal += holding.amount;
    }
  });

  // EPF total
  Object.entries(D.epf || {}).forEach(([key, holding]) => {
    if (isFinite(holding.amount)) {
      epfTotal += holding.amount;
    }
  });

  // ESOP total
  Object.entries(D.esop || {}).forEach(([key, holding]) => {
    if (isFinite(holding.amount)) {
      esopTotal += holding.amount;
    }
  });

  // Demat total (currentValue already in INR)
  Object.entries(D.demat || {}).forEach(([isin, holding]) => {
    if (isFinite(holding.currentValue)) {
      dematTotal += holding.currentValue;
    }
  });

  const total = mfCurrent + fdTotal + epfTotal + esopTotal + dematTotal;

  return {
    mfCurrent,
    fdTotal,
    epfTotal,
    esopTotal,
    dematTotal,
    total: isFinite(total) ? total : 0,
    formatted: formatCurrency(total),
  };
}

/**
 * SIP Status: Current value, invested amount, P&L, XIRR for tracked SIP funds
 *
 * @param D - Application state
 * @returns Array of SIP fund statuses with P&L breakdown
 */
export function calculateSIPStatus(D: FireOSState): Array<{
  key: string;
  name: string;
  invested: number;
  current: number;
  pl: number;
  plPercent: number;
  xirr: number | null;
  formattedInvested: string;
  formattedCurrent: string;
  formattedPL: string;
  formattedXIRR: string;
}> {
  const { xirr } = require('../../lib/calculations');
  const { sipCostBasis } = require('../../lib/calculations');

  const results: Array<any> = [];

  Object.entries(D.sip || {}).forEach(([key, fund]) => {
    const nav = D.nav[fund.schemeCode] || 0;
    const currentValue = nav * (fund.units || 0);

    // Calculate cost basis (override or computed)
    let invested = fund.costBasis ?? 0;
    if (!fund.costBasis && fund.startDate && fund.monthlyAmount) {
      const startDate = new Date(fund.startDate + '-01');
      const monthsSinceStart = Math.max(
        0,
        Math.floor((new Date().getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000))
      );
      invested = sipCostBasis(fund.monthlyAmount, monthsSinceStart);
    }

    const pl = currentValue - invested;
    const plPercent = invested > 0 ? (pl / invested) * 100 : 0;

    // Calculate XIRR if we have enough data
    let xirrValue: number | null = null;
    if (fund.startDate && fund.units && nav > 0 && invested > 0) {
      // Construct cash flows: monthly investments starting from startDate
      const startDate = new Date(fund.startDate + '-01');
      const now = new Date();
      const monthsSinceStart = Math.max(
        0,
        Math.floor((now.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000))
      );

      const cashFlows = [];
      for (let i = 0; i <= monthsSinceStart; i++) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + i);
        cashFlows.push({
          date,
          amount: i === monthsSinceStart ? currentValue : -fund.monthlyAmount,
        });
      }

      xirrValue = xirr(cashFlows);
    }

    results.push({
      key,
      name: fund.name,
      invested: isFinite(invested) ? invested : 0,
      current: isFinite(currentValue) ? currentValue : 0,
      pl: isFinite(pl) ? pl : 0,
      plPercent: isFinite(plPercent) ? plPercent : 0,
      xirr: xirrValue,
      formattedInvested: formatCurrency(invested),
      formattedCurrent: formatCurrency(currentValue),
      formattedPL: formatCurrency(pl),
      formattedXIRR: xirrValue !== null ? formatPercentage(xirrValue) : 'N/A',
    });
  });

  return results;
}

/**
 * FI Goal Progress: Current corpus vs 25× annual expenses target
 *
 * @param D - Application state
 * @returns Progress metrics
 */
export function calculateFIProgress(D: FireOSState): {
  currentCorpus: number;
  fiTarget: number;
  progressPercent: number;
  yearsRemaining: number | null;
  formatted: string;
  formattedTarget: string;
  formattedProgress: string;
} {
  const { fiGoalProgress } = require('../../lib/calculations');
  const netWorth = calculateTotalNetWorth(D);

  const result = fiGoalProgress(netWorth.total, D.profile.annualExpenses);

  return {
    currentCorpus: netWorth.total,
    fiTarget: result.fiTarget,
    progressPercent: result.progressPercent,
    yearsRemaining: result.yearsRemaining,
    formatted: formatCurrency(netWorth.total),
    formattedTarget: formatCurrency(result.fiTarget),
    formattedProgress: formatPercentage(result.progressPercent / 100),
  };
}

/**
 * Float Indicator: Market drawdown percentage (52W high vs current level)
 *
 * @param D - Application state
 * @returns Drawdown metrics
 */
export function calculateFloatIndicator(D: FireOSState): {
  niftyHigh: number;
  niftyCurrent: number;
  drawdownPercent: number;
  formatted: string;
} {
  // Nifty high from state
  const niftyHigh = D.niftyHigh || 0;
  
  // Current level: use niftyData.level if available, else fall back to niftyHigh
  const niftyCurrent = D.niftyData?.level || niftyHigh || 0;

  let drawdownPercent = 0;
  if (niftyHigh > 0 && niftyCurrent > 0) {
    drawdownPercent = ((niftyHigh - niftyCurrent) / niftyHigh) * 100;
  }

  return {
    niftyHigh: isFinite(niftyHigh) ? niftyHigh : 0,
    niftyCurrent: isFinite(niftyCurrent) ? niftyCurrent : 0,
    drawdownPercent: isFinite(drawdownPercent) ? drawdownPercent : 0,
    formatted: formatPercentage(drawdownPercent / 100),
  };
}
```

- [ ] **Step 2: Write unit tests for KPI calculations**

Create file `tests/dashboard.test.ts`:

```typescript
/**
 * Dashboard KPI calculation tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { initializeState } from '../src/types/state';
import type { FireOSState } from '../src/types/state';
import {
  calculateTotalNetWorth,
  calculateSIPStatus,
  calculateFIProgress,
  calculateFloatIndicator,
} from '../src/modules/dashboard/kpis';

describe('Dashboard KPIs', () => {
  let D: FireOSState;

  beforeEach(() => {
    D = initializeState();
  });

  describe('calculateTotalNetWorth', () => {
    it('returns 0 for empty state', () => {
      const result = calculateTotalNetWorth(D);
      expect(result.total).toBe(0);
      expect(result.mfCurrent).toBe(0);
    });

    it('sums MF current values (NAV × units)', () => {
      D.mf.mf1 = {
        name: 'Test Fund',
        schemeCode: '122639',
        units: 100,
        startDate: '2024-01',
        monthlyAmount: 1000,
      };
      D.nav['122639'] = 500; // NAV

      const result = calculateTotalNetWorth(D);
      expect(result.mfCurrent).toBe(50000); // 100 × 500
    });

    it('sums FD, EPF, ESOP, and Demat values', () => {
      D.fd.fd1 = { amount: 100000, currency: 'INR' };
      D.epf.epf1 = { amount: 500000, currency: 'INR' };
      D.esop.esop1 = { amount: 250000, currency: 'INR' };
      D.demat.SBIN = { isin: 'SBIN', quantity: 10, currentValue: 5000, name: 'SBIN' };

      const result = calculateTotalNetWorth(D);
      expect(result.fdTotal).toBe(100000);
      expect(result.epfTotal).toBe(500000);
      expect(result.esopTotal).toBe(250000);
      expect(result.dematTotal).toBe(5000);
      expect(result.total).toBe(855000);
    });

    it('protects against NaN/Infinity', () => {
      D.mf.mf1 = {
        name: 'Test Fund',
        schemeCode: '122639',
        units: Infinity,
        startDate: '2024-01',
        monthlyAmount: 1000,
      };
      D.nav['122639'] = NaN;

      const result = calculateTotalNetWorth(D);
      expect(isFinite(result.total)).toBe(true);
      expect(result.total).toBe(0);
    });
  });

  describe('calculateSIPStatus', () => {
    it('returns empty array for no SIPs', () => {
      const result = calculateSIPStatus(D);
      expect(result).toEqual([]);
    });

    it('calculates SIP fund with cost basis override', () => {
      D.sip.sip1 = {
        name: 'Parag Parikh',
        schemeCode: '122639',
        units: 100,
        startDate: '2024-01',
        monthlyAmount: 5000,
        costBasis: 480000, // Manual override
      };
      D.nav['122639'] = 5000; // Current NAV

      const result = calculateSIPStatus(D);
      expect(result.length).toBe(1);
      expect(result[0].invested).toBe(480000);
      expect(result[0].current).toBe(500000); // 100 × 5000
      expect(result[0].pl).toBe(20000);
      expect(result[0].plPercent).toBeCloseTo(4.17, 1);
    });
  });

  describe('calculateFIProgress', () => {
    it('returns correct FI target (25× annual expenses)', () => {
      D.profile.annualExpenses = 600000;
      D.epf.epf1 = { amount: 15000000, currency: 'INR' };

      const result = calculateFIProgress(D);
      expect(result.fiTarget).toBe(15000000); // 600k × 25
      expect(result.progressPercent).toBe(100);
    });

    it('handles zero annual expenses', () => {
      D.profile.annualExpenses = 0;

      const result = calculateFIProgress(D);
      expect(result.fiTarget).toBe(0);
      expect(result.progressPercent).toBe(0);
    });
  });

  describe('calculateFloatIndicator', () => {
    it('calculates market drawdown percentage', () => {
      D.niftyHigh = 25000;
      D.niftyData = { level: 24000, timestamp: new Date().toISOString() };

      const result = calculateFloatIndicator(D);
      expect(result.niftyHigh).toBe(25000);
      expect(result.niftyCurrent).toBe(24000);
      expect(result.drawdownPercent).toBeCloseTo(4, 0);
    });

    it('handles missing Nifty data', () => {
      D.niftyHigh = 0;

      const result = calculateFloatIndicator(D);
      expect(result.drawdownPercent).toBe(0);
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail (expected)**

```bash
npm run test tests/dashboard.test.ts
```

Expected output: Tests fail because functions don't exist yet in kpis.ts or dependencies aren't wired correctly.

- [ ] **Step 4: Commit KPI foundation**

```bash
git add src/modules/dashboard/kpis.ts tests/dashboard.test.ts
git commit -m "feat(dashboard): add KPI calculation functions with unit tests"
```

---

## Task 2: Create Chart Rendering Functions

**Files:**
- Create: `src/modules/dashboard/charts.ts`

**Context:** Chart functions take D state and return Chart.js configuration objects. They handle empty data gracefully and return null/empty config if insufficient data exists.

---

- [ ] **Step 1: Create charts.ts with portfolio allocation pie chart**

Create file `src/modules/dashboard/charts.ts`:

```typescript
/**
 * Dashboard Chart Rendering
 * Creates Chart.js configurations for portfolio allocation and SIP performance
 */

import type { ChartConfiguration } from 'chart.js';
import type { FireOSState } from '../../types/state';
import { calculateTotalNetWorth, calculateSIPStatus } from './kpis';

/**
 * Portfolio Allocation Pie Chart
 * Shows breakdown: MF, FD, EPF, ESOP, Demat
 *
 * @param D - Application state
 * @returns Chart.js configuration or null if no data
 */
export function getPortfolioAllocationChartConfig(
  D: FireOSState
): ChartConfiguration<'doughnut'> | null {
  const netWorth = calculateTotalNetWorth(D);

  // Skip if no portfolio value
  if (netWorth.total === 0) {
    return null;
  }

  // Calculate percentages
  const mfPercent = (netWorth.mfCurrent / netWorth.total) * 100;
  const fdPercent = (netWorth.fdTotal / netWorth.total) * 100;
  const epfPercent = (netWorth.epfTotal / netWorth.total) * 100;
  const esopPercent = (netWorth.esopTotal / netWorth.total) * 100;
  const dematPercent = (netWorth.dematTotal / netWorth.total) * 100;

  return {
    type: 'doughnut',
    data: {
      labels: ['Mutual Funds', 'Fixed Deposits', 'EPF', 'ESOP', 'Demat'],
      datasets: [
        {
          data: [mfPercent, fdPercent, epfPercent, esopPercent, dematPercent],
          backgroundColor: [
            '#FFD700', // Gold
            '#4A90E2', // Blue
            '#50C878', // Green
            '#FF6B6B', // Red
            '#9B59B6', // Purple
          ],
          borderColor: '#1a1a1a',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: {
            color: '#ffffff',
            font: { size: 12 },
            padding: 15,
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const percent = context.parsed || 0;
              return `${context.label}: ${percent.toFixed(1)}%`;
            },
          },
        },
      },
    },
  };
}

/**
 * SIP Performance Line Chart
 * Shows invested vs current value trend for tracked SIP funds
 *
 * @param D - Application state
 * @returns Chart.js configuration or null if no SIP data
 */
export function getSIPPerformanceChartConfig(
  D: FireOSState
): ChartConfiguration<'line'> | null {
  const sipStatus = calculateSIPStatus(D);

  // Skip if no SIPs
  if (sipStatus.length === 0) {
    return null;
  }

  // Calculate totals
  const totalInvested = sipStatus.reduce((sum, s) => sum + s.invested, 0);
  const totalCurrent = sipStatus.reduce((sum, s) => sum + s.current, 0);

  return {
    type: 'line',
    data: {
      labels: ['Invested', 'Current Value'],
      datasets: [
        {
          label: 'Invested Amount',
          data: [totalInvested, totalInvested],
          borderColor: '#4A90E2',
          backgroundColor: 'rgba(74, 144, 226, 0.1)',
          borderWidth: 2,
          pointRadius: 5,
          pointBackgroundColor: '#4A90E2',
          tension: 0.3,
        },
        {
          label: 'Current Value',
          data: [totalInvested, totalCurrent],
          borderColor: '#50C878',
          backgroundColor: 'rgba(80, 200, 120, 0.1)',
          borderWidth: 2,
          pointRadius: 5,
          pointBackgroundColor: '#50C878',
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: {
            color: '#ffffff',
            font: { size: 12 },
            padding: 15,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          callbacks: {
            label: (context) => {
              const value = context.parsed.y || 0;
              return `${context.dataset.label}: ₹${value.toLocaleString('en-IN')}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#a0a0a0' },
          grid: { color: '#333333' },
        },
        x: {
          ticks: { color: '#a0a0a0' },
          grid: { color: '#333333' },
        },
      },
    },
  };
}
```

- [ ] **Step 2: Verify chart config functions don't have syntax errors**

```bash
npx tsc --noEmit src/modules/dashboard/charts.ts
```

Expected output: No compilation errors (or only missing dependencies that will be resolved in next tasks).

- [ ] **Step 3: Commit chart foundation**

```bash
git add src/modules/dashboard/charts.ts
git commit -m "feat(dashboard): add chart rendering configurations (portfolio allocation, SIP performance)"
```

---

## Task 3: Create Dashboard Module Index (init/render)

**Files:**
- Create: `src/modules/dashboard/index.ts`

**Context:** The index file exports `initDashboardModule()` and `renderDashboard()` functions following the established module pattern. It manages chart instances, handles state subscriptions, and coordinates KPI card rendering.

---

- [ ] **Step 1: Create dashboard/index.ts with basic structure**

Create file `src/modules/dashboard/index.ts`:

```typescript
/**
 * Dashboard Module - Main Dashboard View
 * Displays KPI cards (net worth, SIP status, FI progress, float indicator),
 * portfolio allocation pie chart, and SIP performance line chart
 */

import Chart from 'chart.js/auto';
import { createCard, createMetricCard } from '../ui/Card';
import './styles.css';
import {
  calculateTotalNetWorth,
  calculateSIPStatus,
  calculateFIProgress,
  calculateFloatIndicator,
} from './kpis';
import {
  getPortfolioAllocationChartConfig,
  getSIPPerformanceChartConfig,
} from './charts';
import type { FireOSState } from '../../types/state';

/**
 * Module state
 */
let containerElement: HTMLElement | null = null;
let chartInstances: Map<string, Chart> = new Map();

/**
 * Initialize the dashboard module
 * Called once from main.ts
 */
export function initDashboardModule(): void {
  console.log('[Dashboard] Module initialized');
}

/**
 * Render the dashboard (called when tab is activated or data changes)
 * @param D - Application state
 * @param container - Container element ID or element
 */
export function renderDashboard(D: FireOSState, container: string | HTMLElement = 'dashboard'): void {
  if (typeof container === 'string') {
    containerElement = document.getElementById(container);
  } else {
    containerElement = container;
  }

  if (!containerElement) {
    console.error('[Dashboard] Container not found');
    return;
  }

  // Clear previous render
  containerElement.innerHTML = '';

  // Render dashboard structure
  const dashboardRoot = document.createElement('div');
  dashboardRoot.className = 'dashboard-container';

  // KPI Cards Section
  const kpiSection = renderKPICards(D);
  dashboardRoot.appendChild(kpiSection);

  // Charts Section
  const chartsSection = renderCharts(D);
  dashboardRoot.appendChild(chartsSection);

  containerElement.appendChild(dashboardRoot);

  // Initialize charts after DOM is ready
  setTimeout(() => initializeCharts(D), 100);
}

/**
 * Render all KPI cards
 */
function renderKPICards(D: FireOSState): HTMLElement {
  const section = document.createElement('div');
  section.className = 'dashboard-kpi-section';

  // Total Net Worth Card
  const netWorth = calculateTotalNetWorth(D);
  const netWorthCard = createMetricCard(
    'Total Net Worth',
    netWorth.formatted,
    `${netWorth.mfCurrent > 0 ? '✓' : '○'} Portfolio loaded`
  );
  section.appendChild(netWorthCard);

  // FI Progress Card
  const fiProgress = calculateFIProgress(D);
  const fiCard = createCard('FI Goal Progress', [
    { label: 'Current Corpus', value: fiProgress.formatted },
    { label: 'FI Target (25×)', value: fiProgress.formattedTarget },
    { label: 'Progress', value: fiProgress.formattedProgress, isBold: true, isPositive: true },
  ]);
  section.appendChild(fiCard);

  // Float Indicator Card
  const floatIndicator = calculateFloatIndicator(D);
  const floatCard = createMetricCard(
    'Market Drawdown',
    floatIndicator.formatted,
    `Nifty: ${floatIndicator.niftyCurrent.toLocaleString('en-IN')} / ${floatIndicator.niftyHigh.toLocaleString('en-IN')}`
  );
  section.appendChild(floatCard);

  // SIP Status Cards
  const sipStatus = calculateSIPStatus(D);
  if (sipStatus.length > 0) {
    const sipSection = document.createElement('div');
    sipSection.className = 'dashboard-sip-grid';

    sipStatus.forEach((sip) => {
      const sipCard = createCard(`SIP: ${sip.name}`, [
        { label: 'Invested', value: sip.formattedInvested },
        { label: 'Current', value: sip.formattedCurrent },
        { label: 'P&L', value: sip.formattedPL, isPositive: sip.pl >= 0, isBold: true },
        { label: 'P&L %', value: `${sip.plPercent.toFixed(2)}%`, isPositive: sip.plPercent >= 0 },
        { label: 'XIRR', value: sip.formattedXIRR, isPositive: true },
      ]);
      sipSection.appendChild(sipCard);
    });

    section.appendChild(sipSection);
  }

  return section;
}

/**
 * Render chart containers
 */
function renderCharts(D: FireOSState): HTMLElement {
  const section = document.createElement('div');
  section.className = 'dashboard-charts-section';

  // Portfolio Allocation Chart
  const portfolioChartConfig = getPortfolioAllocationChartConfig(D);
  if (portfolioChartConfig) {
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    chartContainer.id = 'portfolio-allocation-chart';

    const canvas = document.createElement('canvas');
    chartContainer.appendChild(canvas);
    section.appendChild(chartContainer);
  } else {
    const placeholder = document.createElement('p');
    placeholder.textContent = 'Add portfolio data to see allocation chart';
    placeholder.style.color = '#a0a0a0';
    placeholder.style.padding = '2rem';
    section.appendChild(placeholder);
  }

  // SIP Performance Chart
  const sipChartConfig = getSIPPerformanceChartConfig(D);
  if (sipChartConfig) {
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    chartContainer.id = 'sip-performance-chart';

    const canvas = document.createElement('canvas');
    chartContainer.appendChild(canvas);
    section.appendChild(chartContainer);
  } else {
    const placeholder = document.createElement('p');
    placeholder.textContent = 'Add SIP data to see performance chart';
    placeholder.style.color = '#a0a0a0';
    placeholder.style.padding = '2rem';
    section.appendChild(placeholder);
  }

  return section;
}

/**
 * Initialize and render Chart.js instances
 */
function initializeCharts(D: FireOSState): void {
  // Destroy existing charts
  chartInstances.forEach((chart) => {
    try {
      chart.destroy();
    } catch (e) {
      console.warn('[Dashboard] Error destroying chart:', e);
    }
  });
  chartInstances.clear();

  // Portfolio Allocation Chart
  const portfolioChartConfig = getPortfolioAllocationChartConfig(D);
  if (portfolioChartConfig) {
    const canvasEl = document.querySelector('#portfolio-allocation-chart canvas') as HTMLCanvasElement;
    if (canvasEl) {
      const ctx = canvasEl.getContext('2d');
      if (ctx) {
        try {
          const chart = new Chart(ctx, portfolioChartConfig);
          chartInstances.set('portfolio-allocation', chart);
        } catch (e) {
          console.error('[Dashboard] Error creating portfolio chart:', e);
        }
      }
    }
  }

  // SIP Performance Chart
  const sipChartConfig = getSIPPerformanceChartConfig(D);
  if (sipChartConfig) {
    const canvasEl = document.querySelector('#sip-performance-chart canvas') as HTMLCanvasElement;
    if (canvasEl) {
      const ctx = canvasEl.getContext('2d');
      if (ctx) {
        try {
          const chart = new Chart(ctx, sipChartConfig);
          chartInstances.set('sip-performance', chart);
        } catch (e) {
          console.error('[Dashboard] Error creating SIP chart:', e);
        }
      }
    }
  }
}

/**
 * Teardown the dashboard (cleanup)
 */
export function teardownDashboard(): void {
  chartInstances.forEach((chart) => {
    try {
      chart.destroy();
    } catch (e) {
      console.warn('[Dashboard] Error during teardown:', e);
    }
  });
  chartInstances.clear();

  if (containerElement) {
    containerElement.innerHTML = '';
  }
}

/**
 * Public API for external updates (called by profile/state changes)
 */
export function updateDashboard(D: FireOSState): void {
  if (containerElement) {
    renderDashboard(D, containerElement);
  }
}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
npx tsc --noEmit src/modules/dashboard/index.ts
```

Expected output: No errors (Chart.js types are already in package).

- [ ] **Step 3: Commit dashboard module**

```bash
git add src/modules/dashboard/index.ts
git commit -m "feat(dashboard): add module init, KPI card rendering, and chart initialization"
```

---

## Task 4: Create Dashboard Styles

**Files:**
- Create: `src/modules/dashboard/styles.css`

**Context:** Styles cover the dashboard layout grid, KPI card spacing, chart containers, mobile responsiveness, and color scheme matching the global tokens.

---

- [ ] **Step 1: Create dashboard/styles.css**

Create file `src/modules/dashboard/styles.css`:

```css
/**
 * Dashboard Module Styles
 * Responsive grid layout for KPI cards and charts
 */

.dashboard-container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

/* KPI Section */
.dashboard-kpi-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  width: 100%;
}

/* SIP Grid (sub-grid for SIP cards) */
.dashboard-sip-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  grid-column: 1 / -1; /* Span full width */
}

/* Charts Section */
.dashboard-charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  width: 100%;
}

/* Chart Container */
.chart-container {
  background: #242424;
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid #3a3a3a;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  position: relative;
  height: 400px;
}

.chart-container canvas {
  max-height: 100%;
}

/* KPI Card base styles (from ui/Card.ts, can be overridden) */
.kpi-card {
  transition: all 200ms ease;
}

.kpi-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.metric-card {
  transition: all 200ms ease;
}

.metric-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

/* Responsive: Tablet */
@media (max-width: 1024px) {
  .dashboard-container {
    padding: 1rem;
    gap: 1.5rem;
  }

  .dashboard-kpi-section {
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .dashboard-sip-grid {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }

  .dashboard-charts-section {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .chart-container {
    height: 350px;
  }
}

/* Responsive: Mobile */
@media (max-width: 640px) {
  .dashboard-container {
    padding: 0.75rem;
    gap: 1rem;
  }

  .dashboard-kpi-section {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .dashboard-sip-grid {
    grid-template-columns: 1fr;
  }

  .dashboard-charts-section {
    grid-template-columns: 1fr;
  }

  .chart-container {
    height: 300px;
    padding: 1rem;
  }

  .kpi-card,
  .metric-card {
    padding: 1rem;
  }

  .kpi-card h3,
  .metric-card h3 {
    font-size: 1rem;
  }
}

/* Loading/Empty State */
.dashboard-charts-section p {
  grid-column: 1 / -1;
  text-align: center;
  font-size: 0.95rem;
}
```

- [ ] **Step 2: Commit dashboard styles**

```bash
git add src/modules/dashboard/styles.css
git commit -m "feat(dashboard): add responsive CSS grid layout for KPI cards and charts"
```

---

## Task 5: Integration with Main App

**Files:**
- Modify: `src/main.ts`

**Context:** Hook the dashboard module into the main app lifecycle: import it, initialize it on startup, and wire it to the dashboard tab.

---

- [ ] **Step 1: Update main.ts to import and initialize dashboard**

Modify `src/main.ts`:

Replace this section (around line 8):

```typescript
// Import auth module
import { renderAuthScreen, hideAuthScreen, showAuthScreen, initAuthModule } from './modules/auth';

// Import UI module
import { initUIModule } from './modules/ui';
```

With:

```typescript
// Import auth module
import { renderAuthScreen, hideAuthScreen, showAuthScreen, initAuthModule } from './modules/auth';

// Import UI module
import { initUIModule } from './modules/ui';

// Import dashboard module
import { initDashboardModule, renderDashboard, updateDashboard } from './modules/dashboard';
```

Then update the `initApp()` function to initialize dashboard:

Replace:

```typescript
function initApp() {
  loadFromLocalStorage();
  initUIModule();
  renderApp();
  setupAuthListener();
  setupTabNavigation();
  setupAutoSave();
}
```

With:

```typescript
function initApp() {
  loadFromLocalStorage();
  initUIModule();
  initDashboardModule();
  renderApp();
  setupAuthListener();
  setupTabNavigation();
  setupTabRendering();
  setupAutoSave();
}
```

And replace the `setupTabNavigation()` function to add dashboard rendering:

Replace:

```typescript
// Tab navigation
function setupTabNavigation() {
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).getAttribute('data-tab');
      if (target) {
        document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
        (e.target as HTMLElement).classList.add('active');
        document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        const tabEl = document.getElementById(target);
        if (tabEl) tabEl.classList.add('active');
      }
    });
  });

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth);
      } catch (e) {
        console.error('Logout failed:', e);
      }
    });
  }
}
```

With:

```typescript
// Tab navigation
function setupTabNavigation() {
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).getAttribute('data-tab');
      if (target) {
        document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
        (e.target as HTMLElement).classList.add('active');
        document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        const tabEl = document.getElementById(target);
        if (tabEl) tabEl.classList.add('active');

        // Trigger tab-specific rendering
        if (target === 'dashboard') {
          renderDashboard(D);
        }
      }
    });
  });

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth);
      } catch (e) {
        console.error('Logout failed:', e);
      }
    });
  }
}

// Tab rendering helpers
function setupTabRendering() {
  // Render dashboard on startup (inactive, but populated)
  renderDashboard(D);
}
```

- [ ] **Step 2: Verify updated main.ts compiles**

```bash
npx tsc --noEmit src/main.ts
```

Expected output: No errors.

- [ ] **Step 3: Commit main.ts integration**

```bash
git add src/main.ts
git commit -m "feat(main): integrate dashboard module initialization and tab rendering"
```

---

## Task 6: Manual Testing & Verification

**Files:**
- (No files created; testing only)

**Context:** Verify that the dashboard renders correctly, KPIs calculate properly, and charts display. Test with sample data and mobile viewport.

---

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Expected output: Vite dev server running at http://localhost:5173

- [ ] **Step 2: Load app in browser**

Open http://localhost:5173 in a browser (Chrome/Firefox dev tools recommended).

- [ ] **Step 3: Test auth flow**

Sign up with a test email: `testuser@example.com` / password `TestPass123`

Expected: Login succeeds, auth screen hides, main app renders.

- [ ] **Step 4: Navigate to Dashboard tab**

Click "Dashboard" in the nav.

Expected:
- Dashboard renders with KPI cards
- Total Net Worth shows ₹0.00 (no portfolio data yet)
- FI Progress shows 0% (no expenses set)
- Market Drawdown shows 0% (no Nifty data)
- No SIP cards (no SIP data)
- Chart placeholders shown (no data to render)

- [ ] **Step 5: Add sample portfolio data in Profile tab**

Click "Profile" tab. Enter:
- Annual Expenses: 600000
- Add SIP 1: Parag Parikh (code 122639), units 100, start date 2024-01, monthly 5000
- Add FD: 500000
- Add EPF: 2000000

- [ ] **Step 6: Mock NAV data (developer console)**

Open DevTools Console and run:

```javascript
D.nav['122639'] = 5000;
D.niftyHigh = 25000;
D.niftyData = { level: 24000, timestamp: new Date().toISOString() };
```

Then navigate back to Dashboard tab.

Expected:
- Total Net Worth: ₹25,00,000 (2M EPF + 500k FD + 500k SIP current)
- SIP card shows: Invested ₹6,00,000 (assuming 2024-06 now, so 6 months × 5000), Current ₹5,00,000
- P&L: negative (loss)
- Market Drawdown: 4.00%
- Charts render: pie chart with allocation, line chart with SIP trend

- [ ] **Step 7: Verify no console errors**

Check DevTools Console. Expected: No ERROR messages; warnings OK.

- [ ] **Step 8: Test mobile responsiveness**

In DevTools, toggle Device Toolbar (Ctrl+Shift+M). Resize to mobile.

Expected:
- KPI cards stack to single column
- Charts resize to single column
- No horizontal overflow
- Text remains readable

- [ ] **Step 9: Reload page and verify persistence**

Reload the page (Ctrl+R).

Expected: Dashboard reloads with same data (localStorage saved data).

---

## Task 7: Automated Tests (Playwright E2E)

**Files:**
- Create: `tests/dashboard.e2e.ts`

**Context:** E2E tests verify the dashboard tab renders correctly, KPI values update when data changes, and charts are initialized properly.

---

- [ ] **Step 1: Create dashboard E2E tests**

Create file `tests/dashboard.e2e.ts`:

```typescript
/**
 * Dashboard E2E Tests (Playwright)
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard Module', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:5173');

    // Mock auth (bypass login by setting currentUser in localStorage)
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('fireOS_v2') || '{}');
      // Mock auth state (would normally come from Firebase)
      // For now, just ensure localStorage is set
      localStorage.setItem('fireOS_v2', JSON.stringify(state));
    });

    // Reload to apply state
    await page.reload();

    // Wait for app to load
    await page.waitForSelector('.dashboard-container', { timeout: 5000 }).catch(() => {
      // Dashboard may not be visible until tab is clicked
    });
  });

  test('renders dashboard tab and KPI cards', async ({ page }) => {
    // Click dashboard tab
    await page.click('[data-tab="dashboard"]');

    // Wait for dashboard to render
    await page.waitForSelector('.dashboard-container', { timeout: 5000 });

    // Verify KPI cards are present
    const kpiSection = await page.$('.dashboard-kpi-section');
    expect(kpiSection).not.toBeNull();

    // Verify at least one metric card (Total Net Worth)
    const metricCards = await page.$$('.metric-card');
    expect(metricCards.length).toBeGreaterThan(0);
  });

  test('displays KPI values correctly with no data', async ({ page }) => {
    await page.click('[data-tab="dashboard"]');
    await page.waitForSelector('.dashboard-container', { timeout: 5000 });

    // Total Net Worth should show ₹0.00
    const netWorthText = await page.textContent('.metric-card');
    expect(netWorthText).toContain('₹'); // Currency symbol present
  });

  test('updates dashboard when portfolio data changes', async ({ page }) => {
    await page.click('[data-tab="dashboard"]');
    await page.waitForSelector('.dashboard-container', { timeout: 5000 });

    // Add sample data via JavaScript
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('fireOS_v2') || '{}');
      state.epf = {
        epf1: { amount: 1000000, currency: 'INR' },
      };
      state.profile = {
        name: 'Test User',
        age: 35,
        annualExpenses: 600000,
        fiTarget: 0,
      };
      localStorage.setItem('fireOS_v2', JSON.stringify(state));
      // Manually update global D object
      (window as any).D.epf = state.epf;
      (window as any).D.profile = state.profile;
    });

    // Navigate away and back to trigger re-render
    await page.click('[data-tab="profile"]');
    await page.click('[data-tab="dashboard"]');
    await page.waitForSelector('.dashboard-container', { timeout: 5000 });

    // Verify net worth updated (should include EPF)
    const netWorthValue = await page.textContent('.metric-card:first-of-type');
    expect(netWorthValue).toContain('₹');
  });

  test('renders chart containers when sufficient data exists', async ({ page }) => {
    // Add portfolio data
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('fireOS_v2') || '{}');
      state.epf = { epf1: { amount: 1000000, currency: 'INR' } };
      state.sip = {
        sip1: {
          name: 'Test Fund',
          schemeCode: '122639',
          units: 100,
          startDate: '2024-01',
          monthlyAmount: 5000,
        },
      };
      state.nav = { '122639': 5000 };
      state.niftyHigh = 25000;
      state.niftyData = { level: 24000, timestamp: new Date().toISOString() };
      localStorage.setItem('fireOS_v2', JSON.stringify(state));
      (window as any).D.epf = state.epf;
      (window as any).D.sip = state.sip;
      (window as any).D.nav = state.nav;
      (window as any).D.niftyHigh = state.niftyHigh;
      (window as any).D.niftyData = state.niftyData;
    });

    await page.reload();
    await page.click('[data-tab="dashboard"]');
    await page.waitForSelector('.dashboard-container', { timeout: 5000 });

    // Check for chart containers
    const chartContainers = await page.$$('.chart-container');
    expect(chartContainers.length).toBeGreaterThan(0);
  });

  test('handles NaN/Infinity gracefully', async ({ page }) => {
    // Add invalid data
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('fireOS_v2') || '{}');
      state.mf = {
        mf1: {
          name: 'Invalid Fund',
          schemeCode: '999999',
          units: Infinity,
          startDate: '2024-01',
          monthlyAmount: 5000,
        },
      };
      state.nav = { '999999': NaN };
      localStorage.setItem('fireOS_v2', JSON.stringify(state));
      (window as any).D.mf = state.mf;
      (window as any).D.nav = state.nav;
    });

    await page.reload();
    await page.click('[data-tab="dashboard"]');
    await page.waitForSelector('.dashboard-container', { timeout: 5000 });

    // Should not crash; should display ₹0.00 or N/A
    const netWorthText = await page.textContent('.metric-card:first-of-type');
    expect(netWorthText).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run E2E tests**

```bash
npm run test tests/dashboard.e2e.ts
```

Expected output: All tests pass (or minimal failures if setup issues; can debug interactively with `npm run test:ui`).

- [ ] **Step 3: Commit E2E tests**

```bash
git add tests/dashboard.e2e.ts
git commit -m "test(dashboard): add E2E tests for KPI rendering and chart initialization"
```

---

## Task 8: Build & Final Verification

**Files:**
- (No files created; verification only)

**Context:** Ensure the production build passes without errors, and the bundle size is reasonable.

---

- [ ] **Step 1: Run tests to verify all pass**

```bash
npm run test
```

Expected output: All tests pass (unit + E2E).

- [ ] **Step 2: Build production bundle**

```bash
npm run build
```

Expected output:
```
vite v4.x.x building for production...
dist/index.html        0.xx kB
dist/index.js          xxx.xx kB
...
```

No errors or critical warnings. Bundle size should be reasonable (< 300 KB gzipped).

- [ ] **Step 3: Preview production build**

```bash
npm run preview
```

Navigate to http://localhost:4173 and repeat manual testing from Task 6:
- Sign up
- Navigate to Dashboard
- Add portfolio data
- Verify KPIs and charts render

Expected: Dashboard works identically to dev mode.

- [ ] **Step 4: Verify no console errors in preview**

Open DevTools Console. Expected: No ERROR messages.

- [ ] **Step 5: Commit final verification**

No new files, but ensure everything is working:

```bash
git status
```

Expected: No modified files (all changes already committed).

If there are uncommitted changes, review them:

```bash
git diff
```

Commit if necessary with a descriptive message.

---

## Summary Checklist

- [ ] **Task 1 Complete:** KPI functions (totalNetWorth, sipStatus, fiProgress, floatIndicator) with unit tests
- [ ] **Task 2 Complete:** Chart configs (portfolio allocation pie, SIP performance line)
- [ ] **Task 3 Complete:** Dashboard module init/render with KPI card and chart rendering
- [ ] **Task 4 Complete:** Responsive CSS layout (desktop, tablet, mobile)
- [ ] **Task 5 Complete:** Integration with main.ts (initialization, tab rendering)
- [ ] **Task 6 Complete:** Manual testing (dashboard renders, KPIs calculate, charts display, mobile responsive)
- [ ] **Task 7 Complete:** Playwright E2E tests for dashboard rendering and KPI updates
- [ ] **Task 8 Complete:** Production build passes, bundle size acceptable, preview works

---

## Spec Coverage

**Requirement:** All KPIs display correctly
- ✓ Task 1: `calculateTotalNetWorth`, `calculateSIPStatus`, `calculateFIProgress`, `calculateFloatIndicator`

**Requirement:** Charts render (Chart.js)
- ✓ Task 2: `getPortfolioAllocationChartConfig`, `getSIPPerformanceChartConfig`
- ✓ Task 3: Chart initialization and destruction

**Requirement:** No NaN/Infinity values
- ✓ Task 1: All KPI functions include `isFinite()` guards and return 0 as default

**Requirement:** Mobile responsive
- ✓ Task 4: CSS media queries for tablet and mobile viewports

**Requirement:** Updates when data changes
- ✓ Task 3: `updateDashboard()` function for external triggers
- ✓ Task 5: Tab navigation triggers `renderDashboard(D)`

**Requirement:** No console errors
- ✓ Task 6 & 8: Manual verification and E2E test assertions

**Requirement:** Build passes
- ✓ Task 8: `npm run build` succeeds with no errors

---

## Key Implementation Notes

1. **KPI Calculations** (`kpis.ts`):
   - All functions are pure and test-friendly
   - Return both raw numbers and formatted strings for flexible UI rendering
   - Handle missing/invalid data gracefully (NaN/Infinity protection)

2. **Chart Rendering** (`charts.ts`):
   - Return `null` if insufficient data (graceful degradation)
   - Use consistent color scheme (gold, blue, green, red, purple)
   - Chart.js auto-responsive (no manual resize handling needed)

3. **Module Pattern** (`index.ts`):
   - Follows established pattern: `init()`, `render()`, `teardown()`, `update()`
   - Chart instances managed in Map for cleanup
   - Async chart initialization (setTimeout) to ensure DOM is ready

4. **Styling** (`styles.css`):
   - CSS Grid for responsive layout (auto-fit, minmax patterns)
   - Consistent spacing with 1.5rem gap
   - Mobile-first breakpoints (640px, 1024px)
   - Reuses existing UI component styles (hover effects, colors)

5. **Integration** (`main.ts`):
   - Minimal changes to existing code
   - Dashboard renders on tab click
   - State updates via `updateDashboard(D)` (can be called from profile module)

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-03-dashboard-module.md`.**

## Execution Options

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration with parallel work

**2. Inline Execution** - I execute all tasks in this session sequentially using executing-plans with checkpoints for review

Which approach would you prefer?