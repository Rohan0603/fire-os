/**
 * Dashboard analytics charts over Recharts.
 *
 * Colours come from the OKLCH theme tokens resolved through `getComputedStyle`
 * (SVG presentation attributes do not accept `var()`), refreshed on the
 * `themeChanged` event the theme toggle dispatches. Every series is thinned to
 * at most `MAX_CHART_POINTS` before it reaches the SVG, and each chart exposes
 * a `role="img"` label plus a plain-text provenance line, so the data is
 * readable without the graphic.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button, Card, CardTitle } from '../../ui';
import { formatCurrency } from '../../../lib/formatters';
import {
  CHART_RANGES,
  buildBenchmarkSeries,
  buildDrawdownSeries,
  buildSnapshotSeries,
  downsampleSeries,
  supportedRanges,
  windowFromRange,
  type ChartSeries,
} from '../../../modules/dashboard/chart-data';
import { portfolioComposition, fiProgress } from '../../../modules/dashboard/kpis';
import type { FireOSState } from '../../../types/state';
import type { HistoricalSeries } from '../../../types/api';

interface ChartColors {
  accent: string;
  danger: string;
  primary: string;
  axis: string;
  grid: string;
  slices: string[];
}

function resolveToken(token: string, fallback: string): string {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback;
}

function resolveChartColors(): ChartColors {
  return {
    accent: resolveToken('--color-accent', '#00875a'),
    danger: resolveToken('--color-destructive', '#c0392b'),
    primary: resolveToken('--color-primary', '#3b4fa0'),
    axis: resolveToken('--color-muted-foreground', '#6b7280'),
    grid: resolveToken('--color-border', '#d1d5db'),
    slices: [
      resolveToken('--color-primary', '#3b4fa0'),
      resolveToken('--color-accent', '#00875a'),
      resolveToken('--color-warning', '#b26a00'),
      resolveToken('--color-destructive', '#c0392b'),
      '#6f42c1',
      '#20c997',
      '#fd7e14',
    ],
  };
}

function useChartColors(): ChartColors {
  const [colors, setColors] = useState(resolveChartColors);
  useEffect(() => {
    const onChange = () => setColors(resolveChartColors());
    window.addEventListener('themeChanged', onChange);
    return () => window.removeEventListener('themeChanged', onChange);
  }, []);
  return colors;
}

function rangeMonths(key: string): number {
  return CHART_RANGES.find((range) => range.key === key)?.months ?? 0;
}

/** Plain-text provenance line: source, freshness, coverage, span, point count. */
function seriesMetaText(series: ChartSeries, totalPoints: number = series.points.length): string {
  const { meta, points } = series;
  const parts: string[] = [meta.source || 'unknown source'];
  parts.push(meta.status === 'stale' ? 'stale (cached)' : meta.status);
  if (meta.fetchedAt) parts.push(`fetched ${meta.fetchedAt.slice(0, 10)}`);
  if (points.length > 0) {
    parts.push(`${totalPoints} points`, `${points[0].date} to ${points[points.length - 1].date}`);
  }
  if (totalPoints > points.length) parts.push(`showing ${points.length} of ${totalPoints}`);
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

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="flex min-w-0 flex-col gap-3">
      <CardTitle>{title}</CardTitle>
      {children}
    </Card>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-(--color-muted-foreground)">{children}</p>;
}

