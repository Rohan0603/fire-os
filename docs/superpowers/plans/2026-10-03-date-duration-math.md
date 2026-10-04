# Date and Duration Math Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize strict date and period calculations for planning, imports, history filtering, and market analytics without changing persisted date formats or timezone semantics.

**Architecture:** Add date-fns helpers around the current planning date boundaries and reuse them for import validation and supported analytics ranges. Keep stored strings (`YYYY-MM`, `YYYY-MM-DD`, ISO timestamps) and native date inputs unchanged; do not mechanically replace timestamp creation or locale formatting throughout the app.

**Tech Stack:** TypeScript, date-fns, Vitest.

**Spec:** [FIRE OS Capability Expansion Design](../specs/2026-10-03-fire-os-capability-expansion-design.md), especially date/calendar workflows.

## Global Constraints

- Preserve persisted date formats and Firestore timestamp contracts.
- Preserve whether each current calculation uses UTC or local calendar components; tests must establish this before replacement.
- Strictly reject impossible `YYYY-MM` / `YYYY-MM-DD` inputs at existing validation boundaries.
- Add only date-fns, using named imports for tree shaking.

## Review Focus

- Month difference across December/January and same-month dates must preserve inclusive SIP month counting; pin in KPI test.
- Leap-day age calculation must preserve UTC birthday semantics; pin in `src/types/portfolio.test.ts`.
- Invalid but regex-shaped month/day values must not roll into another date; pin in date validation test.
- SWP monthly execution must remain one withdrawal per intended UTC month; pin in `src/modules/calculators/swp-scheduler.test.ts`.
- LTCG eligibility around exactly 12 months must preserve existing threshold; pin in tax planner test.
- Range filtering must include/exclude endpoints consistently across snapshots and market samples; pin in period-helper tests.
- Invalid imported dates must be rejected before state mutation; pin in import/date integration tests.

---

### Task 1: Financial month arithmetic

**Files:**
- Modify: `package.json`, lockfile
- Modify: `src/modules/dashboard/kpis.ts`, `src/modules/calculators/tax/ltcg-planner.ts`, `src/modules/calculators/swp-scheduler.ts`
- Tests: existing/new tests alongside these modules

**Interfaces:**
- Preserve current exported calculation function signatures and persisted string formats.

- [ ] Add boundary tests for inclusive SIP months, LTCG at 12/13 months, and SWP month transition.
- [ ] Run focused calculation tests; expected: boundary expectations define current intended behavior before replacement.
- [ ] Add date-fns and replace targeted date parsing/month arithmetic with strict parsing and explicit calendar calculations matching those tests.
- [ ] Run focused tests and `npm run build`; expected: pass.

### Task 2: Profile age validation

**Files:**
- Modify: `src/types/portfolio.ts`
- Test: create or extend `src/types/portfolio.test.ts`

**Interfaces:**
- Preserve `calculateAgeFromDateOfBirth(dateOfBirth: string, today?: Date): number | null`.

- [ ] Add tests for valid/invalid leap dates, future dates, and UTC birthday boundary.
- [ ] Run the focused test; expected: tests establish existing UTC behavior.
- [ ] Use date-fns strict parsing and UTC-safe date arithmetic without changing the signature.
- [ ] Run focused tests and `npm run build`; expected: pass.

**Completion note:** Update `docs/master.md` and `docs/ui.md` with only the date arithmetic boundaries actually migrated.

### Task 3: Shared strict dates and analytics periods

**Files:**
- Create: `src/lib/dates.ts`
- Test: `src/lib/dates.test.ts`
- No other consumer files in this task; chart and import plans consume these helpers later.

**Interfaces:**
- Produce: `parseYearMonth(value: string): Date | null`, `parseCalendarDate(value: string): Date | null`, and `isWithinDateRange(date: Date, start: Date, end: Date): boolean` with inclusive endpoints.

- [ ] Test impossible dates, leap day, UTC/local boundaries, reversed ranges, and inclusive endpoints.
- [ ] Run focused date tests; expected: parser/range tests fail before implementation.
- [ ] Implement strict parsing/range helpers with date-fns; export them for later chart/import consumers without introducing speculative call sites.
- [ ] Run focused date, import, dashboard, and build checks; expected: pass.

**Expanded completion note:** Update `docs/ui.md` to identify supported date formats and range inclusivity.
