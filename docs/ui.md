# FIRE OS — UI, Features, and Calculation Reference

## UI framework and lifecycle

The client is React 19 rendered by Vite, with Tailwind CSS v4 as the styling
layer. This is a migration in progress: `src/app` holds the React shell and
routing while feature modules in `src/modules` still own their DOM through
template strings and `FeatureContext`. Each module is ported route by route.

`src/main.ts` remains the entry point and still creates the legacy nav and tab
containers, starts auth, sets theme/offline listeners and resolves the initial
path through the `FeatureRegistry`. It mounts React last, through the
`src/app/bootstrap.ts` seam, once a session has resolved.

Routes come from `src/app/routes/route-meta.ts`, the source of truth for paths,
DOM ids and per-route copy. `src/app/routes.tsx` turns that into a React Router
table; `src/app/layout.tsx` renders the shell. `hooks/use-store.ts` binds
Nanostores atoms to components through `useSyncExternalStore`, and
`hooks/use-route-meta.ts` applies the active route's title and description.

**Sidebar navigation.** Persistent from the `lg` breakpoint up; below it the
sidebar is an off-canvas drawer driven by a native `<details>` disclosure, so no
JS state is involved. Links are `NavLink`s, so the active route carries
`aria-current="page"` automatically. Accessible names are exactly Profile,
Dashboard, Calculators, Insurance, Plan, ESOP and Assistant — the e2e specs
locate several of them by role and name. Every interactive element carries a
`:focus-visible` outline.

**Migration marker.** A route's container carries `data-migration-state`, either
`placeholder` or `migrated`. While a route is a placeholder the legacy container
still owns its `id` and the `active` class and React renders a hidden
`[data-route]` marker instead; only a migrated route claims the id itself. This
avoids duplicate ids and preserves the `#<id>.active` contract the e2e specs
assert.

**Theme.** `src/styles/app.css` is the Tailwind v4 entry and declares the
`@theme` tokens; `src/styles/tokens-oklch.css` holds the `:root` overrides and
is imported and linked *after* the legacy `tokens.css` so it wins the cascade.
Both are unlayered `:root` blocks of equal specificity, so source order decides.
Colours are OKLCH, converted from the old hex palette with identity preserved
(amber primary, violet CTA, emerald/red/amber status, deep-slate dark surfaces).

Dark mode follows `prefers-color-scheme` when no preference is stored. The manual
toggle owns `#theme-toggle`, persists to `localStorage` under `fire-os-theme`,
sets `data-theme` on `<html>`, and dispatches `themeChanged` (the dashboard
listens for it to re-theme its charts). Only a real toggle persists: initial
application reads the stored value or the system preference without writing one,
so an unset preference stays unset and the media query stays authoritative.

Legacy layout/global styles remain in `src/styles/` with feature CSS under each
module; they shrink as routes are ported.

The `portfolioSavedStore` save signal (Nanostores, `src/core/stores.ts`)
triggers the dashboard refresh, coalesced to an animation frame. The app root
and each React route sit inside an `ErrorBoundary`, so a failure in one route
renders a retry fallback rather than blanking the app.

## Tabs and behaviors

### Profile — `src/modules/profile/`

Profile is the central entry/edit surface for name, DOB/age, monthly income,
expenses, tax slab and FI target; asset records; liabilities; SIP/MF fund
names/scheme/units/costs; insurance and ESOP state. Changes mutate shared state
and go through repository persistence. Age helper validates exact YYYY-MM-DD
dates and accounts for whether the birthday has passed. Import/export includes
JSON backup plus CSV download and CSV import (preview, row issues, explicit
merge/replace confirmation). `pdf-parser.ts` handles browser PDF/CAS parsing;
profile flows can use fund matching to associate scheme names/codes. CSV
serialization uses PapaParse in both directions: export lives in
`src/lib/portfolioCsv.ts`, import parsing/validation in
`src/modules/profile/csv-import.ts`.

### Dashboard — `src/modules/dashboard/`

The dashboard refreshes NAVs for positive-unit SIP holdings before computing
KPIs. It shows net worth/assets/liabilities; SIP current value/invested/P&L;
FI progress; Nifty drawdown; cashflow summary; market-data freshness, sync mode,
last-save time, profile completeness and liabilities; category composition pie
(plain `chart.js`, HTML legend below the canvas); FI target progress; Coorg
goal; two analytics charts (below); and, when SWP enabled, SWP, tax,
advisor-review and expense-tracker widgets. A market crash monitor can show a
severity banner. Dashboard refreshes
on state save while active and on theme change, and its trust-panel sync,
market-refresh and cloud-mode labels update live from the reactive status
stores (subscribed on render, unsubscribed by `teardownDashboard`). The
composition chart instance is replaced on every repaint (previous instance
destroyed before the markup is rebuilt) and destroyed by `teardownDashboard`;
mounting no-ops when no canvas or 2D context is available, so tests and odd
browsers still render the legend and labels.

