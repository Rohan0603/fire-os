# Changelog

All notable changes to FIRE OS are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Shared UI kit** (`src/app/ui`): Button, Input, Card, Table, Tabs, Select and Dialog for
  migrated routes, plus a `cn` helper. Tabs/Select/Dialog wrap the Radix primitives already in
  `package.json`. Proven by computed-style assertions in `e2e/ui-kit.spec.ts`, because an
  unlayered legacy rule can beat a Tailwind utility while still appearing in the built CSS.
- **Kit Toaster**: the kit's Radix `<Toaster>` now renders the imperative `showToast` stream
  (`src/modules/ui/Toast.ts`) unchanged — the 40 `showToast` call sites keep their exact API,
  including duration-based and sticky toasts. The legacy DOM renderer stays as a fallback for
  toasts fired before React mounts; the first subscription hands rendering over to Radix.
- **CSV Import**: preview a parsed portfolio CSV with row-level issues and confirm before applying
- **Dashboard Charts**: interactive portfolio composition pie plus net-worth snapshot trend and Nifty benchmark performance and drawdown history views with range controls
- **XIRR Period Returns**: `calculatePeriodReturn()` derives annualized returns from dated cash flows within an inclusive window; exported helper, not yet surfaced in the SIP status KPI
- **Scenario Comparison**: side-by-side FI projection of two scenarios in the calculators tab
- **Agent-friendly development**: enhanced `AGENTS.md` with explicit PR/MR workflow, CI check guidance, and issue onboarding; added quick-reference validation table and agent-contributing guide to `docs/README.md`

### Fixed
- **Theme preference was persisted on initial load**: `setupTheme` applied the resolved theme via
  the toggle's own helper, writing `fire-os-theme` to `localStorage` during startup. That froze the
  OS preference seen on first load, so a later change of OS setting was ignored, and it
  contradicted the documented rule that an unset preference stays unset. It also meant the dark
  half of the design-system and theme specs had been asserting the light palette, because the
  freshly written value beat the emulated preference. A real toggle still persists.
- **IBM Plex Sans never loaded**: the font was an `@import` in `app.css`, but `global.css` is
  imported first and carries its own `@import` plus rules, which invalidates a later stylesheet's
  `@import`. The request was dropped from the build and the theme silently fell back to system
  sans. Now linked from `index.html`, which is not subject to the ordering rule.
- **CI e2e job could not pass**: `e2e/auth.spec.ts` asserts the configured auth path but the
  quality workflow never injected `VITE_FIREBASE_*`, so both auth tests failed on a clean
  checkout.
- **Dark `--color-on-destructive` had no override**: the dark destructive is a lighter red, so
  inherited white text fell below 4.5:1. Latent until a danger button is mounted. Now covered by
  the design-system contrast spec.
- **Migration merge defects**: the React rewrite was merged into `main` in a broken state and
  the result was never pushed. Repaired in six commits: two orphaned `>>>>>>>` conflict markers
  left in `src/main.ts`; five Zod schema primitives dropped from `src/types/state.ts`;
  stale local shell helpers shadowing their `src/app` module equivalents; a stale
  `showImportSummary` copy in the profile module; the backup-restore and CSV-import summary
  dialogs had silently stopped rendering because both callers were refactored to `Promise<void>`;
  and `shared/assistant-policy.js` still imported the `valibot` dependency that the Zod swap had
  removed, which failed two worker suites at import. A regression this introduced — the bridge
  handlers losing their only call site, which would have made React sign-in/sign-out silently
  no-op — was caught by lint and fixed.
- **`--color-danger` / `--color-on-*` tokens**: these were referenced from Tailwind utilities but
  absent from `@theme`, so `border-(--color-danger)` compiled to nothing and the error boundary's
  border never rendered. Declared in `@theme` alongside the existing definitions.
- **Assistant CORS on `firebaseapp.com`**: the assistant worker's `ALLOWED_ORIGIN` held a
  single origin (`fire-os-dd6d6.web.app`), so every request from the `firebaseapp.com`
  host was rejected by the browser. It is now a comma-separated allowlist that also
  covers `firebaseapp.com` and the local dev server.

