/**
 * Dashboard side widgets: annual cashflow, SWP schedule, tax calendar,
 * CFP advisor review and the SWP expense tracker.
 *
 * These are the React replacements for the `render*Widget` HTML from the legacy
 * dashboard. They read the shared `appState` directly and persist through the
 * same portfolio repository, so a save re-renders every `usePortfolioSaved`
 * consumer without an imperative repaint.
 */
import { useState } from 'react';
import { Button, Card, CardTitle, Dialog, FieldLabel, Input } from '../../ui';
import { formatCurrency } from '../../../lib/formatters';
import { getFundSchemeCode } from '../../../lib/fundMatcher';
import { calculateAllocationDrift } from '../../../modules/calculators/portfolio-rebalancing';
import { totalNetWorth } from '../../../modules/dashboard/kpis';
import { registerAdvisorReview } from '../../../modules/integrations/advisor-webhook';
import { addExpense, calculateExpenseRate, type Expense } from '../../../modules/trackers/expense-tracker';
import { showToast } from '../../../modules/ui/Toast';
import { createPortfolioRepository } from '../../../core/persistence/portfolio-repository';
import type { FireOSState } from '../../../types/state';

const EXPENSE_CATEGORIES = ['SWP', 'Rent', 'Food', 'Travel', 'Utilities', 'Other'] as const;

function StatRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-(--color-muted-foreground)">{label}</span>
      <span className={valueClass ?? 'text-(--color-foreground)'}>{value}</span>
    </div>
  );
}

/** Annual income vs expenses with savings rate; parity with the legacy card. */
export function CashflowSummary({ state }: { state: FireOSState }) {
  const annualIncome = (state.profile.monthlyIncome || 0) * 12;
  const annualExpenses = (state.profile.annualExpenses || 0) * 12;

  if (!annualIncome) {
    return (
      <Card>
        <p className="text-sm text-(--color-muted-foreground)">
          Add your monthly income in the Profile tab to see your annual cashflow.
        </p>
      </Card>
    );
  }

  const surplus = annualIncome - annualExpenses;
  const savingsRate = annualIncome > 0 ? (surplus / annualIncome) * 100 : 0;

  return (
    <Card className="flex flex-col gap-2">
      <CardTitle>Annual Cashflow</CardTitle>
      <StatRow label="Income (post-tax estimate)" value={formatCurrency(annualIncome, 0)} />
      <StatRow label="Expenses" value={formatCurrency(annualExpenses, 0)} />
      <StatRow
        label="Surplus"
        value={formatCurrency(surplus, 0)}
        valueClass={surplus >= 0 ? 'text-(--color-accent)' : 'text-(--color-destructive)'}
      />
      <StatRow label="Savings Rate" value={`${savingsRate.toFixed(0)}%`} />
    </Card>
  );
}

/** SWP start date and monthly amount; rendered only when the schedule is on. */
export function SwpScheduleWidget({ state }: { state: FireOSState }) {
  const { swpSchedule } = state;
  return (
    <Card className="flex flex-col gap-2">
      <CardTitle>SWP Schedule</CardTitle>
      <StatRow label="Status" value="Active" />
      <StatRow label="Monthly Amount" value={formatCurrency(swpSchedule.monthlyAmount, 0)} />
      <StatRow label="Start Date" value={swpSchedule.startDate} />
    </Card>
  );
}

/** LTCG harvest target and last harvest date from the tax calendar. */
export function TaxOptimizationWidget({ state }: { state: FireOSState }) {
  const { taxCalendar } = state;
  return (
    <Card className="flex flex-col gap-2">
      <CardTitle>Tax Optimization</CardTitle>
      <StatRow label="LTCG Harvest Target" value={formatCurrency(taxCalendar.harvestTarget, 0)} />
      <StatRow label="Last Harvest" value={taxCalendar.lastLTCGHarvestDate || 'None'} />
    </Card>
  );
}

