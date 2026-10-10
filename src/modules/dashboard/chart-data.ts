/**
 * Dashboard chart data shaping.
 *
 * Pure functions that turn persisted net-worth snapshots and fetched market
 * history into chart series (points + metadata). No valuation or return
 * calculations live here: snapshot values pass through untouched, benchmark
 * drawdown is derived only from the benchmark's own points, and no missing
 * portfolio value is ever backfilled, interpolated, or invented. Date parsing
 * and inclusive window checks come from `src/lib/dates.ts`.
 */

import { addMonths } from 'date-fns';
import { isWithinDateRange, parseCalendarDate } from '../../lib/dates';
import type { HistoricalSeries, MarketDataStatus } from '../../types/api';

/** One persisted daily net-worth snapshot (state contract: validated numbers). */
export interface SnapshotPoint {
  date: string;
  value: number;
}

/** One point on a chart series (date YYYY-MM-DD, value as recorded/derived). */
export interface ChartSeriesPoint {
  date: string;
  value: number;
}

/** Inclusive date window for chart filtering. */
export interface DateWindow {
  start: Date;
  end: Date;
}

/** Freshness of a series: local records, unavailable data, or provider status. */
export type ChartSeriesStatus = 'recorded' | 'unavailable' | MarketDataStatus;

/**
 * Window coverage: `full` = series reaches the window edges, `partial` =
 * market history starts well after the requested window, `gaps-expected` =
 * local snapshots where missing days are normal, `none` = no data at all.
 */
export type ChartSeriesCoverage = 'full' | 'partial' | 'gaps-expected' | 'none';

/** Series metadata shown next to the chart: label, source, freshness, coverage. */
export interface ChartSeriesMeta {
  label: string;
  source: string;
  status: ChartSeriesStatus;
  coverage: ChartSeriesCoverage;
  fetchedAt: string | null;
}

/** A shaped chart series: real points only, plus display metadata. */
export interface ChartSeries {
  points: ChartSeriesPoint[];
  meta: ChartSeriesMeta;
}

/** A selectable range option (`months: 0` = all available data). */
export interface RangeOption {
  key: string;
  label: string;
  months: number;
}

/** A range option with its data-support flag for disabling controls. */
export interface RangeSupport extends RangeOption {
  enabled: boolean;
}

/**
 * Offered ranges. The 5Y ceiling is the provider bound: Yahoo history is
 * clamped to five years by the market adapter, so wider ranges are never
 * offered; `all` shows whatever the source actually holds.
 */
export const CHART_RANGES: readonly RangeOption[] = [
  { key: '3m', label: '3M', months: 3 },
  { key: '6m', label: '6M', months: 6 },
  { key: '1y', label: '1Y', months: 12 },
  { key: '3y', label: '3Y', months: 36 },
  { key: '5y', label: '5Y', months: 60 },
  { key: 'all', label: 'All', months: 0 },
];

/** History reaching within this many days of a window start counts as coverage. */
const RANGE_COVERAGE_SLACK_DAYS = 15;
/** Market history starting more than this far after the window start is partial. */
const MARKET_PARTIAL_GAP_DAYS = 7;
const MS_PER_DAY = 86_400_000;

/**
 * Build an inclusive window ending at the latest usable date and reaching
 * `months` back. Returns null for `months <= 0` (all time) or when no valid
 * calendar date exists; invalid date strings are ignored, never corrected.
 */
export function windowFromRange(dates: readonly string[], months: number): DateWindow | null {
  if (months <= 0) return null;

  const parsed: Date[] = [];
  for (const date of dates) {
    const value = parseCalendarDate(date);
    if (value) parsed.push(value);
  }
  if (parsed.length === 0) return null;

  const end = parsed.reduce((max, value) => (value.getTime() > max.getTime() ? value : max));
  return { start: addMonths(end, -months), end };
}

/**
 * Enable only ranges the data can support: a range is enabled when history
 * reaches within 15 calendar days of the window start (or earlier), or for
 * `all` when any usable date exists. Wider ranges are disabled rather than
 * shown with misleading coverage.
 */