Analytics charts plot two distinct real series. The **net-worth trend** card
charts persisted daily snapshots only: points are the recorded
`state.netWorthHistory` entries filtered by an inclusive date window from
`src/lib/dates.ts` (both endpoints included) — sparse days stay sparse, with
  no backfill, interpolation, or invented values; a `.chart-meta` provenance
  line names the source, point count and span, and notes that gaps are days
  without a snapshot. Its range buttons (3M/6M/1Y/
3Y/5Y/All) are native, keyboard-focusable `<button>`s, disabled unless the
snapshot span reaches within 15 days of that window start, so only supported
ranges are selectable; an empty history renders an empty state without
controls. The **Nifty 50 benchmark** card charts fetched market history from
`FeaturePorts.marketData.fetchNiftyHistory` (bounded cache; ≤5Y provider
clamp — ranges never exceed 5Y, and windows are cut client-side from the
fetched series). Its provenance line always identifies the provider, status
(`live`/`cache-fresh`/`stale (cached)`/`manual`), fetch date, point count and
span, plus a `partial` flag when history starts more than 7 days into the
window; the series is labeled benchmark data and is never presented as the
user's portfolio return. Two views exist — performance (provider index level)
and drawdown (percent below the running maximum of that same series, derived
in `chart-data.ts` without adding points). Missing history renders an
"unavailable" state with no chart and no range/view controls, and current
value KPIs are computed independently of both series. All three Chart.js
instances (pie, trend, benchmark) follow the same create/replace/destroy
discipline: destroyed before every markup rebuild, on `teardownDashboard`,
and recreated after repaint; range/view clicks rebuild only the affected
chart in place instead of repainting the dashboard.

Net worth rules: MF and SIP = units × matching cached NAV (MF requires explicit
scheme code; SIP may use name matcher); FD, EPF, ESOP and bonds sum `amount`;
demat sums `currentValue`; custom holdings sum `amount`; liabilities are
clamped nonnegative and subtracted. Composition percentages use gross assets
(not net worth). SIP invested value uses explicit positive cost basis when
present, otherwise monthly amount × inclusive elapsed local-calendar months
(date-fns `differenceInCalendarMonths`). The start date may be `YYYY-MM` or a
persisted full `YYYY-MM-DD` (its month is used); non-padded (`2024-1`) or
impossible (`2024-13`) months count as zero. SIP XIRR
generates one negative monthly flow from start month plus a positive current
value on now; total XIRR is the simple mean of fund XIRRs. FI target is user
entry; progress is current net worth / target (0 when no target), with years
remaining only when already achieved. Drawdown is max(0, `(high-level)/high`).

### Planning Tools — `src/modules/calculators/`

- **Crash Protocol:** bonds are the initial crash fund; displays 10%, 15%, and
  25% of entered crash-fund value. Nifty refresh stores level/high and displays
  drawdown plus deployment examples based on 10/15/25% of total net worth.
  Nifty can be entered manually. Background alert deployment values use the
  same percentages of bonds.
- **Emergency Runway:** `profile.annualExpenses` is stored monthly (the key
  name is legacy) and is used here as the monthly-expense amount; liquid
  assets are SIP (units × direct scheme-code cached NAV) plus only
  `fd.fd.amount`. It floors to months and labels ≥12 healthy, ≥6 moderate,
  otherwise low. This is the implemented UI behavior.
- **SIP Pause:** defaults to current total monthly SIP, six months and 12% annual
  return. UI estimate is missed contributions = monthly × months; lost growth
  approximation = missed × (annual % / 12 / 100) × 12; total is their sum.
- **Tax planner:** `src/modules/calculators/tax/ltcg-planner.ts` approximates
  long-term eligible SIP units as total units × (invested amount attributable
  to months beyond 12 / total invested). Uses cached NAV; positive gains are
  ranked descending. Allowance is max(0, ₹125,000 − lastHarvestedAmount),
  irrespective of the stored `harvestTarget`; recommendations allocate eligible
  gain up to that amount and convert allocated gain fraction to units/value.
- **SWP scheduler:** stores enabled, start month, monthly amount and rate field
  (rate is not used by execution). Manual simulation and daily auto-run reduce
  units in PPFCF → Nippon Growth → Nippon SmallCap → Gold order. Matching uses
  names/scheme codes; category units aggregate SIP and MF; value determines
  needed units rounded up for the initial redemption plan, then actual units
  are deducted SIP-first and MF-second. Records an SWP expense for today's
  **UTC** date (note: the LTCG record below uses the local calendar date). This is
  simulated state mutation, not a broker redemption.

