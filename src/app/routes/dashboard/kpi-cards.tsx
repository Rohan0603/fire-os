import { Card, cn } from '../../ui';
import { formatCurrency } from '../../../lib/formatters';
import { calculateGoalProgress } from '../../../modules/dashboard/goal-tracker';
import { fiProgress, floatIndicator, sipStatus, totalNetWorth } from '../../../modules/dashboard/kpis';
import type { FireOSState, Goal } from '../../../types/state';

const TONE_CLASS = {
  positive: 'text-(--color-accent)',
  negative: 'text-(--color-destructive)',
  neutral: 'text-(--color-foreground)',
} as const;

function KpiCard({
  label,
  value,
  detail,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: keyof typeof TONE_CLASS;
  className?: string;
}) {
  return (
    <Card className={cn('flex flex-col gap-1', className)}>
      <p className="text-xs font-semibold tracking-wide text-(--color-muted-foreground) uppercase">
        {label}
      </p>
      <p className={cn('text-2xl font-bold tabular-nums', TONE_CLASS[tone])}>{value}</p>
      <p className="text-xs text-(--color-muted-foreground)">{detail}</p>
    </Card>
  );
}

/** Net worth, SIP P&L, FI progress and market drawdown, computed from state. */
export function KpiRow({ state }: { state: FireOSState }) {
  const nw = totalNetWorth(state);
  const sip = sipStatus(state);
  const fi = fiProgress(state);
  const nifty = floatIndicator(state);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard
        className="sm:col-span-2 xl:col-span-2"
        label="Total Net Worth"
        value={formatCurrency(nw.netWorth, 0)}
        detail={`Assets ${formatCurrency(nw.assets, 0)} • Liabilities ${formatCurrency(nw.liabilities, 0)}`}
      />
      <KpiCard
        label="SIP P&L"
        value={formatCurrency(sip.totalPL, 0)}
        detail={`Invested ${formatCurrency(sip.totalInvested, 0)} • Current ${formatCurrency(sip.totalCurrentValue, 0)}`}
        tone={sip.totalPL >= 0 ? 'positive' : 'negative'}
      />
      <KpiCard
        label="FI Progress"
        value={`${fi.progressPercent.toFixed(0)}%`}
        detail={
          fi.fiTarget > 0
            ? fi.yearsRemaining === null
              ? 'Years remaining: not yet achieved'
              : 'Financial independence achieved'
            : 'No FI target set'
        }
      />
      <KpiCard
        label="Market Drawdown"
        value={`${nifty.drawdownPercent.toFixed(0)}%`}
        detail="From 52-week high"
      />
    </div>
  );
}

const ASSET_CLASSES = [
  ['mf', 'Mutual Funds'],
  ['sip', 'SIPs'],
  ['fd', 'Fixed Deposits'],
  ['epf', 'EPF'],
  ['bonds', 'Bonds'],
  ['esop', 'ESOP'],
  ['demat', 'Equity (Demat)'],
  ['otherHoldings', 'Other Holdings'],
] as const;

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-xs font-semibold text-(--color-muted-foreground)">{label}</p>
      <p className="text-lg font-bold tabular-nums text-(--color-foreground)">{value}</p>
    </Card>
  );
}

function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const value = Math.min(Math.max(percent, 0), 100);
  return (
    <Card className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-(--color-muted-foreground)">{label}</p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-(--color-muted)"
      >
        <div className="h-full rounded-full bg-(--color-accent)" style={{ width: `${value}%` }} />
      </div>
      <p className="text-xs text-(--color-muted-foreground)">{percent.toFixed(0)}%</p>
    </Card>
  );
}

function GoalProgressCard({ goal, today }: { goal: Goal; today: string }) {
  let progress: ReturnType<typeof calculateGoalProgress>;
  try {
    progress = calculateGoalProgress({
      currentCorpus: goal.currentAmount,
      targetCorpus: goal.targetToday,
      currentDate: today,
      sipStartDate: goal.targetDate,
    });
  } catch {
    // Missing or malformed target date: skip this goal rather than crash the dashboard.
    return null;
  }
  const statusText =
    progress.status === 'planning'
      ? goal.monthlyContribution
        ? `SIP ₹${goal.monthlyContribution.toLocaleString('en-IN')}/mo • starts in ${Math.round(progress.yearsUntilStart)} years`
        : `Starts in ${Math.round(progress.yearsUntilStart)} years`
      : progress.status === 'in_progress'
        ? 'Funding in progress'
        : 'Target reached';
  return (
    <Card className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-(--color-muted-foreground)">{goal.name}</p>
      <div
        role="progressbar"
        aria-label={`${goal.name} progress`}
        aria-valuenow={Math.round(progress.percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-(--color-muted)"
      >
        <div
          className="h-full rounded-full bg-(--color-warning)"
          style={{ width: `${Math.min(progress.percentage, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-(--color-muted-foreground)">
        <span>{`${formatCurrency(goal.currentAmount, 0)} / ${formatCurrency(goal.targetToday, 0)}`}</span>
        <span>
          {progress.remainingAmount > 0
            ? `${formatCurrency(progress.remainingAmount, 0)} remaining`
            : 'Target achieved'}
        </span>
      </div>
      <p className="text-xs text-(--color-muted-foreground)">{statusText}</p>
    </Card>
  );
}

/** Progress cards for each user-defined planning goal. */
function GoalCards({ state }: { state: FireOSState }) {
  if (state.goals.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      {state.goals.map((goal) => (
        <GoalProgressCard key={goal.id} goal={goal} today={today} />
      ))}
    </>
  );
}

/** Asset-class bento, FI progress bar and planning goals. */
export function PortfolioSummary({ state }: { state: FireOSState }) {
  const { breakdown } = totalNetWorth(state);
  const fi = fiProgress(state);

  return (
    <section aria-labelledby="portfolio-summary-heading" className="flex flex-col gap-4">
      <h2
        id="portfolio-summary-heading"
        className="text-base font-semibold text-(--color-foreground)"
      >
        Portfolio Summary
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="col-span-2 flex flex-col gap-1">
          <p className="text-xs font-semibold text-(--color-muted-foreground)">Total Corpus</p>
          <p className="text-xl font-bold tabular-nums text-(--color-foreground)">
            {formatCurrency(fi.currentCorpus, 0)}
          </p>
        </Card>
        <SummaryStat label="FI Target" value={formatCurrency(fi.fiTarget, 0)} />
        <SummaryStat label="Annual Expenses" value={formatCurrency((state.profile.annualExpenses || 0) * 12, 0)} />
        <SummaryStat label="Monthly Buffer" value={formatCurrency(state.profile.annualExpenses || 0, 0)} />
        {ASSET_CLASSES.map(([key, label]) => (
          <SummaryStat key={key} label={label} value={formatCurrency(breakdown[key], 0)} />
        ))}
      </div>
      <ProgressBar percent={fi.progressPercent} label="Financial Independence Progress" />
      <GoalCards state={state} />
    </section>
  );
}
