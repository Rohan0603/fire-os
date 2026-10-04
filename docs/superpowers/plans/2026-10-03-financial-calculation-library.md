# Financial Calculation Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide reusable dated-flow returns and assumption-based scenario comparison while preserving FIRE OS’s existing calculation semantics.

**Architecture:** Use the `xirr` package only for dated-cash-flow annualized return. Keep SIP future-value and cost-basis formulas in project code because they are separate simple formulas and not implemented by the XIRR package. Preserve the current nullable API and caller behavior.

**Tech Stack:** TypeScript, `xirr`, Vitest.

**Spec:** [FIRE OS Capability Expansion Design](../specs/2026-10-03-fire-os-capability-expansion-design.md), especially planning/performance calculations.

## Global Constraints

- Preserve `calculateXirr(cashFlows: CashFlow[]): number | null` and `CashFlow`.
- Do not alter dashboard monthly-flow construction, cash-flow signs, or annualized return units.
- Keep `sipCorpus` and `sipCostBasis` unchanged unless the selected dependency explicitly supports and the current tests establish a need.
- Add only the XIRR dependency.

## Review Focus

- Invalid dates/amounts and missing positive or negative flows must still return null; test in `src/lib/calculations.test.ts`.
- Same-day and irregularly spaced flows must be handled deterministically; test in `src/lib/calculations.test.ts`.
- Multiple-root/non-convergent inputs must not leak exceptions or non-finite results; test in `src/lib/calculations.test.ts`.
- A standard annualized example must match expected XIRR within tolerance; test in `src/lib/calculations.test.ts`.
- SIP dashboard aggregation and display remain unchanged; run `src/modules/dashboard/kpis.test.ts`.
- Scenario outputs must state assumptions and identify estimates; pin in scenario modeler tests.
- Comparing scenarios must not mutate persisted portfolio state; pin in scenario feature tests.

---

### Task 1: XIRR replacement

**Files:**
- Modify: `package.json`, lockfile
- Modify: `src/lib/calculations.ts`
- Test: create or extend `src/lib/calculations.test.ts`
- Verify: `src/modules/dashboard/kpis.test.ts`

**Interfaces:**
- Preserve exported `CashFlow` and `calculateXirr(cashFlows: CashFlow[]): number | null`.

- [ ] Write tests for a known dated cash-flow result, same-sign flows, invalid dates/amounts, and irregular intervals.
- [ ] Run `npm test -- src/lib/calculations.test.ts`; expected: reference/edge tests expose the existing behavioral baseline and desired compatibility.
- [ ] Add `xirr`, replace the Newton-Raphson body with the package call, and convert unsupported/error outcomes to `null` without changing input order semantics.
- [ ] Run `npm test -- src/lib/calculations.test.ts src/modules/dashboard/kpis.test.ts` and `npm run build`; expected: pass.

**Completion note:** Update `docs/master.md` and `docs/ui.md` with the package-backed XIRR behavior and verified null/error policy.

### Task 2: Shared period performance results

**Files:**
- Modify: `src/modules/dashboard/kpis.ts`
- Test: `src/modules/dashboard/kpis.test.ts`

**Interfaces:**
- Consumes: Task 1 `calculateXirr(cashFlows: CashFlow[]): number | null`.
- Produces: `calculatePeriodReturn(cashFlows: CashFlow[], start: Date, end: Date): number | null` with the existing annualized-return convention.

- [ ] Test contributions, withdrawals, current value, missing period endpoints, and insufficient cash flows.
- [ ] Run the focused KPI test; expected: new period-return cases fail before implementation.
- [ ] Implement period filtering and delegate return solving to `calculateXirr`; do not infer unavailable historical holding values.
- [ ] Run `npm test -- src/modules/dashboard/kpis.test.ts src/lib/calculations.test.ts` and `npm run build`; expected: pass.

### Task 3: Compare planning scenarios

**Files:**
- Modify: `src/modules/calculators/scenario-modeler.ts`, `src/modules/calculators/index.ts`
- Test: `src/modules/calculators/scenario-modeler.test.ts`
- Modify: `src/modules/calculators/styles.css`

**Interfaces:**
- Preserve `calculateFIAge()`; add `compareFIScenarios(scenarios: FIScenarioInput[]): FIScenarioResult[]`.
- `FIScenarioInput` fields: `label: string`, `currentCorpus: number`, `monthlySip: number`, `annualStepUpPercent: number`, `annualReturnPercent: number`, `fiGoal: number`, `currentAge: number`.
- `FIScenarioResult` fields: `label: string`, `monthsToGoal: number`, `ageAtGoal: number`, `projectedCorpus: number`, `assumptions: FIScenarioInput`.

- [ ] Test two scenarios with distinct returns/step-ups, invalid assumptions, stable ordering, and no writes to state.
- [ ] Run the focused modeler test; expected: comparison tests fail before implementation.
- [ ] Add a compact side-by-side calculator UI with editable assumptions and clearly labeled projections/assumptions.
- [ ] Run focused tests and `npm run build`; expected: pass.

**Expanded completion note:** Document assumptions and estimates in `docs/ui.md`; do not label projections as guaranteed or actual returns.