Other exported calculation primitives in `src/lib/calculations.ts`: SIP future
value with monthly rate and zero-rate handling; simple SIP cost basis; XIRR via
the `xirr` package (365-day year; invalid dates/non-finite amounts dropped, null
when fewer than two valid flows remain, on missing sign, same-day flows,
nonconvergence, or any thrown package error); emergency runway (returns 999 for
positive assets and no
expenses); crash drawdown and 10/15/25% of 10% portfolio buffer; FI target =
25×annual expenses (4% rule); SIP pause future value. UI may implement local
estimates separately (as SIP pause does), so use the screen-specific logic
above for displayed behavior.

### Insurance — `src/modules/insurance/`

Captures term cover/premium and health cover/premium/family size. The
`insurance.term.expiryDate`, `insurance.term.provider`, `insurance.health.provider`
and `insurance.vehicle` fields exist in state and validators but have no UI
input. No insurance quote API is present. Health assessment and action-engine
thresholds are described under Plan below.

### Plan — `src/modules/plan/`

The health assessment combines four dimensions: FI progress (yellow if target
missing; low progress <10% is yellow), protection (red if no cover data;
otherwise yellow when below target), savings rate (red <15%, yellow <30%,
green otherwise; missing income is red), and portfolio watchdog. Watchdog
critical/high => red, other alert => yellow; overall is worst dimension. Term
cover target is max(10×annual income, ₹1Cr); health cover target is ₹20L for
family of two or less, otherwise ₹50L.

Action engine emits urgent watchdog alerts, urgent Nifty drawdown >10%, missing
insurance data, monthly insurance gaps, allocation drift >5%, tax harvest after
11 months/no initial harvest for age >25, April SIP step-up reminder, Coorg SIP
start within six months, and annual harvest reminder from calendar year 2032.
FD maturity logic is commented out and does not run. Completed action IDs are
persisted; current logic treats records under 30 days old as completed, then
resets them. List sorts incomplete before complete, then urgent/this-month/
upcoming/future.

Net-worth snapshots are appended once per UTC date when net worth >0. Milestones
are ₹10L, ₹25L, ₹50L, ₹1Cr, ₹2Cr, ₹5Cr, ₹10Cr and custom FI target; achieved IDs
persist and toast once. Plan includes cashflow summary, action, history and
health renderers.

### ESOP Tools — `src/modules/esop/`

Stores grant/shares, liquidation shares, vesting FMV, triggers and optional
holdings by ticker, quantity and currency. `esopDetails.vestingSchedule` is
persisted and validated but is no longer rendered or edited anywhere. Quotes use
Yahoo Finance through corsproxy; FX converts to INR. Value = quantity × quote ×
INR rate. There is no manual holding valuation path: a failed quote or missing
FX rate renders as unavailable. Stock quote freshness is 15 minutes.

### Assistant — `src/modules/assistant/`

Chat, privacy context, write consent, proposal diffs, reauthentication, audit
and undo are fully specified in [AI reference](ai.md). UI also displays Nifty
timestamp/freshness and three starter questions.

## Shared UI and formatting

`src/modules/ui/Modal.ts` wraps native `<dialog>` behavior for shared callers;
`Toast.ts` exposes transient status notifications. `lib/formatters.ts` provides
Indian currency/number formatting. The dashboard charts (composition pie,
net-worth trend, Nifty benchmark) use plain `chart.js` (no chart
wrapper/framework) with their lifecycle owned by
`src/modules/dashboard/index.ts` (`mountCompositionChart`,
`mountNetWorthChart` and `mountBenchmarkChart` replace the previous instance
on repaint; the matching `destroy*` helper runs before every markup rebuild
and on unmount), with data shaping isolated in
`src/modules/dashboard/chart-data.ts`. Accessibility uses native inputs/buttons, labels, dialog
and live regions where implemented. Route pages are pre-rendered/verified by
`scripts/routes.mjs`, `prerender-routes.mjs`, and route smoke scripts.

The shared date helpers in `src/lib/dates.ts` parse strictly as `YYYY-MM`
(year and month) or `YYYY-MM-DD` (calendar date); any other arrangement —
including partial values such as `2024-1`, extra segments such as
`2024-01-01T00:00:00Z` when a month is expected, and impossible values such as
`2024-13` or `2023-02-29` — return null rather than being corrected or rolled
over, while valid leap days such as `2024-02-29` are accepted. Parsed values
are local-midnight timestamps, and `isWithinDateRange` treats both endpoints as
inclusive: a date equal to the range start or range end is within the range,
and a range whose start falls after its end matches nothing. Existing
calculated call sites keep their own handling: months that fail their
`YYYY-MM` guard count as zero in invested/LTCG math (see below).

