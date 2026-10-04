import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFeatureContext, type FeatureContext } from '../../core/feature-context';
import { initializeState, type FireOSState } from '../../types/state';
import type { HistoricalSeries } from '../../types/api';
import type { PortfolioCompositionKPI } from './kpis';
import {
  initDashboardModule,
  mountCompositionChart,
  renderDashboard,
  teardownDashboard,
} from './index';

interface FakeChartConfig {
  type?: string;
  data?: { datasets?: Array<{ tension?: number }> };
}

interface FakeChartInstance {
  readonly destroyed: boolean;
  readonly config: FakeChartConfig;
}

const { charts } = vi.hoisted(() => ({
  charts: [] as Array<{ destroyed: boolean; config: FakeChartConfig }>,
}));

vi.mock('chart.js', () => {
  class Chart {
    static register(): void {}
    public destroyed = false;
    public config: FakeChartConfig;
    constructor(context: unknown, config: unknown) {
      void context;
      this.config = config as FakeChartConfig;
      charts.push(this);
    }
    destroy(): void {
      this.destroyed = true;
    }
    update(): void {}
  }
  return {
    Chart,
    PieController: class PieController {},
    ArcElement: class ArcElement {},
    LineController: class LineController {},
    CategoryScale: class CategoryScale {},
    LinearScale: class LinearScale {},
    PointElement: class PointElement {},
    LineElement: class LineElement {},
    Tooltip: class Tooltip {},
    Legend: class Legend {},
  };
});

const CATEGORIES: PortfolioCompositionKPI['categories'] = [
  { name: 'Mutual Funds', value: 600000, percentage: 60 },
  { name: 'EPF', value: 400000, percentage: 40 },
];

function liveCharts(): FakeChartInstance[] {
  return charts.filter((chart) => !chart.destroyed);
}

function createControlStub() {
  const listeners: Record<string, () => void> = {};
  const attributes: Record<string, string> = {};
  return {
    textContent: '',
    listeners,
    attributes,
    addEventListener(type: string, listener: () => void): void {
      listeners[type] = listener;
    },
    setAttribute(name: string, value: string): void {
      attributes[name] = value;
    },
  };
}

type ControlStub = ReturnType<typeof createControlStub>;

function createDocumentStub(canvas: () => unknown) {
  const container = { innerHTML: '' };
  const controls = new Map<string, ControlStub>();
  const getElementById = (id: string): unknown => {
    if (id === 'dashboard') return container;
    if (!container.innerHTML.includes(`id="${id}"`)) return null;
    if (id === 'composition-chart' || id === 'networth-chart' || id === 'benchmark-chart') {
      return canvas();
    }
    if (!controls.has(id)) controls.set(id, createControlStub());
    return controls.get(id);
  };
  return {
    container,
    getElementById,
    control: (id: string): ControlStub | undefined => controls.get(id),
  };
}

type DocumentStub = ReturnType<typeof createDocumentStub>;