### Changed
- **React shell and routing foundation**: the UI now renders through React 19 with
  React Router routes and a Tailwind CSS v4 theme. Navigation moves to a sidebar
  (persistent at `lg` and above, a `<details>` drawer below it) with `aria-current`
  and visible focus rings. Design tokens are converted to OKLCH, and dark mode
  follows `prefers-color-scheme` unless the user picks a theme. `src/main.ts`
  remains the entry point and mounts React last, through a bootstrap seam that
  resolves only after the auth session does. Feature modules still render their own
  DOM and are ported route by route; each route carries `data-migration-state`
  until it is migrated. The prerender-script retirement and the move to Cloudflare
  Workers are not part of this change.
- **Reactive Status Stores**: sync, market-refresh, and cloud-mode labels update live from shared status stores
- **Dashboard migrated to React** (`src/app/routes/dashboard/`): the dashboard route, KPI cards,
  composition/trend/benchmark charts, data-trust panel and SWP/expense/advisor widgets are now
  React components, and the route claims `#dashboard` with `data-migration-state="migrated"`.
  Charts use the existing **Recharts** dependency; the legacy `chart.js` dependency,
  `src/modules/dashboard/styles.css` and the imperative `renderDashboard`/`teardownDashboard`
  wiring were removed. `src/modules/dashboard/` keeps only the shared data helpers
  (`fetchSIPNAVs`, `refreshStaleData`, `staleSourceLabels`, `updateCrashAlert`), and
  `FeatureRegistry` keeps a no-op `dashboard` mount so `resolveTabTarget` still resolves it.
- **Dashboard route and kit Toaster ship together**: this change integrates the
  React dashboard migration and the `<Toaster>` bridge over the imperative toast
  stream (`src/modules/ui/Toast.ts` → `src/app/ui/Toast.tsx`). Both are validated
  as one change (unit, worker, route-metadata and e2e), sharing the updated
  `docs/master.md` and `docs/ui.md`.
- Consolidated project, architecture, API, Assistant, deployment, and
  troubleshooting guidance into `docs/README.md`.
- Removed duplicated and historical planning documents.

### Fixed
- **Google sign-in message on guest-only builds**: with no `VITE_FIREBASE_*` configuration,
  `requireAuth()` threw `app/firebase-unconfigured`, but that code was missing from the
  error-message map, so every sign-in attempt reported the generic "An authentication error
  occurred. Please try again." and invited a retry that could never succeed. The code is
  now mapped to an explicit explanation.
- **Auth screen no longer offers dead-end sign-in when unconfigured**: the screen shows an
  inline notice explaining that sign-in, accounts and cloud sync are unavailable while guest
  mode still works, and the Login, Sign Up, Google and "Forgot password" controls are
  disabled rather than wired to handlers that cannot succeed.
- **Guest-only startup**: the app no longer fails to render when `VITE_FIREBASE_*`
  is absent or partial. Firebase `Auth` is now resolved through `getOptionalAuth()`,
  which returns null instead of throwing during module evaluation, so the
  documented local-first guest mode actually boots. Sign-in surfaces a clear
  "no Firebase configuration" message, and Assistant re-authentication treats an
  unconfigured deployment as a guest.

### Fixed
- **Backup Restore Hardening**: restored backups are runtime-validated with Valibot before being applied
- **Date and Duration Fixes**: age from date of birth (anniversary and leap-day handling), strict `YYYY-MM`/`YYYY-MM-DD` parsing, and long-term holding duration thresholds

## [3.0.0] - 2026-10-03

### Added
- **SWP Automation**: Monthly withdrawal scheduler with FIFO redemption strategy
- **Tax Optimization Engine**: LTCG harvest calendar, SIP vs lump-sum tax comparison, Section 80C/80D hints
- **Advisor Integration**: CFP review workflow (webhook-based)
- **Custom Expense Tracking**: Link SWP withdrawals to actual spending, FI target validation
- **Mutual Funds UI/UX Improvements**: Redesigned SIP/MF UI with table-based layout

### Technical
- Added swp-scheduler, ltcg-planner, advisor-webhook, expense-tracker modules
- Extended `FireOSState` with swpSchedule, taxCalendar, expenses fields
- In-browser daily SWP execution (`checkDailyTasks()` in `src/main.ts`); no
  Firebase Functions are used or deployed
