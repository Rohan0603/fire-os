export interface Expense {
  date: string; // YYYY-MM-DD
  category: string;
  amount: number;
  linkedToSWP: boolean;
}

interface ExpenseRate {
  monthlyAverage: number;
  totalMonths: number;
  validation: {
    isOnTarget: boolean; // Should be ₹122K/month at FI
    variance: number; // % difference from target
  };
}

export function addExpense(expenses: Expense[], newExpense: Expense): Expense[] {
  return [...expenses, newExpense];
}

export function calculateExpenseRate(
  expenses: Expense[],
  startDate: string
): ExpenseRate {
  if (expenses.length === 0) {
    return {
      monthlyAverage: 0,
      totalMonths: 0,
      validation: { isOnTarget: false, variance: 0 },
    };
  }

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const monthlyAverage = Math.round(totalAmount / expenses.length);

  const target = 122000; // ₹122K/month at FI
  const variance = parseFloat(
    (((monthlyAverage - target) / target) * 100).toFixed(1)
  );

  return {
    monthlyAverage,
    totalMonths: expenses.length,
    validation: {
      isOnTarget: Math.abs(variance) < 10, // Within 10% is OK
      variance,
    },
  };
}

export function renderExpenseTracker(state: any): string {
  const expenses = state.expenses || [];
  const rate = calculateExpenseRate(
    expenses,
    state.swpSchedule?.startDate || new Date().toISOString().split("T")[0]
  );

  const status =
    rate.validation.isOnTarget
      ? "✅ On Target"
      : `⚠️ ${rate.validation.variance > 0 ? "Over" : "Under"} target by ${Math.abs(rate.validation.variance)}%`;

  const contentHtml = expenses.length === 0
    ? "<p style='margin-bottom: 1.5rem; color: var(--text-secondary);'>No expenses tracked yet.</p>"
    : `
      <p>Monthly Average: ₹${(rate.monthlyAverage / 1000).toFixed(0)}K</p>
      <p>Target: ₹122K (3% SWR)</p>
      <p>${status}</p>
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
