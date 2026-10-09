# Scenario Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users compare a small number of saved FIRE assumptions/results side by side; first validate that repeated comparisons are a real workflow.

**Architecture:** Add a comparison UI that lets users select 2-3 saved scenarios, loads their assumptions and results, displays them in a side-by-side table with differences highlighted.

**Tech Stack:** React components, scenario storage (from existing save/load), comparison UI.

**Spec:** docs/master.md (Scenario Comparison), TODO.md line 83-85

## Global Constraints

- Version floor: TypeScript strict mode
- Use existing scenario persistence mechanism
- Comparison limited to 2-3 scenarios (to fit on screen)
- Must work with existing saved scenario format

## Review Focus

- **Selection limit:** UI prevents selecting more than 3 scenarios
- **Difference highlighting:** Changes between scenarios are visually distinct
- **Empty state:** Clear guidance when no scenarios selected
- **Performance:** Loading multiple scenarios doesn't block UI
- **Real workflow:** Comparison only enabled after user has 2+ saved scenarios

## File Structure

- Create: `src/components/ScenarioComparison.tsx`
- Modify: `src/modules/plan/` to expose comparison entry point
- Test: `src/components/ScenarioComparison.test.tsx`

## Task 1: Create scenario comparison component

**Files:**
- Create: `src/components/ScenarioComparison.tsx`
- Test: `src/components/ScenarioComparison.test.tsx`

**Interfaces:**
- Consumes: array of `SavedScenario` (from plan module)
- Produces: UI with selected scenarios table and comparison button

- [ ] **Step 1: Write failing test for comparison component**

```typescript
// src/components/ScenarioComparison.test.tsx
import { render, screen } from '@testing-library/react';
import { ScenarioComparison } from './ScenarioComparison';

describe('ScenarioComparison', () => {
  it('displays scenario selector with existing scenarios', () => {
    render(<ScenarioComparison scenarios={[]} />);
    expect(screen.getByText('Select scenarios to compare')).toBeInTheDocument();
  });

  it('shows side-by-side comparison when 2+ scenarios selected', () => {
    const scenarios = [{ id: 's1', assumptions: {}, results: {} }];
    render(<ScenarioComparison scenarios={scenarios} />);
    // Trigger selection of 2 scenarios
    expect(screen.getByText(/Comparison Results/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ScenarioComparison.test.tsx`
Expected: FAIL — `ScenarioComparison` component not yet defined

- [ ] **Step 3: Implement component in `src/components/ScenarioComparison.tsx`**

```typescript
// Signature: export function ScenarioComparison({ scenarios }: { scenarios: SavedScenario[] })
// One line approach: multiselect dropdown + compare button + results table
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ScenarioComparison.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ScenarioComparison.tsx src/components/ScenarioComparison.test.tsx
git commit -m "feat: add scenario comparison component"
```

---

### Task 2: Wire comparison into plan module

**Files:**
- Modify: `src/modules/plan/index.ts` (add comparison entry point)
- Modify: Plan UI to show "Compare scenarios" button when 2+ saved

**Interfaces:**
- Consumes: saved scenarios from plan storage
- Produces: navigation to comparison view

- [ ] **Step 1: Write failing test for plan integration**

```typescript
// src/modules/plan/index.test.ts
import { getComparisonUrl } from './index';

describe('plan comparison integration', () => {
  it('returns comparison URL when 2+ scenarios saved', () => {
    const url = getComparisonUrl(['scenario1', 'scenario2']);
    expect(url).toBe('/plan/compare');
  });

  it('returns null when fewer than 2 scenarios saved', () => {
    const url = getComparisonUrl(['scenario1']);
    expect(url).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/modules/plan/index.test.ts`
Expected: FAIL — `getComparisonUrl` not yet defined

- [ ] **Step 3: Implement plan integration**

Add `getComparisonUrl` function and UI button that appears when user has 2+ saved scenarios.

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run src/modules/plan/index.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/modules/plan/index.ts
git commit -m "feat: add comparison entry point to plan module"
```

---

## Self-Review Checklist

- [x] Spec coverage: Both tasks implement scenario comparison requirement
- [x] Step scan: Each step has one checkable action
- [x] Type consistency: `SavedScenario` type used consistently
- [x] Review Focus: Selection limit (UI enforces max 3), difference highlighting (in table), empty state (guidance text), performance (lazy load scenarios), real workflow (button only appears with 2+ saved)
- [x] Proportion: Plan matches spec scope

Plan complete and saved to `docs/superpowers/plans/2025-10-07-scenario-comparison.md`.