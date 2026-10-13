# Changelog

All notable changes to FIRE OS are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Goal Wizard**: new `/goals` route (React component) for creating, editing, deleting and reordering financial planning goals. The wizard renders the `Goal` type from `src/types/state.ts` — name, kind, target amount, target date, monthly contribution, priority and risk bucket — and persists goals directly onto `appState.goals`. Uses the shared UI kit (`Button`, `Input`, `Card`, `Select`).
- **Select options prop**: `src/app/ui/Select.tsx` now accepts a pre-computed `options` array in addition to `children`, so consumers can pass option lists declaratively instead of wrapping `SelectItem` elements by hand.
- **SWP Scheduler UI**: enhanced SWP Scheduler with fund bucket selection, redemption plan table, and monthly withdrawal configuration. Users can now configure monthly withdrawal amount, start date, fund redemption order, and view a summary of projected redemptions.
- **General planning goals**: the fixed `coorg*` goal scalars are replaced by a
  persisted `goals: Goal[]` model (`src/types/state.ts`, `goalSchema`) with a
  dashboard progress card per goal and per-goal SIP-prep actions. The personal
  preset (`src/presets/personal-plan.ts`) keeps the original home-goal numbers as
  a single goal.
- **General ESOP liquidation rules**: the four fixed `esopDetails.triggers`
  booleans are replaced by a persisted `liquidationRules: LiquidationRule[]`
  list — one toggle card per rule, plus `allocateAmount` goal allocations that
  deploy sequentially from the remaining corpus.
- **Persisted-state migration** (`src/lib/portfolioMigrations.ts`): legacy
  payloads (v2–v4) rewrite `coorg*`/`triggers` into the `goals`/`liquidationRules`
  shape at every read boundary (local storage, JSON backup restore, Firestore
  envelope load/snapshot); idempotent, liberal in / strict out. Writes now use
  envelope schema `fireOS_v5`; reads still accept v2–v5.
- **Assistant Worker authentication**: `POST /api/assistant/query` now requires a
  verified Firebase ID token sent as `Authorization: Bearer`. The Worker checks
  RS256 signature against Google's JWKS, issuer/audience for
  `FIREBASE_PROJECT_ID`, and expiry; missing/invalid/expired tokens get 401
  `{ error, code: 'unauthenticated' }`. The browser sends the signed-in user's
  token and shows a sign-in prompt instead of firing a request when signed out.
  CORS preflight now admits the `Authorization` header.
- **Per-user rate limiting**: the Assistant rate limit (20 req/min) is keyed by
  the verified user uid, with a per-IP guard as a second layer; both reuse the
  existing `ASSISTANT_RATE_LIMITER` binding. This replaces the old per-IP-only
  quota.
- **Graceful assistant degradation**: non-2xx or timed-out OpenRouter responses
  now return HTTP 200 with a deterministic `{ reply, fallback: true }` message
  instead of an opaque 502/504 provider error.
- **Worker market proxy** (`GET /api/market/nifty|currency|quote`): the Worker now
  fetches Yahoo Finance server-side with Cache-API TTLs (1h/24h/15m) and a stale
  fallback, reusing the existing CORS allowlist and rate limiter, so the browser
  needs no public CORS proxy.
- **Personal-identifier guard** (`scripts/check-personal-identifiers.mjs`, `npm run test:privacy`):
  fails the Quality workflow if the maintainer's personal identifiers, external-advisor
  references, or the personal support email reappear in `src`, `worker`, `shared`,
  `firestore.rules` or `firebase.json` (excluding `presets/` and test files).
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

### Changed
- **Client market calls now go to the Worker**: `nifty.ts`, `currency.ts` and `esop.ts`
  call the Worker `/api/market/*` endpoints instead of `corsproxy.io`. The
  `VITE_CORSPROXY_API_KEY` build variable (and the deploy-workflow secret), the
  `corsproxy.io`/`query1.finance.yahoo.com` CSP `connect-src` entries, and the client
  proxy-key guards are removed; caching, TTLs and graceful degradation are unchanged.

### Removed
- **Owner-specific values from configuration and UI**: dead `CONFIG` fields
  (watchdog limits, scheme codes including `122639`, FI/SWP goal defaults,
  crash protocol) are deleted; the personal ₹122,000 SWP expense target and its
  on/under-target status rows are removed from the expense tracker (both the
  React widget and the imperative renderer); the SWP `monthlyAmount` default and
  the FI-target placeholder example no longer carry the owner's ₹122K/₹5.5Cr
  figures; the personal-identifier guard re-enforces `122000` and `55000000`.
  Fund names/allocation and the LTCG/milestone constants remain as live feature
  identifiers — see the sweep report for the p-config-fix commit.
- **Advisor webhook integration**: the dashboard CFP-review widget and `src/modules/integrations/advisor-webhook.ts` are gone. It POSTed the user's email and exact portfolio figures to `https://api.fire-os.app`, an NXDOMAIN/unowned domain with no backend, exposing a registerable leak.