/** Request a CFP review of the current allocation; opens the returned link. */
export function AdvisorWidget({ state }: { state: FireOSState }) {
  const [requesting, setRequesting] = useState(false);

  const requestReview = async () => {
    setRequesting(true);
    try {
      const holdings: Record<string, number> = { PPFCF: 0, NipponGrowth: 0, NipponSmallCap: 0, Gold: 0 };
      const processFund = (fund: { name: string; schemeCode?: string; units: number }) => {
        const schemeCode = fund.schemeCode || getFundSchemeCode(fund.name);
        const nav = schemeCode ? (state.nav[schemeCode]?.nav ?? 0) : 0;
        const value = fund.units * nav;
        if (value <= 0) return;
        if (schemeCode === '122639') holdings.PPFCF += value;
        else if (schemeCode === '118668') holdings.NipponGrowth += value;
        else if (schemeCode === '118778') holdings.NipponSmallCap += value;
        else if (schemeCode === '135106') holdings.Gold += value;
      };
      Object.values(state.sip || {}).forEach(processFund);
      Object.values(state.mf || {}).forEach(processFund);

      const netWorth = totalNetWorth(state).netWorth;
      const drift = calculateAllocationDrift(holdings, netWorth);
      const result = await registerAdvisorReview({
        userEmail: state.currentUser?.email || 'user@example.com',
        portfolioSummary: { totalCorpus: netWorth, allocation: drift.current },
      });

      if (result.status === 'review_request_sent' && result.reviewUrl) {
        showToast('Review request sent! Opening link…', 3000, 'success');
        window.open(result.reviewUrl, '_blank');
      } else {
        showToast(result.error || 'Failed to request review', 4000, 'warning');
      }
    } catch {
      showToast('Error requesting review', 4000, 'warning');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Card className="flex flex-col gap-2">
      <CardTitle>Certified Financial Planner Review</CardTitle>
      <p className="text-sm text-(--color-muted-foreground)">
        Get an expert review of your portfolio allocation and SWP strategy.
      </p>
      <Button
        id="request-advisor-review-btn"
        variant="secondary"
        disabled={requesting}
        onClick={() => void requestReview()}
      >
        {requesting ? 'Requesting…' : 'Request Review'}
      </Button>
      <p className="text-xs text-(--color-muted-foreground)">
        Optional. Your portfolio summary will be shared with the CFP.
      </p>
    </Card>
  );
}

/** SWP expense log with an add-expense dialog and running monthly average. */
export function ExpenseTracker({ state }: { state: FireOSState }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('SWP');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const expenses = state.expenses ?? [];
  const rate = calculateExpenseRate(expenses, state.swpSchedule.startDate);

  const submit = () => {
    const parsed = Number.parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter a valid positive amount');
      return;
    }
    const expense: Expense = { date, category, amount: parsed, linkedToSWP: category === 'SWP' };
    state.expenses = addExpense(expenses, expense);
    createPortfolioRepository().save(state);
    showToast('Expense added successfully', 3000, 'success');
    setAmount('');
    setError(null);
    setOpen(false);
  };

  return (
    <Card className="flex flex-col gap-2">
      <CardTitle>SWP Expense Tracking</CardTitle>
      {expenses.length === 0 ? (
        <p className="text-sm text-(--color-muted-foreground)">No expenses tracked yet.</p>
      ) : (
        <div className="flex flex-col gap-1">
          <StatRow label="Monthly Average" value={formatCurrency(rate.monthlyAverage, 0)} />
          <StatRow label="Target" value={formatCurrency(122000, 0)} />
          <StatRow
            label="Status"
            value={
              rate.validation.isOnTarget
                ? 'On target'
                : `${rate.validation.variance > 0 ? 'Over' : 'Under'} target by ${Math.abs(rate.validation.variance)}%`
            }
            valueClass={rate.validation.isOnTarget ? 'text-(--color-accent)' : 'text-(--color-warning)'}
          />
          <StatRow label="Months tracked" value={String(rate.totalMonths)} />
        </div>
      )}
      <Button id="add-expense-btn" variant="primary" onClick={() => setOpen(true)}>
        Add Expense
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
        title="Add Expense"
        description="Log an SWP-linked expense."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit}>
              Add
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            id="expense-amount"
            label="Amount (₹)"
            type="number"
            min="0"
            inputMode="decimal"
            placeholder="e.g. 5000"
            value={amount}
            error={error ?? undefined}
            onChange={(event) => setAmount(event.target.value)}
          />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="expense-category">Category</FieldLabel>
            <select
              id="expense-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full cursor-pointer rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-2 text-sm text-(--color-foreground) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-ring)"
            >
              {EXPENSE_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <Input
            id="expense-date"
            label="Date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
      </Dialog>
    </Card>
  );
}
