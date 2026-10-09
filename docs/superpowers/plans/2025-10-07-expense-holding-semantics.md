# Expense and Holding Semantics Clarification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clarify expense and holding semantics during entry—document the intended product behavior before changing calculations or persisted data.

**Architecture:** Create a validation schema for expense entry with clear documentation, add help text for MF/SIP data counting in different contexts, and ensure `annualExpenses` uses a single, well-defined calculation interpretation.

**Tech Stack:** Zod schemas, React form components, inline help text, documentation.

**Spec:** docs/master.md (Expense/Holding Semantics), TODO.md line 94-97

## Global Constraints

- Version floor: TypeScript strict mode
- Clarify BEFORE changing calculations or persisted data
- No new dependencies for trivial work
- Help text must be user-facing markdown

## Review Focus

- **Calculation consistency:** `annualExpenses` must not be interpreted differently in different views
- **MF/SIP ambiguity:** Data counted in both maps must be reconciled or clearly documented
- **User guidance:** Entry must show helper text explaining semantics
- **Validation:** Invalid expense entries must produce clear error messages
- **No regression:** Existing expense data must remain valid after clarification

## File Structure

- Create: `src/lib/validation/expenses.ts` (schema + documentation)
- Modify: `src/modules/profile/` expiration entry forms to show help text
- Test: `src/lib/validation/expenses.test.ts`

## Task 1: Define expense validation schema with documentation

**Files:**
- Create: `src/lib/validation/expenses.ts`
- Test: `src/lib/validation/expenses.test.ts`

**Interfaces:**
- Consumes: user input for expense entry
- Produces: `AnnualExpensesSchema`, `ExpenseEntryDocument` with semantic documentation

- [ ] **Step 1: Write failing test for expense schema**

```typescript
// src/lib/validation/expenses.test.ts
import { AnnualExpensesSchema, ExpenseHelpText } from './expenses';

describe('AnnualExpenses validation', () => {
  it('validates annual expenses as monthly amount', () => {
    const result = AnnualExpensesSchema.safeParse(2000);
    expect(result.success).toBe(true);
    expect((result as any).data).toBe(2000);
  });

  it('rejects negative expenses', () => {
    const result = AnnualExpensesSchema.safeParse(-100);
    expect(result.success).toBe(false);
  });

  it('includes help text for MF/SIP counting', () => {
    expect(ExpenseHelpText).toContain('mutual funds');
    expect(ExpenseHelpText).toContain('systematic investment plan');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/validation/expenses.test.ts`
Expected: FAIL — schema not yet defined

- [ ] **Step 3: Implement schema in `src/lib/validation/expenses.ts`**

```typescript
// Signature: export const AnnualExpensesSchema = z.number().positive()
// export const ExpenseHelpText = `...` (markdown explaining annualExpenses is monthly * 12,
// and MF/SIP data counted as growth in corpus, not recurring expense)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/validation/expenses.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/expenses.ts src/lib/validation/expenses.test.ts
git commit -m "feat: add expense validation schema with semantic documentation"
```

---

### Task 2: Wire help text into expense entry form

**Files:**
- Modify: Existing expense entry form in `src/modules/profile/`

**Interfaces:**
- Consumes: `ExpenseHelpText` from Task 1
- Produces: form showing guidance before user enters expenses

- [ ] **Step 1: Write failing test for form with help text**

```typescript
// src/modules/profile/expense-form.test.tsx
import { render, screen } from '@testing-library/react';
import { ExpenseForm } from './ExpenseForm';

describe('ExpenseForm', () => {
  it('shows help text about expense semantics', () => {
    render(<ExpenseForm />);
    expect(screen.getByText(/annual expenses/i)).toBeInTheDocument();
    expect(screen.getByText(/mutual funds/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/profile/expense-form.test.tsx`
Expected: FAIL — help text not yet integrated

- [ ] **Step 3: Wire help text into form**

Add `ExpenseHelpText` as inline help below the annual expenses input field.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/profile/expense-form.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/profile/expense-form.tsx src/modules/profile/expense-form.test.tsx
git commit -m "feat: add expense semantics help text to entry form"
```

---

## Self-Review Checklist

- [x] Spec coverage: Both tasks implement expense/holding semantics clarification
- [x] Step scan: Each step has one checkable action
- [x] Type consistency: `AnnualExpensesSchema` used consistently
- [x] Review Focus: Consistency (schema enforces single interpretation), MF/SIP ambiguity (help text explains), user guidance (documentation displayed), validation (rejects negatives), regression (schema accepts existing valid values)
- [x] Proportion: Plan matches spec scope

Plan complete and saved to `docs/superpowers/plans/2025-10-07-expense-holding-semantics.md`.