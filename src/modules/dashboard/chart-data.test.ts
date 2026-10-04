import { describe, expect, it } from 'vitest';
import type { HistoricalSeries } from '../../types/api';
import {
  CHART_RANGES,
  buildBenchmarkSeries,
  buildDrawdownSeries,
  buildSnapshotSeries,
  supportedRanges,
  windowFromRange,
} from './chart-data';

function makeHistory(
  points: Array<{ date: string; value: number }>,
  overrides: Partial<HistoricalSeries> = {},
): HistoricalSeries {
  return {
    points,
    source: 'Yahoo Finance API (corsproxy)',
    fetchedAt: '2026-10-04T10:30:00.000Z',
    status: 'live',
    ...overrides,
  };
}

describe('buildSnapshotSeries', () => {
  it('shapes empty snapshots into an empty recorded series with no invented points', () => {
    const series = buildSnapshotSeries([]);

    expect(series.points).toEqual([]);
    expect(series.meta).toEqual({
      label: 'Net worth',
      source: 'net-worth-snapshots',
      status: 'recorded',
      coverage: 'gaps-expected',
      fetchedAt: null,
    });
  });

  it('preserves sparse snapshot gaps without backfill or interpolation', () => {
    const snapshots = [
      { date: '2026-01-01', value: 1000000 },
      { date: '2026-04-15', value: 1200000 },
      { date: '2026-10-01', value: 1150000 },
    ];

    const series = buildSnapshotSeries(snapshots);

    expect(series.points.map((point) => point.date)).toEqual([
      '2026-01-01',
      '2026-04-15',
      '2026-10-01',
    ]);
    expect(series.points.map((point) => point.value)).toEqual([1000000, 1200000, 1150000]);
  });

  it('orders out-of-order snapshots ascending without adding points', () => {
    const series = buildSnapshotSeries([
      { date: '2026-03-01', value: 3 },
      { date: '2026-01-01', value: 1 },
      { date: '2026-02-01', value: 2 },
    ]);

    expect(series.points.map((point) => point.date)).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ]);
    expect(series.points).toHaveLength(3);
  });

  it('filters by window with both endpoints inclusive and drops dates outside', () => {
    const snapshots = [
      { date: '2026-01-31', value: 1 },
      { date: '2026-02-01', value: 2 },
      { date: '2026-02-15', value: 3 },
      { date: '2026-03-01', value: 4 },
      { date: '2026-03-02', value: 5 },
    ];
    const window = { start: new Date(2026, 1, 1), end: new Date(2026, 2, 1) };

    const series = buildSnapshotSeries(snapshots, window);

    expect(series.points.map((point) => point.date)).toEqual([
      '2026-02-01',
      '2026-02-15',
      '2026-03-01',
    ]);
  });

  it('returns an empty series when the window contains no snapshots', () => {
    const series = buildSnapshotSeries([{ date: '2026-01-01', value: 1 }], {
      start: new Date(2026, 5, 1),
      end: new Date(2026, 8, 1),
    });

    expect(series.points).toEqual([]);
  });
});

describe('windowFromRange', () => {
  it('anchors the window at the latest valid date and ignores invalid dates', () => {
    const window = windowFromRange(['2026-01-31', '2026-06-15', 'not-a-date'], 3);

    expect(window).not.toBeNull();
    expect(window!.end).toEqual(new Date(2026, 5, 15));
    expect(window!.start).toEqual(new Date(2026, 2, 15));
  });

  it('returns null for the all-time range and for unusable dates', () => {
    expect(windowFromRange(['2026-01-31'], 0)).toBeNull();
    expect(windowFromRange(['bad-date'], 3)).toBeNull();
    expect(windowFromRange([], 3)).toBeNull();
  });

  it('clamps month arithmetic to the end of a shorter month', () => {
    const window = windowFromRange(['2026-05-31'], 3);

    expect(window!.start).toEqual(new Date(2026, 1, 28));
  });
});

describe('supportedRanges', () => {
  it('offers no range beyond the provider five-year bound', () => {
    expect(Math.max(...CHART_RANGES.map((range) => range.months))).toBe(60);
    expect(CHART_RANGES.some((range) => range.key === 'all')).toBe(true);
  });

  it('enables only ranges the snapshot span covers', () => {
    const support = supportedRanges(['2026-01-01', '2026-04-01', '2026-10-04']);

    expect(Object.fromEntries(support.map((range) => [range.key, range.enabled]))).toEqual({
      '3m': true,
      '6m': true,
      '1y': false,
      '3y': false,
      '5y': false,
      all: true,
    });
  });

  it('treats history starting within 15 days of the window start as covering it', () => {
    // 3M window anchored at 2026-10-04 starts 2026-07-04.
    const covered = supportedRanges(['2026-07-19', '2026-10-04']);
    const uncovered = supportedRanges(['2026-07-20', '2026-10-04']);

    expect(covered.find((range) => range.key === '3m')!.enabled).toBe(true);
    expect(uncovered.find((range) => range.key === '3m')!.enabled).toBe(false);
  });

  it('disables every range when no usable snapshot date exists', () => {
    const support = supportedRanges([]);

    expect(support.every((range) => !range.enabled)).toBe(true);
  });
});

