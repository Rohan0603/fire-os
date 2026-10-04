# Dashboard Charting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use Chart.js for interactive composition, net-worth history, benchmark performance, and drawdown analytics without inventing missing historical portfolio values.

**Architecture:** Use Chart.js as a presentation layer over existing KPI output, stored net-worth snapshots, and the market-history service. Keep valuation and return calculations outside chart code. Show source, period, and freshness; distinguish actual portfolio snapshots from market benchmark series.

**Tech Stack:** TypeScript, Chart.js, Vitest, Vite.

**Spec:** [FIRE OS Capability Expansion Design](../specs/2026-10-03-fire-os-capability-expansion-design.md), especially market-backed analytics.

## Global Constraints

- Preserve category values, zero-total behavior, theme colors, responsive dashboard layout, and current legend.
- Destroy chart instances when the dashboard is rerendered/unmounted to avoid retained canvases/listeners.
- Use the existing Vite bundler; add no chart wrapper/framework.
- Keep chart readable without color alone, using the existing legend and accessible labeling.

## Review Focus

- Empty or zero composition must render without chart errors; pin in dashboard chart tests.
- Rerender/unmount must not retain a Chart.js instance; pin in chart lifecycle tests.
- Small slices must remain represented in the legend even if labels are not shown on-chart; verify in chart options/render test.
- Dark/light theme changes must keep chart colors legible; verify with CSS/theme behavior or manual visual check.
- Missing canvas/2D rendering environment must not break dashboard initialization; pin in chart lifecycle test.
- A portfolio trend must use persisted net-worth snapshots only; pin in history chart tests.
- Missing/partial market series must show unavailable/stale states and retain current-value dashboard behavior; pin in market chart tests.
- Benchmark history must identify its provider/range and never be presented as the user’s portfolio return; pin in chart data tests.

---

### Task 1: Composition pie migration

**Files:**
- Modify: `package.json`, lockfile
- Modify: `src/modules/dashboard/index.ts`
- Modify: `src/modules/dashboard/styles.css`
- Test: create `src/modules/dashboard/chart.test.ts` or extend the existing dashboard tests

**Interfaces:**
- Preserve the dashboard module mount/render lifecycle and `portfolioComposition` input shape.
- Produce a local chart lifecycle helper that creates, replaces, and destroys the composition chart instance.

- [ ] Add tests for empty data, instance replacement, and destroy-on-unmount.
- [ ] Run the focused chart test; expected: lifecycle tests fail before implementation.
- [ ] Add Chart.js, replace `drawPieChart`, configure responsive pie data from KPI composition, preserve legend, and destroy the previous instance before rerender/unmount.
- [ ] Run `npm test -- src/modules/dashboard` and `npm run build`; expected: pass.
- [ ] Manually verify dashboard in light/dark themes at desktop and narrow viewport.

**Completion note:** Update `docs/master.md` and `docs/ui.md` to reflect Chart.js ownership and lifecycle.

### Task 2: Net-worth history and analytics charts

**Files:**
- Modify: `src/modules/dashboard/index.ts`, `src/modules/dashboard/styles.css`
- Create: `src/modules/dashboard/chart-data.ts`
- Test: `src/modules/dashboard/chart-data.test.ts`

**Interfaces:**
- Consumes: stored `netWorthHistory` and normalized market series from the market-history plan.
- Produces: chart datasets with date, value, series label, source, and freshness metadata; no portfolio backfill/interpolation.

- [ ] Test empty and sparse snapshots, date-window filtering, benchmark series alignment, and stale/partial market data.
- [ ] Run focused chart-data tests; expected: data-contract tests fail before implementation.
- [ ] Add net-worth snapshots and Nifty benchmark performance/drawdown chart views using real source series; expose range selection only for supported date ranges.
- [ ] Run dashboard/chart tests and `npm run build`; expected: pass.
- [ ] Manually verify keyboard-accessible range controls, theme contrast, and narrow viewport behavior.

**Expanded completion note:** Update dashboard descriptions in `docs/master.md` and `docs/ui.md`; identify net-worth snapshots and fetched market histories as distinct series.
