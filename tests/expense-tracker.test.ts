import { test, expect } from '@playwright/test';
import { addExpense, calculateExpenseRate } from '../src/modules/trackers/expense-tracker';

test("addExpense records spending with SWP link", () => {
  const expense = {
    date: "2044-01-15",
    category: "food",
    amount: 5000,
    linkedToSWP: true,
  };

  const expenses = addExpense([], expense);
  expect(expenses).toHaveLength(1);
  expect(expenses[0].linkedToSWP).toBe(true);
});

test("calculateExpenseRate validates FI target is on track", () => {
  const expenses = [
    {
      date: "2044-01-15",
      category: "food",
      amount: 50000,
      linkedToSWP: true,
    },
    {
      date: "2044-02-15",
      category: "utilities",
      amount: 15000,
      linkedToSWP: true,
    },
    {
      date: "2044-03-15",
      category: "travel",
      amount: 25000,
      linkedToSWP: true,
    },
  ];

  const rate = calculateExpenseRate(expenses, "2044-01");
  expect(rate.monthlyAverage).toBe(30000); // (50K + 15K + 25K) / 3
});