describe('buildBenchmarkSeries', () => {
  it('marks missing market history as unavailable with no points', () => {
    const series = buildBenchmarkSeries(null);

    expect(series.points).toEqual([]);
    expect(series.meta).toEqual({
      label: 'Nifty 50 (benchmark)',
      source: '',
      status: 'unavailable',
      coverage: 'none',
      fetchedAt: null,
    });
  });

  it('marks an empty provider series as unavailable', () => {
    const series = buildBenchmarkSeries(makeHistory([]));

    expect(series.points).toEqual([]);
    expect(series.meta.status).toBe('unavailable');
    expect(series.meta.coverage).toBe('none');
    expect(series.meta.source).toBe('Yahoo Finance API (corsproxy)');
  });

  it('identifies provider, range and freshness and never claims portfolio ownership', () => {
    const history = makeHistory(
      [
        { date: '2026-10-01', value: 25000 },
        { date: '2026-10-04', value: 25100 },
      ],
      { status: 'stale', fetchedAt: '2026-10-01T06:00:00.000Z' },
    );

    const series = buildBenchmarkSeries(history);

    expect(series.meta.label).toContain('Nifty 50');
    expect(series.meta.label).toContain('benchmark');
    expect(series.meta.label).not.toMatch(/portfolio|net worth|return/i);
    expect(series.meta.source).toBe('Yahoo Finance API (corsproxy)');
    expect(series.meta.status).toBe('stale');
    expect(series.meta.fetchedAt).toBe('2026-10-01T06:00:00.000Z');
    expect(series.meta.coverage).toBe('full');
  });

  it('keeps only provider points inside the window and adds none of its own', () => {
    const history = makeHistory([
      { date: '2026-09-29', value: 24800 },
      { date: '2026-10-01', value: 24900 },
      { date: '2026-10-04', value: 25000 },
    ]);

    const series = buildBenchmarkSeries(history, {
      start: new Date(2026, 9, 1),
      end: new Date(2026, 9, 4),
    });

    expect(series.points.map((point) => point.date)).toEqual(['2026-10-01', '2026-10-04']);
    expect(series.points.map((point) => point.value)).toEqual([24900, 25000]);
  });

  it('flags partial coverage when history starts well after the window start', () => {
    const history = makeHistory([
      { date: '2026-08-01', value: 24000 },
      { date: '2026-10-04', value: 25000 },
    ]);

    const partial = buildBenchmarkSeries(history, {
      start: new Date(2025, 9, 4),
      end: new Date(2026, 9, 4),
    });
    const covered = buildBenchmarkSeries(history, {
      start: new Date(2026, 6, 27),
      end: new Date(2026, 9, 4),
    });

    expect(partial.meta.coverage).toBe('partial');
    expect(covered.meta.coverage).toBe('full');
  });
});

describe('buildDrawdownSeries', () => {
  it('keeps exactly the benchmark dates and labels', () => {
    const performanceSeries = buildBenchmarkSeries(
      makeHistory([
        { date: '2026-09-01', value: 100 },
        { date: '2026-10-01', value: 120 },
      ]),
    );

    const drawdown = buildDrawdownSeries(performanceSeries);

    expect(drawdown.points.map((point) => point.date)).toEqual(
      performanceSeries.points.map((point) => point.date),
    );
    expect(drawdown.meta.label).toBe(`${performanceSeries.meta.label} drawdown`);
    expect(drawdown.meta.source).toBe(performanceSeries.meta.source);
    expect(drawdown.meta.status).toBe(performanceSeries.meta.status);
  });

  it('computes drawdown from the running maximum without inventing dates', () => {
    const performanceSeries = buildBenchmarkSeries(
      makeHistory([
        { date: '2026-06-01', value: 100 },
        { date: '2026-07-01', value: 120 },
        { date: '2026-08-01', value: 90 },
        { date: '2026-09-01', value: 110 },
      ]),
    );

    const drawdown = buildDrawdownSeries(performanceSeries);

    expect(drawdown.points).toHaveLength(4);
    expect(drawdown.points[0].value).toBe(0);
    expect(drawdown.points[1].value).toBe(0);
    expect(drawdown.points[2].value).toBeCloseTo(-25, 6);
    expect(drawdown.points[3].value).toBeCloseTo(((110 / 120) - 1) * 100, 6);
  });

  it('returns an empty series for empty input', () => {
    const drawdown = buildDrawdownSeries(buildBenchmarkSeries(null));

    expect(drawdown.points).toEqual([]);
    expect(drawdown.meta.status).toBe('unavailable');
  });
});

describe('series alignment', () => {
  it('keeps snapshot and benchmark series distinct when their dates do not align', () => {
    const snapshots = [
      { date: '2026-10-01', value: 500000 },
      { date: '2026-10-03', value: 510000 },
    ];
    const history = makeHistory([
      { date: '2026-10-02', value: 25000 },
      { date: '2026-10-04', value: 25100 },
    ]);

    const snapshotSeries = buildSnapshotSeries(snapshots);
    const benchmarkSeries = buildBenchmarkSeries(history);

    expect(snapshotSeries.points.map((point) => point.date)).toEqual([
      '2026-10-01',
      '2026-10-03',
    ]);
    expect(benchmarkSeries.points.map((point) => point.date)).toEqual([
      '2026-10-02',
      '2026-10-04',
    ]);
    expect(snapshotSeries.meta.source).not.toBe(benchmarkSeries.meta.source);
    expect(benchmarkSeries.meta.status).not.toBe('recorded');
  });
});
