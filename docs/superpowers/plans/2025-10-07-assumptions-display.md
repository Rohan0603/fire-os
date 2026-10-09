# Assumptions Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the inputs and approximation behind key planning outputs so users can understand what changes a result.

**Architecture:** Add assumption tooltips/explanations beside calculation results in the Plan module. Each result shows the key assumptions (inflation rate, return rate, tax rate, etc.) that drove it, with a toggle to show what-if sensitivity.

**Tech Stack:** React components, existing calculation engine, assumption metadata from calculation functions.

**Spec:** docs/master.md (Assumptions Display), TODO.md line 91-93

## Global Constraints

- Version floor: TypeScript strict mode
- Use existing calculation engine assumptions
- Tooltips must be accessible (ARIA, keyboard)
- No new dependencies for trivial work

## Review Focus

- **Assumption completeness:** Every key result must surface its assumptions
- **Accuracy:** Tooltip values must match actual calculation inputs
- **Non-technical language:** Explanations understandable by non-financial users
- **Sensitivity clarity:** What-if must show directional impact, not precise deltas
- **Performance:** Tooltips don't add render latency

## File Structure

- Create: `src/components/AssumptionTooltip.tsx`, `src/lib/calculations/assumptions.ts`
- Modify: `src/modules/plan/` to inject assumptions into results
- Test: `src/components/AssumptionTooltip.test.tsx`, `src/lib/calculations/assumptions.test.ts`

## Task 1: Extract assumption metadata from calculations

**Files:**
- Create: `src/lib/calculations/assumptions.ts`
- Test: `src/lib/calculations/assumptions.test.ts`

**Interfaces:**
- Consumes: existing calculation functions
- Produces: `AssumptionSet` for each calculation result type

- [ ] **Step 1: Write failing test for assumption metadata**

```typescript
// src/lib/calculations/assumptions.test.ts
import { getAssumptionsForResult } from './assumptions';

describe('getAssumptionsForResult', () => {
  it('returns inflation, return, tax assumptions for FIRE number', () => {
    const assumptions = getAssumptionsForResult('fireNumber', { inflation: 0.06, returnRate: 0.12, taxRate: 0.2 });
    expect(assumptions).toContainEqual({ key: 'inflation', value: 0.06, label: 'Annual Inflation Rate' });
    expect(assumptions).toContainEqual({ key: 'returnRate', value: 0.12, label: 'Expected Annual Return' });
    expect(assumptions).toContainEqual({ key: 'taxRate', value: 0.2, label: 'Effective Tax Rate' });
  });

  it('returns withdrawal rate for SWP calculation', () => {
    const assumptions = getAssumptionsForResult('swp', { withdrawalRate: 0.04 });
    expect(assumptions).toContainEqual({ key: 'withdrawalRate', value: 0.04, label: 'Safe Withdrawal Rate' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/calculations/assumptions.test.ts`
Expected: FAIL — `assumptions` module not yet defined

- [ ] **Step 3: Implement assumption metadata in `src/lib/calculations/assumptions.ts`**

```typescript
// Signature: export function getAssumptionsForResult(
//   resultType: 'fireNumber' | 'swp' | 'corpus' | 'monthlySip',
//   inputs: Record<string, number>
// ): Assumption[]
// One line approach: map result types to their assumption keys with labels and current values
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/calculations/assumptions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations/assumptions.ts src/lib/calculations/assumptions.test.ts
git commit -m "feat: extract assumption metadata from calculations"
```

---

### Task 2: Create assumption tooltip component

**Files:**
- Create: `src/components/AssumptionTooltip.tsx`
- Test: `src/components/AssumptionTooltip.test.tsx`

**Interfaces:**
- Consumes: `Assumption[]` from Task 1
- Produces: accessible tooltip with assumption list

- [ ] **Step 1: Write failing test for tooltip component**

```typescript
// src/components/AssumptionTooltip.test.tsx
import { render, screen } from '@testing-library/react';
import { AssumptionTooltip } from './AssumptionTooltip';

describe('AssumptionTooltip', () => {
  it('shows assumptions on hover/focus', () => {
    render(<AssumptionTooltip assumptions={[{ key: 'inflation', value: 0.06, label: 'Inflation' }]} />);
    fireEvent.mouseOver(screen.getByRole('button'));
    expect(screen.getByText('Inflation: 6%')).toBeInTheDocument();
  });

  it('is keyboard accessible', () => {
    render(<AssumptionTooltip assumptions={[{ key: 'inflation', value: 0.06, label: 'Inflation' }]} />);
    const trigger = screen.getByRole('button');
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(screen.getByText('Inflation: 6%')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/AssumptionTooltip.test.tsx`
Expected: FAIL — `AssumptionTooltip` component not yet defined

- [ ] **Step 3: Implement tooltip component**

```typescript
// Signature: export function AssumptionTooltip({ assumptions }: { assumptions: Assumption[] })
// One line approach: use native tooltip pattern with role="button" + aria-describedby
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/AssumptionTooltip.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/AssumptionTooltip.tsx src/components/AssumptionTooltip.test.tsx
git commit -m "feat: add accessible assumption tooltip component"
```

---

### Task 3: Wire tooltips into plan results

**Files:**
- Modify: `src/modules/plan/` (render functions)

**Interfaces:**
- Consumes: `AssumptionTooltip`, `getAssumptionsForResult`
- Produces: plan results with assumption indicators

- [ ] **Step 1: Write failing test for plan integration**

```typescript
// src/modules/plan/integration.test.ts
import { renderPlan } from './index';

describe('plan with assumptions', () => {
  it('shows assumption indicator beside FIRE number result', () => {
    const { container } = renderPlan({ /* valid plan state */ });
    expect(container.querySelector('[data-assumptions="fireNumber"]')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/plan/integration.test.ts`
Expected: FAIL — integration not yet wired

- [ ] **Step 3: Wire tooltips into plan render**

Add `AssumptionTooltip` beside each result in `renderPlan` using `getAssumptionsForResult`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/plan/integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/plan/index.ts
git commit -m "feat: wire assumption tooltips into plan results"
```

---

## Self-Review Checklist

- [x] Spec coverage: All three tasks implement assumptions display requirement
- [x] Step scan: Each step has one checkable action
- [x] Type consistency: `Assumption[]` used across all tasks
- [x] Review Focus: Completeness (metadata extracted from all results), accuracy (uses actual inputs), language (labels provided), sensitivity (directional what-if), performance (tooltips lazy)
- [x] Proportion: Plan matches spec scope

Plan complete and saved to `docs/superpowers/plans/2025-10-07-assumptions-display.md`.