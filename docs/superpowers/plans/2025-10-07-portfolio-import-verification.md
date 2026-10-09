# Portfolio Import Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a before/after summary for CAS imports and CSV/JSON restore so users can verify portfolio changes.

**Architecture:** After any portfolio import, compare the portfolio state before and after, generate a diff summary, display it to the user, and require confirmation before persisting changes.

**Tech Stack:** React components, existing import logic, data comparison utilities, diff UI.

**Spec:** docs/master.md (Portfolio Import Verification), TODO.md line 76-78

## Global Constraints

- Version floor: TypeScript strict mode
- No new dependencies for trivial work
- Import flow must not break existing restore behavior
- Rollback path required for major changes

## Review Focus

- **Data loss risk:** Import that replaces holdings could overwrite user data without warning
- **Diff accuracy:** Before/after must reflect actual state, not just import file contents
- **UI clarity:** Users must understand which holdings are added vs replaced vs removed
- **Undo capability:** Major changes need revert path
- **Performance:** Large portfolio diffs must not block UI

## File Structure

- Create: `src/modules/profile/import-summary.ts` (diff logic), `src/components/ImportSummary.tsx` (UI)
- Modify: Import flow in `src/modules/profile/` to call summary before commit
- Test: `src/modules/profile/import-summary.test.ts`

## Task 1: Write diff logic

**Files:**
- Create: `src/modules/profile/import-summary.ts`
- Test: `src/modules/profile/import-summary.test.ts`

**Interfaces:**
- Consumes: portfolio state before import, portfolio state after import
- Produces: `ImportSummary` with `added`, `replaced`, `removed` holdings

- [ ] **Step 1: Write failing test for diff logic**

```typescript
// src/modules/profile/import-summary.test.ts
import { computeImportSummary } from './import-summary';

describe('computeImportSummary', () => {
  it('identifies added holdings', () => {
    const before = [{ id: 'h1', quantity: 10 }];
    const after = [{ id: 'h1', quantity: 10 }, { id: 'h2', quantity: 5 }];
    const summary = computeImportSummary(before, after);
    expect(summary.added).toEqual([{ id: 'h2', quantity: 5 }]);
    expect(summary.replaced).toEqual([]);
    expect(summary.removed).toEqual([]);
  });

  it('identifies replaced holdings', () => {
    const before = [{ id: 'h1', quantity: 10 }];
    const after = [{ id: 'h1', quantity: 20 }];
    const summary = computeImportSummary(before, after);
    expect(summary.replaced).toEqual([{ id: 'h1', before: 10, after: 20 }]);
  });

  it('identifies removed holdings', () => {
    const before = [{ id: 'h1', quantity: 10 }];
    const after = [];
    const summary = computeImportSummary(before, after);
    expect(summary.removed).toEqual([{ id: 'h1', quantity: 10 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/profile/import-summary.test.ts`
Expected: FAIL — `import-summary` module not yet defined

- [ ] **Step 3: Implement diff logic in `src/modules/profile/import-summary.ts`**

```typescript
// Signature: export function computeImportSummary(
//   before: Holding[], after: Holding[]
// ): ImportSummary
// One line approach: compare by holding id, classify as added/replaced/removed based on quantity changes
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/modules/profile/import-summary.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/profile/import-summary.ts src/modules/profile/import-summary.test.ts
git commit -m "feat: add import summary diff logic"
```

---

### Task 2: Add UI component for import summary

**Files:**
- Create: `src/components/ImportSummary.tsx`
- Modify: Import flow to render summary before commit

**Interfaces:**
- Consumes: `ImportSummary` from Task 1
- Produces: Before/after display with confirm/cancel buttons

- [ ] **Step 1: Write failing test for UI component**

```typescript
// src/components/ImportSummary.test.tsx
import { render, screen } from '@testing-library/react';
import { ImportSummary } from './ImportSummary';

describe('ImportSummary', () => {
  it('shows added, replaced, removed holdings', () => {
    render(<ImportSummary summary={{ added: [...], replaced: [...], removed: [...] }} />);
    expect(screen.getByText('Added')).toBeInTheDocument();
    expect(screen.getByText('Replaced')).toBeInTheDocument();
    expect(screen.getByText('Removed')).toBeInTheDocument();
  });

  it('calls onConfirm when user clicks confirm', () => {
    const onConfirm = vi.fn();
    render(<ImportSummary summary={{ added: [], replaced: [], removed: [] }} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('Confirm Import'));
    expect(onConfirm).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ImportSummary.test.tsx`
Expected: FAIL — component not yet defined

- [ ] **Step 3: Implement ImportSummary component**

```typescript
// Signature: export function ImportSummary({ summary, onConfirm, onCancel })
// One line approach: render summary counts, list holdings, confirm/cancel buttons
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ImportSummary.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ImportSummary.tsx src/components/ImportSummary.test.tsx
git commit -m "feat: add ImportSummary UI component"
```

---

## Self-Review Checklist

- [x] Spec coverage: Both tasks implement the before/after summary requirement
- [x] Step scan: Each step has one checkable action
- [x] Type consistency: `ImportSummary` type used consistently
- [x] Review Focus: Data loss (diff covers replacements), diff accuracy (computed from actual state), UI clarity (counts + list), undo path (confirm/cancel blocks), performance (computed synchronously)
- [x] Proportion: Plan matches spec scope

Plan complete and saved to `docs/superpowers/plans/2025-10-07-portfolio-import-verification.md`.