export function supportedRanges(
  dates: readonly string[],
  ranges: readonly RangeOption[] = CHART_RANGES,
): RangeSupport[] {
  const times: number[] = [];
  for (const date of dates) {
    const parsed = parseCalendarDate(date);
    if (parsed) times.push(parsed.getTime());
  }
  if (times.length === 0) {
    return ranges.map((range) => ({ ...range, enabled: false }));
  }

  const earliest = Math.min(...times);
  const latest = Math.max(...times);

  return ranges.map((range) => {
    if (range.months <= 0) return { ...range, enabled: true };
    const windowStart = addMonths(new Date(latest), -range.months).getTime();
    const gapDays = Math.round((earliest - windowStart) / MS_PER_DAY);
    return { ...range, enabled: gapDays <= RANGE_COVERAGE_SLACK_DAYS };
  });
}

function inWindow(date: string, window: DateWindow | null | undefined): boolean {
  if (!window) return true;
  const parsed = parseCalendarDate(date);
  return parsed !== null && isWithinDateRange(parsed, window.start, window.end);
}

/**
 * Shape persisted net-worth snapshots into a chart series. Points are the
 * recorded snapshots only — filtered by the inclusive window and sorted
 * ascending — so sparse history stays sparse and nothing is interpolated.
 */
export function buildSnapshotSeries(
  snapshots: readonly SnapshotPoint[],
  window?: DateWindow | null,
): ChartSeries {
  const points = snapshots
    .filter((snapshot) => inWindow(snapshot.date, window))
    .map((snapshot) => ({ date: snapshot.date, value: snapshot.value }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return {
    points,
    meta: {
      label: 'Net worth',
      source: 'net-worth-snapshots',
      status: 'recorded',
      coverage: 'gaps-expected',
      fetchedAt: null,
    },
  };
}

/**
 * Shape fetched Nifty history into a benchmark chart series. The provider's
 * source, freshness, and fetch time are carried through so the series reads
 * as market benchmark data — never as the user's portfolio. `null` or empty
 * history yields an unavailable state with no points.
 */
export function buildBenchmarkSeries(
  history: HistoricalSeries | null,
  window?: DateWindow | null,
): ChartSeries {
  const meta: ChartSeriesMeta = {
    label: 'Nifty 50 (benchmark)',
    source: history?.source ?? '',
    status: 'unavailable',
    coverage: 'none',
    fetchedAt: history?.fetchedAt ?? null,
  };
  if (!history || history.points.length === 0) {
    return { points: [], meta };
  }

  const points = history.points
    .filter((point) => inWindow(point.date, window))
    .map((point) => ({ date: point.date, value: point.value }));
  if (points.length === 0) {
    return { points, meta };
  }

  meta.status = history.status;
  meta.coverage = 'full';
  if (window) {
    const first = parseCalendarDate(points[0].date);
    if (first && Math.round((first.getTime() - window.start.getTime()) / MS_PER_DAY) > MARKET_PARTIAL_GAP_DAYS) {
      meta.coverage = 'partial';
    }
  }
  return { points, meta };
}

/**
 * Rendered-point ceiling per chart series. The design constraint is <1000 SVG
 * points per chart (O6); long-lived accounts can record far more snapshots than
 * that, so the view is thinned before it reaches the chart.
 */
export const MAX_CHART_POINTS = 500;

/**
 * Thin a series to at most `maxPoints` evenly spaced samples. The first and
 * last recorded points are always kept, so the drawn span stays truthful and
 * nothing is interpolated — intermediate samples are simply omitted. Returns a
 * copy when it already fits, so callers can treat the result as their own.
 */
export function downsampleSeries(
  points: readonly ChartSeriesPoint[],
  maxPoints: number = MAX_CHART_POINTS,
): ChartSeriesPoint[] {
  if (maxPoints <= 0 || points.length <= maxPoints) return points.slice();
  // step > 1 here (length > maxPoints), so rounded indices strictly increase.
  const step = (points.length - 1) / (maxPoints - 1);
  const sampled: ChartSeriesPoint[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    sampled.push(points[Math.round(i * step)]);
  }
  return sampled;
}

/**
 * Derive a drawdown view (percent below the running maximum) from an already
 * shaped series. Dates and metadata are preserved exactly: this only
 * transforms the source series' own values, it never adds or shifts points.
 */
export function buildDrawdownSeries(series: ChartSeries): ChartSeries {
  let peak = Number.NEGATIVE_INFINITY;
  const points = series.points.map((point) => {
    peak = Math.max(peak, point.value);
    const value = peak > 0 ? (point.value / peak - 1) * 100 : 0;
    return { date: point.date, value };
  });

  return { points, meta: { ...series.meta, label: `${series.meta.label} drawdown` } };
}