### Fixed
- **Firestore rules never validated `esopDetails` content**: `validEsopDetails()`
  was defined in `firestore.rules` but never called, so `esopDetails` passed
  `validPersistedData` as an unchecked map and a client could persist arbitrary
  nested data (including the retired `triggers` shape) there. `validPersistedData`
  now calls `validEsopDetails(data.esopDetails)`, rejecting unknown keys and
  malformed values. Already-synced legacy documents are unaffected:
  `migratePortfolioEnvelope()` drops `triggers` at every read boundary, so the
  next legitimate write is already in the current shape.
- **Profile privacy notice implied local-only processing**: it said portfolio data
  "stays in this browser", which read as if nothing ever leaves the device even
  though the Assistant sends a sanitized summary (and, only when opted in, exact
  figures) to the FIRE OS assistant service. The notice now states the storage
  scope and the Assistant data flow explicitly.
- **Trust panel claimed cloud sync and fresh market data it did not have**: in local-only mode an idle coordinator read "Synced", and `refreshPortfolioNAVs` published a "success" (rendered "Up to date") even when the portfolio had no holdings to fetch. The sync label is now scope-aware ("Local-only (not cloud synced)") and an empty refresh returns to `idle`.
- **Empty profile rendered an "FI in 83y (age 108)" projection**: `calculateFIAge()` capped its month-by-month simulation at 1,000 months and returned the capped horizon as if it were a real result, so an unreachable goal looked like a distant date. It now returns an explicit `unreachable: true` with null age/months; the Plan tab and scenario comparison render "not reachable" instead of a fabricated horizon.
- **Fresh profile claimed "FI achieved"**: with no positive FI target set, `fiProgress()` treated `currentCorpus >= fiTarget` as achieved, so the dashboard's FI Goal Progress card showed "FI achieved" for an empty profile. The achieved branch now requires a positive target, and the card/KPI report "Set an FI target to track progress" / "No FI target set" instead.
- **Legacy modules rendered light cards with invisible text in dark mode**: the legacy palette in
  `tokens.css` defined its dark half only under `html[data-theme="dark"]`, but the Tailwind palette
  also treats `prefers-color-scheme: dark` as authoritative and the theme toggle deliberately leaves
  `data-theme` unset until the user toggles. On a system-dark machine with no stored preference the
  React shell went dark while every legacy token stayed light, so the not-yet-migrated routes —
  Plan cards most visibly, plus ESOP, Calculators, Profile and Assistant — painted light surfaces
  inside a dark page. Measured sub-4.5:1 text samples on those routes went from 42 to 2; the two
  remaining are unrelated hardcoded-red contrast issues. `tokens.css` now mirrors its dark values
  under `@media (prefers-color-scheme: dark)` for `html:not([data-theme='light'])`.
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
- **Quality workflow read Firebase config from the wrong context**: the e2e job read
  `VITE_FIREBASE_*` from `secrets.*`, but those values are repository variables, so they
  resolved empty and the two auth tests failed. Now read from `vars.*` like deploy.yml, and
  the unused `VITE_FIREBASE_DATABASE_URL` mapping is removed.
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
- **FIProgressKPI targetSet and fiTarget nullability**: `FIProgressKPI.fiTarget` changed from `number` to `number | null`, with `FIProgressKPI.targetSet: boolean` added. `fiTarget` is `null` when never entered, `0` when explicitly set to ₹0, and positive when a positive target was set. `targetSet` is `true` when a target was explicitly set. This enables the UI to distinguish "no FI target set" from "FI target set to ₹0".
- **Insurance accessor fix**: Insurance fields (`termLife`, `health`, `vehicle`) read from `D.insurance` at the top level of `FireOSState` instead of the incorrect `D.profile.insurance` path. Fixed accessors in `src/modules/profile/index.ts` insurance form section.
- **motion-reduce inline style fix**: Removed invalid `motion-reduce:transition-none` from inline `style` attribute in `src/modules/profile/index.ts` (325). The UI kit carries `motion-reduce:` transitions structurally.
- **motion-reduce CSS fix**: Replaced invalid `motion-reduce: animation-none` in `src/modules/esop/styles.css` with proper `@media (prefers-reduced-motion: reduce) { .animate-pulse { animation: none; } }` rule.
- **CSS token fixes in auth styles**: Fixed `.form-group input:focus { background: var(--text-primary) }` which made text unreadable by setting background to `var(--bg-primary)`. Replaced undefined `--color-danger-rgb` with `var(--color-danger-light)`, undefined `--color-primary-rgb` with literal `rgba(245, 158, 11, 0.3)`, and undefined `--color-background` with `var(--bg-secondary)` for Google button.
- **Duplicate Phosphor imports removed**: Removed duplicate `import { PlayIcon, PauseIcon, BarChartIcon } from '@phosphor-icons/react';` lines from `src/modules/calculators/index.ts` (lines 12-13). `BarChartIcon` does not exist in the package; tab buttons now use plain text labels.

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
