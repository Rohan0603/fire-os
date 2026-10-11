export interface Expense {
  date: string; // YYYY-MM-DD
  category: string;
  amount: number;
  linkedToSWP: boolean;
}

interface ExpenseRate {
  monthlyAverage: number;
  totalMonths: number;
}

export function addExpense(expenses: Expense[], newExpense: Expense): Expense[] {
  return [...expenses, newExpense];
}

/** Average of the user's own recorded expenses; no hardcoded target. */
export function calculateExpenseRate(
  expenses: Expense[],
  _startDate: string
): ExpenseRate {
  if (expenses.length === 0) {
    return {
      monthlyAverage: 0,
      totalMonths: 0,
    };
  }

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const monthlyAverage = Math.round(totalAmount / expenses.length);

  return {
    monthlyAverage,
    totalMonths: expenses.length,
  };
}

export function renderExpenseTracker(state: any): string {
  const expenses = state.expenses || [];
  const rate = calculateExpenseRate(
    expenses,
    state.swpSchedule?.startDate || new Date().toISOString().split("T")[0]
  );

  const contentHtml = expenses.length === 0
    ? "<p style='margin-bottom: 1.5rem; color: var(--text-secondary);'>No expenses tracked yet.</p>"
    : `
      <p>Monthly Average: ₹${Math.round(rate.monthlyAverage / 1000)}K</p>
      <p>Total SWP withdrawals: ${rate.totalMonths} months</p>
    `;

  return `
    <div class="expense-tracker">
      <h3>SWP Expense Tracking</h3>
      ${contentHtml}
      <button id="add-expense-btn" class="btn btn-primary">+ Add Expense</button>
    </div>
  `;
}