function RangeButtons({
  idPrefix,
  ariaLabel,
  options,
  active,
  onSelect,
}: {
  idPrefix: string;
  ariaLabel: string;
  options: readonly { key: string; label: string; enabled: boolean }[];
  active: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <Button
          key={option.key}
          id={`${idPrefix}-${option.key}`}
          size="sm"
          variant={option.key === active ? 'primary' : 'ghost'}
          aria-pressed={option.key === active}
          disabled={!option.enabled}
          onClick={() => onSelect(option.key)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

/** Asset-class composition pie with an always-visible HTML legend. */
export function CompositionCard({ state }: { state: FireOSState }) {
  const colors = useChartColors();
  const composition = portfolioComposition(state);
  const title = 'Portfolio Breakdown';

  if (composition.categories.length === 0) {
    return (
      <ChartCard title={title}>
        <EmptyState>No holdings yet. Add data in Profile tab.</EmptyState>
      </ChartCard>
    );
  }

  const data = composition.categories.map((cat) => ({ name: cat.name, value: cat.value }));
  const ariaLabel = `Portfolio composition: ${composition.categories
    .map((cat) => `${cat.name} ${cat.percentage.toFixed(0)}%`)
    .join(', ')}`;

  return (
    <ChartCard title={title}>
      <div className="mx-auto h-56 w-full max-w-xs" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              outerRadius="80%"
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={resolveSlice(colors, index)} />
              ))}
            </Pie>
            <Tooltip formatter={(value: unknown) => formatCurrency(Number(value), 0)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-col gap-2">
        {composition.categories.map((cat, index) => (
          <li key={cat.name} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: resolveSlice(colors, index) }}
            />
            <span className="text-(--color-foreground)">{cat.name}</span>
            <span className="ml-auto text-(--color-muted-foreground)">
              {`${cat.percentage.toFixed(0)}% • ${formatCurrency(cat.value, 0)}`}
            </span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

function resolveSlice(colors: ChartColors, index: number): string {
  return colors.slices[index % colors.slices.length];
}

/** Net-worth snapshot trend from persisted history only (no interpolation). */
export function NetWorthTrendCard({ state }: { state: FireOSState }) {
  const colors = useChartColors();
  const [rangeKey, setRangeKey] = useState('all');
  const title = 'Net Worth Trend';

  const snapshotDates = state.netWorthHistory.map((snapshot) => snapshot.date);
  const raw = buildSnapshotSeries(
    state.netWorthHistory,
    windowFromRange(snapshotDates, rangeMonths(rangeKey)),
  );
  if (raw.points.length === 0) {
    return (
      <ChartCard title={title}>
        <EmptyState>No history recorded yet. Snapshots are taken automatically.</EmptyState>
      </ChartCard>
    );
  }

  const points = downsampleSeries(raw.points);
  const series: ChartSeries = { ...raw, points };

  return (
    <ChartCard title={title}>
      <p id="networth-chart-meta" className="text-xs text-(--color-muted-foreground)">
        {seriesMetaText(series, snapshotDates.length ? state.netWorthHistory.length : 0)}
      </p>
      <RangeButtons
        idPrefix="nw"
        ariaLabel="Net worth range"
        options={supportedRanges(snapshotDates)}
        active={rangeKey}
        onSelect={setRangeKey}
      />
      <div className="h-64 w-full min-w-0" role="img" aria-label={seriesAriaText(series)}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: colors.axis, fontSize: 11 }} minTickGap={24} />
            <YAxis
              width={64}
              tick={{ fill: colors.axis, fontSize: 11 }}
              tickFormatter={(value: unknown) => formatCurrency(Number(value), 0)}
            />
            <Tooltip
              formatter={(value: unknown) => formatCurrency(Number(value), 0)}
              labelFormatter={(label: unknown) => String(label)}
            />
            <Line
              type="linear"
              dataKey="value"
              stroke={colors.accent}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/** FI goal progress as a headline figure (no fabricated projection). */
export function FiGoalCard({ state }: { state: FireOSState }) {
  const fi = fiProgress(state);
  const remaining = Math.max(0, fi.fiTarget - fi.currentCorpus);
  return (
    <ChartCard title="FI Goal Progress">
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <p className="text-4xl font-bold text-(--color-accent)">{`${fi.progressPercent.toFixed(0)}%`}</p>
        <p className="text-sm text-(--color-foreground)">
          {`${formatCurrency(fi.currentCorpus, 0)} / ${formatCurrency(fi.fiTarget, 0)}`}
        </p>
        <p className="text-xs text-(--color-muted-foreground)">
          {remaining > 0 ? `${formatCurrency(remaining, 0)} remaining` : 'FI achieved'}
        </p>
      </div>
    </ChartCard>
  );
}

/** Nifty 50 benchmark, fetched market history only, performance or drawdown. */
export function BenchmarkCard({ history }: { history: HistoricalSeries | null }) {
  const colors = useChartColors();
  const [rangeKey, setRangeKey] = useState('1y');
  const [view, setView] = useState<'performance' | 'drawdown'>('performance');
  const title = 'Nifty 50 Benchmark';

  const pointDates = (history?.points ?? []).map((point) => point.date);
  const raw = buildBenchmarkSeries(history, windowFromRange(pointDates, rangeMonths(rangeKey)));
  if (raw.points.length === 0) {
    return (
      <ChartCard title={title}>
        <EmptyState>Market history unavailable — current dashboard values are unaffected.</EmptyState>
      </ChartCard>
    );
  }

  const displayed = view === 'drawdown' ? buildDrawdownSeries(raw) : raw;
  const points = downsampleSeries(displayed.points);
  const series: ChartSeries = { ...displayed, points };
  const chartData = points.map((point) => ({ date: point.date, value: point.value }));
  const rangeOptions = supportedRanges(pointDates);

  return (
    <ChartCard title={title}>
      <p id="benchmark-chart-meta" className="text-(--color-muted-foreground) text-xs">
        {seriesMetaText(series, displayed.points.length)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <RangeButtons
          idPrefix="bm"
          ariaLabel="Benchmark range"
          options={rangeOptions}
          active={rangeKey}
          onSelect={setRangeKey}
        />
        <div className="flex gap-1" role="group" aria-label="Benchmark view">
          <Button
            id="bm-view-performance"
            size="sm"
            variant={view === 'performance' ? 'primary' : 'ghost'}
            aria-pressed={view === 'performance'}
            onClick={() => setView('performance')}
          >
            Performance
          </Button>
          <Button
            id="bm-view-drawdown"
            size="sm"
            variant={view === 'drawdown' ? 'primary' : 'ghost'}
            aria-pressed={view === 'drawdown'}
            onClick={() => setView('drawdown')}
          >
            Drawdown
          </Button>
        </div>
      </div>
      <div className="h-64 w-full min-w-0" role="img" aria-label={seriesAriaText(series)}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: colors.axis, fontSize: 11 }} minTickGap={24} />
            <YAxis
              tick={{ fill: colors.axis, fontSize: 11 }}
              width={64}
              tickFormatter={(value: unknown) =>
                view === 'drawdown' ? `${Number(value).toFixed(0)}%` : formatCurrency(Number(value), 0)
              }
            />
            <Tooltip
              formatter={(value: unknown) =>
                view === 'drawdown' ? `${Number(value).toFixed(2)}%` : formatCurrency(Number(value), 0)
              }
            />
            <Line
              type="linear"
              dataKey="value"
              stroke={view === 'drawdown' ? colors.danger : colors.primary}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