## Persistence signals and tests

Modules save through `FeatureContext.portfolio`; storage validates data and
keeps guest and UID scopes separate. Reactive signals are vanilla Nanostores
atoms in `src/core/stores.ts`: `portfolioSavedStore` for save invalidation
(dashboard subscribes with requestAnimationFrame coalescing),
`syncStatusStore` for coordinator status (`idle`/`pending`/`syncing`/
`offline`/`error`/`conflict`), `activeScopeStore` for the identity-neutral
active scope (`local`/`cloud`) and `marketRefreshStatusStore` for market
refresh cycles (`idle`/`refreshing`/`success`/`error`). Subscriptions return
unsubscribe callbacks that teardown invokes.

Scope-awareness: `PortfolioSession.teardown()` finishes by calling
`resetScopeStatuses()`, which clears sync status, market refresh status and
the scope signal — so guest↔user and user↔user switches never leave stale
status (including status published while the retiring scope's flush or
disposal runs). The session also publishes the scope signal when a sync
coordinator is attached. The dashboard's data-trust panel renders these
signals (`sync-status-value`, `market-refresh-value`, `scope-mode-label`)
and re-subscribes on every render without stacking callbacks;
`teardownDashboard()` unsubscribes them.

Ownership is unchanged: these stores are ephemeral UI signals only — durable
persistence stays in the portfolio repository/storage (identity-scoped
localStorage) plus Firestore, never in a Nanostores persistent store, and the
active uid remains owned by `PortfolioSession`; stores never hold identity.
Other UI still listens for auth/profile DOM events; offline
status is browser connectivity, not proof a queued remote write has
completed. Build/type checks: `npm run build`; format/lint: `npm run format:check`,
`npm run lint`; unit tests: `npm test`; browser workflows: `npm run test:e2e`.

## Profile: field lifecycle and data-management workflows

`src/modules/profile/index.ts` is the primary portfolio editor. `renderProfile()`
first calls `ensureCoreHoldingRows()`, then renders personal fields, demat
read-only cards, SIP rows, ESOP ticker rows, editable custom holdings and
liabilities, and data actions. Forms do not use a general form framework;
listeners are attached after template render. Most field edits save on blur
after a 500ms debounce, and are saved only if the DOM differs from `appState`.

### Personal assumptions

Inputs are name, DOB, monthly expenses, FI target, monthly income and tax slab.
`profile.annualExpenses` is stored as **monthly** rupees; the legacy key name
says annual. Annual figures are derived at the point of use (`stored × 12`):
the Plan's cash flow and plain-English summary multiply it by 12, dashboard
tiles show the annual figure, and the emergency runway screen uses the raw
stored value as monthly expenses. DOB uses native `type=date`;
`calculateAgeFromDateOfBirth()` (`src/types/portfolio.ts`) strictly parses
`YYYY-MM-DD` with date-fns and computes age from the UTC calendar day of
`today`, taking the anniversary inside today's year (Feb 29 falls on Mar 1 in
non-leap years). It returns null for malformed, impossible or future dates and
for years 0000–0099 (legacy `Date.UTC` windowing); `saveProfile()` additionally
rejects null or age >150. Name is optional,
but if present must be at least two characters. Positive-number helper is used
for expenses, FI target and income; empty fields do not reset existing numeric
values in `saveProfile()` (except DOB, which is reset to empty). Tax slab range
is 0–100 inclusive.

### SIP row edit/save

Rows use `sip1..sip10`; an empty initial form shows a temporary `sip1` row.
Name, scheme code, units, monthly amount, `YYYY-MM` start date and optional
cost-basis are read at save. A fund name blur can fill a missing code through
`getFundSchemeCode()` (three exact canonical fund mappings with case-insensitive
substring matching). If either name or code exists, name is required; a supplied
code must pass the shared scheme-code validator; units, monthly contribution
and cost basis cannot be negative; start date is validated if present. A
positive cost basis is stored; zero/blank removes override. An entirely blank
name+code row deletes that SIP entry. On successful save, NAV refresh is started
for all positive-unit SIPs, sequentially with 100ms spacing. Add SIP chooses
first free slot through 50, even though rendered save loop only reads slots
1–10; this is current source behavior and should be noted before expanding row
limits.

### Custom assets, liabilities, ESOP quote rows