- Tax reporting calendar (April-March fiscal year)
- Expense validation against 3% SWR target (₹122K/month)
- E2E tests verifying dashboard wiring

---

## [2.3.0] - 2026-06-03

### Added
- **Scenario Modeler**: CAGR/SIP/salary sliders → real-time FI age calculation
  - Input: Current corpus, monthly SIP, target, expected CAGR (13-17%), current age
  - Output: Age at FI, months to FI, final corpus
  - Supports annual SIP step-up (configurable, default 10%)
  - Scenarios: 17% CAGR → FI at 43-44 years, 14% → FI at 47-48 years, 13% → FI at 49-50 years

- **Crash Alerts**: Real-time Nifty monitoring with automated crash deployment guidance
  - Monitors every 5 minutes via Yahoo Finance API
  - 10% crash → ₹20K Wint deployment suggested (medium severity)
  - 15% crash → ₹35K deployment (high severity)
  - 25% crash → ₹60K deployment (critical severity)
  - Integrates with dashboard banner alerts

- **Coorg Goal Tracker**: Separate ₹2Cr target tracking for Kerala home project (2036)
  - Status: Planning (until Jan 2031) → In Progress → Target Reached
  - Monthly SIP: ₹10K starting Jan 2031
  - Current corpus tracking with % progress display

- **Portfolio Rebalancing Tool**: Allocation drift detection vs 40/30/20/10 target
  - Current allocation: PPFCF 40%, Nippon Growth 30%, Nippon SmallCap 20%, Gold 10%
  - Triggers recommendations when drift > 5%
  - Displays: Current vs target allocation %, amount to rebalance, recommended trades

- **Fund Manager Alert Integration**: Automated watchdog rules for fund health
  - PPFCF AUM breach: Alert when > ₹1.75L Cr, Plan B = Mirae Asset Flexi Cap
  - Nippon Growth block: Alert when > 14 days blocked, Plan B = Motilal Oswal Midcap
  - Nippon SmallCap block: Alert when > 60 days blocked, Switch = SBI/Bandhan SmallCap
  - Manager exits (Rajeev Thakkar/Samir Rachh): Pause lump-sums, continue SIP
  - Daily automated checks with email/dashboard alerts

### Technical
- New calculator modules: `scenario-modeler.ts`, `portfolio-rebalancing.ts`
- New API module: `nifty-monitor.ts` (real-time Nifty monitoring)
- New watchdog module: `fund-manager-alerts.ts` (fund health automation)
- New dashboard widget: `coorg-tracker.ts` (Coorg goal progress)
- Extended D state object with: coorgCorpus, coorgTarget, watchdogRules
- Firebase persistence: All new features auto-sync across devices
- E2E test suite: 35 tests covering all v2.3 features
- Test results: All 100+ tests passing, zero regressions

### Performance
- Nifty monitoring: 5-minute polling (efficient, not real-time)
- Watchdog checks: Daily (24-hour interval)
- Dashboard calculations: Client-side only (no server load)
- Bundle size impact: +~20KB gzipped (scenario modeler, calculations)

### Breaking Changes
None. v2.3 is fully backward compatible with v2.2.1 data.

### Bug Fixes
None in v2.3 (inherited from v2.2.1 fixes).

---

## [2.2.1] - 2026-06-03

### Fixed
- **NAV Fetch Bug**: Fixed SIP P&L showing ₹0 current value
  - Issue: NAV fetches filtered on `monthlyAmount > 0`, skipping SIPs with no monthly contributions but existing holdings
  - Solution: Changed filter to `units > 0` to fetch NAV for all SIPs with holdings
  
- **NAV Fetch Timing**: Optimized NAV fetch triggers
  - Moved from dashboard tab click only to: Firebase portfolio load (on login) + Profile save + Dashboard tab open (fallback)
  
- **Canvas Crash**: Fixed pie chart crashing when canvas too small
  - Added radius validation before drawing (prevents negative radius crashes)
  
- **Log Cleanup**: Removed verbose `logger.log()` debug statements
  - Kept `logger.warn()` and `logger.error()` for troubleshooting

---

## [2.2.0] - Earlier Release

Earlier versions and changes prior to v2.2.1 can be found in git history.