describe('dashboard composition chart lifecycle', () => {
  let doc: DocumentStub;
  let context: FeatureContext;
  let canvasFactory: () => unknown;

  beforeEach(() => {
    charts.length = 0;
    canvasFactory = () => ({ getContext: () => ({}) });
    doc = createDocumentStub(() => canvasFactory());
    vi.stubGlobal('document', { getElementById: doc.getElementById, documentElement: {} });
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' }));
    context = createFeatureContext(initializeState());
    initDashboardModule('dashboard', context);
  });

  afterEach(() => {
    teardownDashboard();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders empty and zero-total composition without creating a chart', () => {
    doc.container.innerHTML = '<canvas id="composition-chart"></canvas>';

    expect(() => mountCompositionChart('composition-chart', [])).not.toThrow();
    expect(() =>
      mountCompositionChart('composition-chart', [{ name: 'EPF', value: 0, percentage: 0 }]),
    ).not.toThrow();
    expect(charts).toHaveLength(0);
  });

  it('renders an empty dashboard (zero totals) without chart errors', async () => {
    await expect(renderDashboard()).resolves.toBeUndefined();
    expect(charts).toHaveLength(0);
    expect(doc.container.innerHTML).toContain('No holdings yet');
  });

  it('replaces the previous instance on rerender so exactly one chart is live', () => {
    doc.container.innerHTML = '<canvas id="composition-chart"></canvas>';

    mountCompositionChart('composition-chart', CATEGORIES);
    mountCompositionChart('composition-chart', CATEGORIES);

    expect(charts).toHaveLength(2);
    expect(charts[0].destroyed).toBe(true);
    expect(liveCharts()).toHaveLength(1);
  });

  it('destroys the chart instance on dashboard unmount', async () => {
    const state = context.state as FireOSState;
    state.fd = { emergency: { amount: 500000, currency: 'INR' } };

    await renderDashboard();

    expect(doc.container.innerHTML).toContain('pie-chart-legend');
    expect(doc.container.innerHTML).toContain('Fixed Deposits');
    expect(liveCharts()).toHaveLength(1);

    teardownDashboard();

    expect(liveCharts()).toHaveLength(0);
    expect(doc.container.innerHTML).toBe('');
  });

  it('keeps exactly one live chart across repeated dashboard renders', async () => {
    const state = context.state as FireOSState;
    state.fd = { emergency: { amount: 500000, currency: 'INR' } };

    await renderDashboard();
    await renderDashboard();
    await renderDashboard();

    expect(charts).toHaveLength(3);
    expect(charts.slice(0, 2).every((chart) => chart.destroyed)).toBe(true);
    expect(liveCharts()).toHaveLength(1);
  });

  it('does not throw when the 2D context is missing', () => {
    doc.container.innerHTML = '<canvas id="composition-chart"></canvas>';
    canvasFactory = () => ({ getContext: () => null });

    expect(() => mountCompositionChart('composition-chart', CATEGORIES)).not.toThrow();
    expect(charts).toHaveLength(0);

    canvasFactory = () => ({});
    expect(() => mountCompositionChart('composition-chart', CATEGORIES)).not.toThrow();
    expect(charts).toHaveLength(0);
  });

  it('renders the dashboard without a 2D context and keeps the HTML legend', async () => {
    const state = context.state as FireOSState;
    state.fd = { emergency: { amount: 500000, currency: 'INR' } };
    canvasFactory = () => ({ getContext: () => null });

    await expect(renderDashboard()).resolves.toBeUndefined();

    expect(charts).toHaveLength(0);
    expect(doc.container.innerHTML).toContain('pie-chart-legend');
    expect(doc.container.innerHTML).toContain('Fixed Deposits');
  });

  function makeMarketSeries(source = 'Yahoo Finance API (corsproxy)'): HistoricalSeries {
    return {
      points: [
        { date: '2026-09-01', value: 24800 },
        { date: '2026-09-15', value: 25000 },
        { date: '2026-10-01', value: 24950 },
      ],
      source,
      fetchedAt: '2026-10-04T10:30:00.000Z',
      status: 'live',
    };
  }

  function seedAnalyticsData(): void {
    const state = context.state as FireOSState;
    state.netWorthHistory = [
      { date: '2026-08-01', value: 1000000 },
      { date: '2026-09-01', value: 1050000 },
      { date: '2026-10-01', value: 1100000 },
    ];
    vi.spyOn(context.ports.marketData, 'fetchNiftyHistory').mockResolvedValue(makeMarketSeries());
  }

  it('mounts net-worth and benchmark line charts alongside the pie', async () => {
    const state = context.state as FireOSState;
    state.fd = { emergency: { amount: 500000, currency: 'INR' } };
    seedAnalyticsData();

    await renderDashboard();

    expect(doc.container.innerHTML).toContain('id="networth-chart"');
    expect(doc.container.innerHTML).toContain('id="benchmark-chart"');
    expect(doc.container.innerHTML).toContain('net-worth-snapshots');
    expect(doc.container.innerHTML).toContain('Yahoo Finance API (corsproxy)');
    expect(liveCharts()).toHaveLength(3);
  });

  it('keeps one instance of each chart across rerenders and destroys them on unmount', async () => {
    seedAnalyticsData();

    await renderDashboard();
    await renderDashboard();
    await renderDashboard();

    expect(charts).toHaveLength(6);
    expect(liveCharts()).toHaveLength(2);

    teardownDashboard();

    expect(liveCharts()).toHaveLength(0);
    expect(doc.container.innerHTML).toBe('');
  });

  it('replaces only the affected chart when a range or view control is clicked', async () => {
    seedAnalyticsData();
    await renderDashboard();

    const rangeButton = doc.control('nw-range-3m');
    expect(rangeButton).toBeDefined();
    const beforeRange = charts.length;
    rangeButton!.listeners.click();

    expect(charts.length).toBe(beforeRange + 1);
    expect(liveCharts()).toHaveLength(2);
    expect(rangeButton!.attributes['aria-pressed']).toBe('true');

    const drawdownButton = doc.control('bm-view-drawdown');
    expect(drawdownButton).toBeDefined();
    const beforeView = charts.length;
    drawdownButton!.listeners.click();

    expect(charts.length).toBe(beforeView + 1);
    expect(liveCharts()).toHaveLength(2);
    expect(drawdownButton!.attributes['aria-pressed']).toBe('true');
  });

  it('renders empty snapshot and unavailable benchmark states without line charts', async () => {
    await renderDashboard();

    expect(doc.container.innerHTML).toContain('No history recorded yet');
    expect(doc.container.innerHTML).toContain('Market history unavailable');
    expect(doc.container.innerHTML).toContain('Total Net Worth');
    expect(doc.container.innerHTML).not.toContain('id="networth-chart"');
    expect(doc.container.innerHTML).not.toContain('id="benchmark-chart"');
    expect(liveCharts()).toHaveLength(0);
  });

  it('does not throw for line charts when the 2D context is missing', async () => {
    seedAnalyticsData();
    canvasFactory = () => ({ getContext: () => null });

    await expect(renderDashboard()).resolves.toBeUndefined();

    expect(charts).toHaveLength(0);
    expect(doc.container.innerHTML).toContain('id="networth-chart"');
    expect(doc.container.innerHTML).toContain('id="benchmark-chart"');
  });

  it('draws line charts with straight segments so no implied values are rendered', async () => {
    seedAnalyticsData();

    await renderDashboard();

    const lineCharts = charts.filter((chart) => chart.config.type === 'line');
    expect(lineCharts).toHaveLength(2);
    for (const chart of lineCharts) {
      expect(chart.config.data?.datasets?.[0]?.tension).toBe(0);
    }
  });

  it('degrades to the unavailable benchmark card when the history fetch rejects', async () => {
    vi.spyOn(context.ports.marketData, 'fetchNiftyHistory').mockRejectedValue(
      new Error('network down'),
    );

    await expect(renderDashboard()).resolves.toBeUndefined();

    expect(doc.container.innerHTML).toContain('Market history unavailable');
    expect(doc.container.innerHTML).not.toContain('id="benchmark-chart"');
  });

  it('does not let a superseded render overwrite newer benchmark history', async () => {
    let resolveStale!: (value: HistoricalSeries | null) => void;
    const staleFetch = new Promise<HistoricalSeries | null>((resolve) => {
      resolveStale = resolve;
    });
    let fetchCall = 0;
    vi.spyOn(context.ports.marketData, 'fetchNiftyHistory').mockImplementation(() => {
      fetchCall += 1;
      if (fetchCall === 1) return staleFetch;
      return Promise.resolve(makeMarketSeries('fresh-source'));
    });

    // Render A starts first and suspends awaiting its still-pending fetch.
    const superseded = renderDashboard();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Render B supersedes A, resolves quickly, and renders the fresh series.
    await renderDashboard();

    // A resumes after B finished; its stale result must not clobber B's state.
    resolveStale(makeMarketSeries('stale-source'));
    await superseded;

    doc.control('bm-range-1y')!.listeners.click();

    const meta = doc.control('benchmark-chart-meta');
    expect(meta?.textContent).toContain('fresh-source');
    expect(meta?.textContent).not.toContain('stale-source');
  });
});