Custom holdings are indexed `otherHolding1..50` by add button, while save scans
1..54. Each row has name, INR amount and annual return 0–100%. Empty rows are
deleted. Rows default read-only; Modify re-renders into edit mode and ✓ runs
whole-form validation/save. Three legacy core holding slots bridge FD/EPF/Bonds:
`otherHolding51` maps to `state.fd.fd`, 52 to `state.epf.epf`, and 53 to
`state.bonds.bonds`; existing non-zero legacy balances seed custom rows when
absent, and saving the row writes both representations. `otherHolding54` is
deleted on render. This is compatibility wiring, not duplicate categories in
net-worth totals: KPI math sums core holding maps and custom map separately, so
avoid populating both representations with the same amount unless intended.

Liabilities are indexed `liability1..50`, default to name+zero when added,
editable via a Modify/Save toggle, and deleted immediately. Save requires a
non-empty name for positive/nonzero value; blank name plus zero removes row;
amount must be finite and >=0; max 50 is enforced by form and state validator.
Liabilities are INR-only and subtracted from assets in net-worth KPI.

ESOP holding rows capture name, hidden symbol and currency, and editable quantity.
Rows are blank/default INR on add; save derives symbol from name if hidden symbol
empty, uppercases symbol/currency, rejects negative quantity and requires name
for non-zero quantity, removes empty zero rows, and sets `esopDetails.shares`
to sum of quantities. Profile refresh requests quote and FX values concurrently
via the market port; successful valuations sum into legacy `state.esop.esop`
INR amount. This refresh is separate from detailed grant/vesting fields in
`esopDetails`.

### CAS PDF import (exact flow)

1. Hidden file input accepts `.pdf`; `parseCASPDF()` uses FileReader to load an
   ArrayBuffer and loads local `/pdfjs/pdf.min.js` + worker assets on demand.
2. PDF.js extracts each non-empty text item with page/x/y coordinates. Parser
   groups text into rows within 2 y-units; page 1 is searched for uppercase
   investor name, PAN, email, mobile and as-on date.
3. Pages 2+ locate headings containing `folio no` (SOA) or `client id` (demat),
   infer numeric columns from the `Invested` header x-coordinate (fallback 250),
   and parse rows until `Total`. Scheme names may be buffered from prior text
   rows. Values are x-ordered as invested, units, NAV, market value, gain/loss;
   date and percent strings are parsed separately. Parenthesized amounts become
   negative. Empty 0-unit/0-market-value rows are discarded; duplicates keyed
   by identifier+scheme name keep the last row.
4. UI previews investor name/PAN, SOA fund units/invested/current values, and
   demat holdings marked not imported because the summary lacks ISIN. This is a
   confirmation preview, not a write.
5. Confirm clears all existing SIP and demat records, then imports SOA rows as
   `sipN` with parsed fund name, units, NAV date month (or current month),
   monthlyAmount 0 and optional invested value as costBasis. Demat rows with
   positive units become entries keyed from identifier (or normalized name),
   `isin: ''`, parsed name/quantity/currentValue. It closes and re-renders; toast
   says click Save to sync to cloud. Cancel discards pending parsed result.

### Backups and undo

- **JSON Download Backup:** removes runtime auth/sync fields, serializes the
  remaining state as pretty JSON, downloads `fire-os-backup-YYYY-MM-DD.json`,
  and stores local `fire-os:last-exported-at` for the reminder.
- **Restore Backup:** selects a JSON file, projects the persisted top-level
  allowlist (excluding auth/sync runtime fields), and validates the result with
  `persistedPortfolioSchema`. Invalid JSON or nested data shows validation
  issues and cannot be confirmed. Valid persisted data is previewed before the
  user explicitly confirms replacing the current portfolio. Confirmation
  normalizes omitted sections and saves through the active `FeatureContext`
  repository, preserving the active identity/runtime metadata. Cancel makes no
  state change or save; after confirmation the normal local-first, identity-
  scoped repository behavior applies.
- **CSV Export:** `buildPortfolioCsv()` serializes with PapaParse
  (`Papa.unparse` with `newline: '\r\n'` and `quotes: true`): every field is
  quoted, embedded quotes are doubled, newlines inside cells stay quoted, and
  rows are separated by CRLF with no trailing newline. Columns are Category,
  Name, Units, Monthly contribution, Cost basis, Value, Currency. It exports
  MF/SIP market value from cached NAV, holding maps, custom assets, demat and
  liabilities. Formula protection runs on string cells before serialization:
  a string beginning with optional whitespace followed by `=`, `+`, `@`, or
  `-` gets a leading apostrophe so spreadsheets treat it as text. Numeric cells
  are never formula-prefixed, so negative amounts stay numeric. A missing NAV
  yields blank value.
- **CSV Import:** `parsePortfolioCsv()` reads the same seven columns with
  PapaParse (`delimiter: ','`, no dynamic typing, BOM-tolerant header check)
  and validates the built candidate against `persistedPortfolioSchema`. Row
  numbers in issues are CSV record numbers with the header as row 1. Recognized
  categories are Mutual fund, SIP, FD, EPF, ESOP, Bonds, Other, Demat,
  Liability; unknown categories, duplicate Category+Name rows (first row wins),
  malformed or missing numbers, and raw formula-like names are reported as row
  issues and their rows are skipped, so a rejected row never partially imports.
  Blank numeric cells map to absent fields, never 0. Apostrophe policy: a
  leading `'` is stripped only when the rest of the cell matches the export
  pattern (`\s*[=+@-]`), which restores round-trip names (internal apostrophes
  such as `O'Brien` are untouched) and is surfaced as a row issue; unescaped
  formula-like text is rejected with a row issue instead of imported. Per-row
  limits are also enforced: a `__proto__` name is rejected, Other names cap at 200
  characters and Liability names at 100, each of Other/Liability caps at 50
  entries, and negative `Value`/`Amount` cells are rejected. The
  preview dialog lists valid rows and issues and requires an explicit mode
  choice before applying: **merge** overwrites only the top-level sections
  present in the file and preserves the rest; **replace** is a full normalized
  replacement like JSON restore, so sections absent from the CSV (including
  profile, which the export schema cannot carry) reset to defaults. Empty
  previews, cancelled dialogs, invalid candidates and failed saves never write;
  confirmation saves through the active `FeatureContext` repository first and
  assigns state only after the save resolves. Export-schema losses on import:
  SIP/MF start date and scheme code (valuation falls back to name matching or
  NAV refresh), Other-holding annual return (imports as 0), demat ISIN (imports
  blank), and fund Value (export-derived, re-derived from NAV).
- **Undo Last Change:** snapshots are in sessionStorage, scoped per active
  portfolio key, validated and capped at 10; identical consecutive snapshots
  are skipped. Undo requires at least two snapshots, restores the prior one,
  preserves current auth/sync runtime fields and then saves. This is session
  history, not durable cloud version history.
- **Delete Cloud Data:** requires signed-in UID and browser confirmation. Deletes
  holdings child documents and state document; local copy is explicitly kept.
- **Save to Firestore:** signed-in only; first validates/saves current form,
  then awaits cloud persistence, displays success/failure status. Routine saves
  can sync in background; this button is an explicit awaited save.

## Dashboard and market alert calculation details

Dashboard net-worth KPI uses a distinct valuation per state collection:
`mf` requires `schemeCode` and uses `units×nav`; `sip` uses explicit code or
name matcher; FD/EPF/ESOP/Bonds sum each holding amount; demat sums currentValue;
other holdings sum amount, except legacy keys `otherHolding51..53` are filtered
from that custom sum. Liability sum clamps each amount at zero. Gross assets are
used as composition denominator; net worth is assets-liabilities. ESOP
concentration is `state.esop` amount / assets. Other-holding weighted annual
return is Σ(amount×return)/Σamount after filtering legacy slots.

SIP status defaults invested value to zero unless costBasis positive; otherwise
it computes inclusive months between start month and now, with minimum one, and
multiplies monthlyAmount. Current value is units×NAV. XIRR approximation emits
one negative equal monthly flow from first-of-start-month for every elapsed
month plus current value on current date; returns are averaged per fund without
weighting. XIRR requires a plain `YYYY-MM` start date; a full `YYYY-MM-DD` or a
malformed month returns null XIRR, as do nonpositive contribution or nonpositive
value. The shared XIRR function requires positive and negative flows,
drops invalid dates and non-finite amounts (null when fewer than two valid
flows remain), then solves with the `xirr` package; same-day flows,
nonconvergence, and any other package error — as well as non-finite results —
return null instead of throwing. Input order is irrelevant: flows are not
sorted and results are order-independent.

Two further KPI helpers are exported but not rendered. `calculatePeriodReturn()`
filters `CashFlow[]` to `[start, end]` inclusive and delegates to
`calculateXirr`, returning null when an endpoint is invalid or the in-period flows
cannot be solved; it never synthesizes historical holding values. It is not the
value behind the SIP status XIRR above.
`attributeNetWorthChange(start, end, contributions)` returns
`{ startingValue, contributions, investmentReturn, endingValue }` with
`investmentReturn = end − start − contributions`, clamping start and
contributions to ≥0 and coercing non-finite inputs to 0; it is exposed through
`FeaturePorts` but has no UI consumer.

The 5-minute Nifty monitor fetches `fetchNifty()` immediately and then on a
recursive timer. Crash percent is rounded to an integer in
`detectCrashAlert()`: <10 low/no alert; 10–14 medium with fixed suggested
₹20,000; 15–24 high with ₹35,000; ≥25 critical with ₹60,000. The monitor only
calls back when alert severity changes or an existing alert clears. Auth session
controller replaces suggested fixed amount with actual deployment = current
bonds ×10/15/25% for medium/high/critical. Source comments and UI labels may
refer to other constants; this control flow is authoritative.

## Planning Tools: additional formulas and state effects

### Allocation drift

Targets from config: PPFCF 40%, NipponGrowth 30%, NipponSmallCap 20%, Gold 10%;
drift trigger is strictly greater than 5 percentage points. Current percentages
and drift round to one decimal. Recommendation rupees = abs(rounded drift)/100 ×
totalValue; display converts to lakh and rounds one decimal. Zero total value
returns targets, zero current/drift and no actions. Action-engine denominator
includes recognized funds plus custom holding value; passed target buckets only
contain recognized categories. Dashboard advisor request instead passes net
worth as denominator, so calculations can differ from Plan action suggestions.

### Scenario modeler

`calculateFIAge()` throws on invalid parameters — corpus/SIP must be nonnegative,
goal >0, CAGR/current age nonnegative. Monthly return = `(1+CAGR)^(1/12)-1`; every
iteration grows current corpus then adds current SIP; after each 12th contribution
monthly SIP steps up by default 10%. It stops when goal reached or at 1,000 months
(~83 years), then returns age to one decimal, month count, rounded final corpus and
a rounded percent label. If unreachable, it still returns capped-horizon values; no
separate failure status. The Plan tab uses fixed 17% CAGR, profile FI target or
₹55,000,000 fallback, profile age or 25 fallback, and total SIP monthlyAmount.
Coast FIRE helper is exported through ports but not displayed in current Plan
render; required corpus is target/(1+return)^years available; if already above
threshold coasting begins now; otherwise logs solve years from target/current
and returns null if no positive return or beyond retirement age. Like
`calculateFIAge()`, it throws on invalid parameters rather than returning null.
`compareFIScenarios()` projects each entered scenario through that same
`calculateFIAge()` math and returns results in input order with an `assumptions`
echo of the full input (label, corpus, SIP, step-up, return, goal, age);
scenarios with non-finite or negative (or zero-goal) assumptions are filtered
out without throwing. Comparison outputs are labeled estimates — the calculator
table and disclaimer state the assumptions used and describe every projection as
an estimate, never as a guaranteed or actual return.

### Tax planner and tax calendar

LTCG approximation includes only `state.sip`. Months held are inclusive from
start month to now using local-calendar month difference; long-term months are
`max(0, elapsed-12)`. The start date may be `YYYY-MM` or a persisted full
`YYYY-MM-DD` (its month is used); non-padded or impossible months yield zero
elapsed months. Invested amount
uses positive costBasis else monthlyAmount×months; average monthly investment
divides by max(1,elapsed), and estimated long-term invested is average × long-term
months. Eligible units are total units × long-termInvested/fundInvested, clamped
to [0,total units]. Current NAV uses scheme code/name matcher. Gains are
`max(0,longTermValue-longTermInvested)`. Remaining cap = max(0,125000 − recorded
lastHarvestedAmount); stored `harvestTarget` is not used for this calculation.
Funds sort by gains descending. Per fund allocated gain is min(gain, remaining),
units are longTermUnits×allocatedGain/gain, sale amount units×NAV. “Tax saved” UI
is recommended gain ×12.5%. Record increments lastHarvestedAmount by planned
gain and stores today's local calendar date; reset zeros both date and amount.

Section 80C screen reads `localStorage.epf_annual_contribution`, otherwise
estimates EPF as monthlyIncome×50%×12%×12; adds term-life annual premium; fixed
cap is ₹150,000. Input updates only localStorage and its UI calculations, not
portfolio state. Tax calendar is static reminders for March 31, April 1,
April 15 and July 31. It is a planner UI, not tax filing or a verified tax
eligibility service.

### SWP automatic execution

`checkDailyTasks()` runs after authenticated portfolio load. It creates at most
one UTC-date net-worth snapshot if net worth >0; records newly achieved
milestones; and for enabled SWP where current YYYY-MM ≥ configured start month,
checks whether an SWP-category expense already exists for that month. If not,
it calls `executeMonthlyWithdrawal()` asynchronously, persists after success,
toasts, and refreshes active dashboard. This is per app load/session check, not
a guaranteed background scheduler. `getSWPWithdrawalDates()` throws `RangeError`
when the configured start month is not a plain `YYYY-MM`; otherwise generated dates
start at UTC midnight, advance in local calendar months and serialize as UTC
`YYYY-MM-DD`; the list is simulated and not persisted. SWP order planning rounds required partial
units with `ceil(remaining/NAV)` but execution deducts actual units from SIP
entries then MF entries and does not write an external order or cap expense to
available holdings. It appends configured full amount even if holdings did not
cover the withdrawal. A manual simulator awaits cloud persistence.

## Exact Plan and auxiliary widget behavior

- **Cashflow:** if monthly income is absent, prompt to configure it. Annual income
  is monthly income×12; annual expenses is stored `profile.annualExpenses`
  (monthly rupees, legacy key name) × 12; surplus is difference; savings rate is
  surplus/income×100. Label says post-tax estimate but no tax deduction is
  calculated.
- **Health:** missing FI target is yellow; a configured target with corpus zero
  remains default green in this implementation. Protection is red when both
  term and health covers are zero; otherwise yellow for gaps. Savings missing
  income is red. Overall uses worst color. Watchdog specifics are below.
- **Action rules:** watch funds via stored user-maintained inputs; high alerts
  produce actions. Drawdown >10 creates month-keyed action. Insurance missing
  if both covers zero; if some cover exists, gaps use max(10×annual income,1Cr)
  and health ₹20L for family ≤2, else ₹50L. Allocation collects recognized
  SIP+MF current value and custom assets in denominator but custom amounts do
  not map to a target bucket. Harvest reminder uses elapsed days /30 >11; no
  record + profile age>25 adds initial reminder. April action encourages ≥10%
  SIP raise. Coorg action is when date is 0–6 months away. Calendar ≥2032 adds
  annual harvest action. FD-maturity rule is commented out.
- **Completed actions:** records ISO completedAt by action ID; computed as
  completed when less than 30 days old (including future timestamps); IDs often
  encode month/year to recur. Checkbox updates `completedActions` then rerenders
  Plan; persistence follows surrounding save/event pathways, not an explicit
  repository save in this handler.
- **Milestones:** fixed net worth thresholds plus custom FI target unless
  duplicate. History shows at most six latest stored snapshots. Trend is last
  minus first shown value; bar height relative to maximum displayed; dates and
  values are presentation-only.
- **Coorg:** default target ₹2Cr, SIP start 2031-01, monthly amount ₹10k. Progress
  is current corpus/target (not capped in data; UI bar caps at 100). Remaining
  target can be negative. Status is target reached, in progress if current date
  ≥ SIP start month, otherwise planning. It does not project SIP future value.
- **Watchdog:** PPFCF AUM > configured limit => high; Nippon Growth blocked >14
  days => medium; Small Cap blocked >60 => high; either manager exit => critical.
  It returns text guidance only; it does not alter investments or fetch manager
  status/AUM itself.
- **Expense tracker:** adds/display persisted expenses from dashboard modal.
  Metric named monthlyAverage is rounded totalAmount / expense-record count, not
  grouped by month/date; `_startDate` is unused. Target ₹122,000; within ±10%
  inclusive? Source uses strict `abs(variance)<10`, where variance is rounded
  whole percent. Widget is only displayed when SWP is enabled.
- **Advisor review:** dashboard builds corpus and allocation, posts email +
  portfolio summary + timestamp to `https://api.fire-os.app/advisor/review`,
  opens returned advisor URL. Dashboard uses account email or placeholder
  `user@example.com`; this sends PII and financial summary externally after an
  explicit button click. UI calls it only when SWP is enabled (widget itself is
  conditional). This route is separate from Assistant and Firebase.

## Auth UI and formatting details

Auth forms use email regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`, password minimum six
characters, and matching signup confirmation. Password reset validates email;
Firebase user-not-found is deliberately returned as success-neutral behavior.
Firebase provider error codes are mapped to user-facing generic messages.
Successful auth relies on the global auth-state listener to activate session;
form code does not navigate directly. Guest sessions are started by
`AuthSessionController` when no signed-in user and no sign-in prompt.

`formatCurrency()` uses crore suffix at absolute ₹10,000,000+, otherwise Indian
comma grouping; non-finite becomes ₹0. `formatNumber()` uses Indian grouping;
`formatPercentage()` expects fractional input and multiplies by 100. Date and
time helpers return empty string for invalid input. Modal helper uses native
`<dialog>.showModal()`, text content for title/button labels and caller-supplied
HTML for modal body; backdrop click and close button close it. Toast uses
role=status/aria-live polite, message textContent, four types and duration-based
dismissal.
