# FIRE OS — Master Technical Reference

This is the system map for the implementation currently in `src/`, `server/`,
`worker/`, and `firestore.rules`. It describes behavior found in source, not
financial advice or a product roadmap. Detailed area references:
[AI](ai.md), [backend and data](backend.md), [UI and calculations](ui.md).

## Product and runtime

FIRE OS is a local-first TypeScript single-page app built with Vite. It targets
Indian FIRE planning: profile, holdings and liabilities; market values; FI and
retirement planning; insurance; tax planning; ESOP valuation; and review
guidance. Guest portfolios remain in browser storage. Firebase-authenticated
users get UID-scoped local storage plus Firestore synchronization. The Assistant
is a separate proxy request to a Cloudflare Worker and OpenRouter.

```text
src/index.html -> src/main.ts
  -> appState + validated storage -> FeatureContext -> FeatureRegistry
  -> UI feature modules -> FeaturePorts -> API clients / calculations
  -> guest: localStorage
  -> signed-in: localStorage -> SyncCoordinator -> Firestore
  -> Assistant: sanitized summary -> Worker -> OpenRouter
```

Production is Firebase Hosting (`dist/`); rewrites send app routes to the SPA.
Firebase Functions are not part of current deployment. `server/` is a local
Express Assistant proxy used by `npm run dev`/tests; `worker/` is production.

## Bootstrap, navigation, and ownership

`src/main.ts` initializes global error handling, loads scoped local state,
hydrates market-data caches, renders navigation and auth UI, starts the auth
session controller, configures timers and theme, and mounts the profile.
`FeatureRegistry` maps `profile`, `dashboard`, `calculators`, `insurance`,
`plan`, `esop`, and `assistant` to module lifecycle functions. URL paths and
hashes select tabs; history/popstate restore navigation. The registry mounts
the selected module and unmounts the previous module when it provides teardown.
`FeatureContext` provides the shared mutable state, portfolio repository, and
injected UI/calculation/widget/market-data ports.

`AuthCoordinator` generations invalidate stale auth callbacks. `AuthSessionController`
loads the UID-scoped local copy, initializes Firestore, loads and merges remote
state, installs realtime listeners and a sync coordinator, then performs daily
tasks. Guest mode explicitly selects the anonymous scope and disables cloud
save. `PortfolioSession.teardown()` unsubscribes snapshots, pauses and attempts
a five-second pending-write flush, disposes sync and market monitors, disables
the storage scope, and resets live state. This prevents writes/callbacks from a
previous identity being applied to the next one.

## State and persistence contract

`FireOSState` is defined in `src/types/state.ts`; persisted top-level fields are
allowlisted by `PERSISTED_STATE_KEYS`. Major sections: `profile`; MF and SIP
fund maps; FD, EPF, ESOP, bonds, custom assets, liabilities and demat; NAV/Nifty/
FX caches; benchmark tracker; Coorg goal; fund watchdog inputs; SWP and tax
calendar; expenses; net-worth history; completed actions and milestones;
insurance; ESOP detail/vesting; and `marketHistory`, a bounded local cache of
market series. `currentUser`, `_lastSavedAt`, and `_syncMetadata`
are runtime-only. `persistedPortfolioSchema` (Valibot) and
`isPersistedPortfolioData()` enforce exact key/nested shapes, types, finite
numbers and selected limits; `normalizePersistedState()` fills omitted fields
from defaults, discarding a malformed `marketHistory` without discarding the
portfolio. Firestore rules independently validate their boundary.
`mergeState()` deep-merges known object sections,
unions milestones, deduplicates history dates, and keeps metadata explicit.

Storage keys are `fireOS_v2:anonymous` and `fireOS_v2:user:{uid}`; legacy
`fireOS_v2` is copied to the anonymous scope on first read. `saveData()` refuses
to write outside the selected identity scope, strips runtime fields and invalid
payloads, mirrors the in-memory history cache into `marketHistory` (schema
validated, per-series point caps of 1260 Nifty / 2520 NAV points, at most 8
series, 256 KB section budget, 24h TTL), saves locally, and records a portfolio
undo snapshot without history. `marketHistory` is attached to state
non-enumerably: JSON representations (Firestore envelopes, snapshots, backups,
Assistant context) never contain it, and a save over the 750 KB local ceiling
drops history first. Loaded state is adopted with `applyPersistedState()`
(startup and auth scope switches) because plain `Object.assign` skips the
non-enumerable field; the module cache is intentionally global across scopes
(market history is public market data). `persistPortfolioState()`
saves local-first, publishes the portfolio-save signal (`portfolioSavedStore`),
and optionally queues cloud sync. Guests never queue a cloud write. Snapshot
history backs Assistant undo.
Profile JSON restore validates the persisted allowlist, previews normalized
replacement data, and saves through the active repository only after explicit
confirmation; runtime identity/sync metadata remains scoped to the active
session. CSV import parses the export schema into a row-validated candidate
(`parsePortfolioCsv`), previews valid rows plus row issues, and applies only
after an explicit merge/replace choice and confirmation through the same
save-then-assign repository path: merge overwrites only the top-level sections
present in the file, replace is full normalized replacement (sections absent
from the CSV reset to defaults), and empty, cancelled, or invalid previews
never write.

Reactive UI signals are vanilla Nanostores atoms in `src/core/stores.ts`:
`portfolioSavedStore` (monotonic save invalidation), `syncStatusStore`
(`SyncCoordinator` status: `idle`, `pending`, `syncing`, `offline`, `error`,
`conflict`), `activeScopeStore` (active identity/UID) and
`marketRefreshStatusStore` (`idle`, `refreshing`, `refreshed`, `stale`). They are
ephemeral signals only — there is no `@nanostores/persistent` and no second copy
of the portfolio: durable portfolio persistence remains in
`PortfolioRepository`/`storage.ts` (identity-scoped localStorage) plus
Firestore. `main.ts` subscribes the dashboard refresh to the save store and keeps
its requestAnimationFrame coalescing; session teardown publishes the cleared
scope, disposes the coordinator (resetting status to `idle`), cancels the Nifty
monitor and runs `resetScopeStatuses()` plus registered unsubscribes so a
previous identity cannot push stale updates to the next one.

Authenticated synchronization uses an envelope (`schemaVersion`, `lastSavedAt`,
client metadata, section clocks, persisted `data`) and merge helpers in
`src/lib/merge.ts`. Writes are debounced (1s default), latest-pending-envelope
based, paused on teardown, resumed on reconnect, and retried up to three times
with exponential delay for transient failures. Firestore owns
`users/{uid}/portfolio/state`; MF records are split into
`users/{uid}/portfolio/state/holdings/{holdingId}`. Rules require owner UID and
validate envelope/holding structure. Payload metrics warn above 750 KB against
Firestore's 1 MiB document ceiling.

## Data and calculation flows

Market clients live in `src/modules/api/`. MFAPI NAV calls use a four-hour
cache, in-flight deduplication, a 30s timeout and stale-cache fallback. Nifty
uses Yahoo chart data through corsproxy.io (configured public proxy key), a
one-hour cache, then manual entry. History adapters (`fetchNiftyHistory(range?)`,
`fetchNAVHistory(code, range?)`) normalize provider series to at most 1260 Nifty
/ 2520 NAV daily points and are exposed through `FeaturePorts.marketData`; the
bounded cache hydrates from persisted `marketHistory` at startup and serves a
series as `cache-fresh` inside the 24h TTL, returns provider results as `live`,
and falls back to expired cache as `stale` only when the provider fails —
provider failures never erase a valid cache. FX uses Yahoo Finance through corsproxy.io,
validates ISO currency codes, and caches for 24h; same-currency conversion is
identity. ESOP stock quotes are cached for 15 minutes in memory and
localStorage, map `EPA:`, `NSE:`, `BSE:` symbols to Yahoo suffixes, then convert
quote currencies to INR. Details and API contracts are in [backend](backend.md).

Core formulas and their code locations:

| Behavior | Formula/semantics | Source |
| --- | --- | --- |
| Net worth | Assets across categories minus nonnegative liabilities; SIP/MF = units × cached NAV | `src/modules/dashboard/kpis.ts` |
| Net-worth change attribution | `investmentReturn = end − start − contributions`, with start/contributions clamped ≥0 and non-finite inputs coerced to 0. Exported through `FeaturePorts` but not currently rendered | `src/modules/dashboard/kpis.ts` |
| Portfolio composition | Each asset category / total assets; zero categories omitted | `src/modules/dashboard/kpis.ts` |
| Period return | Annualized XIRR over flows dated within `[start, end]` inclusive; does not synthesize missing historical values. Returns null when an endpoint is invalid or the in-period flows cannot be solved. Exported helper, not the value behind the SIP status KPI | `src/modules/dashboard/kpis.ts`, `src/lib/calculations.ts` |
| SIP P&L | Current value minus explicit cost basis or monthly contribution × elapsed months; XIRR approximates monthly cash outflows and current value | `src/modules/dashboard/kpis.ts`, `src/lib/calculations.ts` |
| FI progress | Net worth / user-entered FI target; achieved => 0 years remaining, otherwise unknown | `src/modules/dashboard/kpis.ts` |
| SIP future value | `P × (((1+r)^n − 1)/r)` with monthly rate; zero-rate fallback `P × n` | `src/lib/calculations.ts` |
| XIRR | `xirr` package (Newton-Raphson) solves annualized return on dated cash flows; invalid dates/non-finite amounts are dropped (null when fewer than two valid flows remain), null when a sign is missing, and any package error (same-day flows, nonconvergence) or non-finite result converts to null | `src/lib/calculations.ts` |
| Allocation drift | Current bucket percentage minus target (40/30/20/10); recommend when absolute rounded drift >5 percentage points | `src/modules/calculators/portfolio-rebalancing.ts` |
| FIRE-age scenario | Monthly compounding from annual CAGR, add SIP monthly, annual step-up default 10%, stop at goal or 1,000 months | `src/modules/calculators/scenario-modeler.ts` |
| Coast FIRE | Required today = target / `(1+return)^years`; coast age solves compound growth without contributions | `src/modules/calculators/scenario-modeler.ts` |
| LTCG harvest | Estimated long-term units from SIP months older than 12; gains allocated up to hard-coded ₹125,000 remaining yearly allowance | `src/modules/calculators/tax/ltcg-planner.ts` |
| Emergency runway | Selected liquid assets / monthly expenses; UI floors to whole months | `src/modules/calculators/index.ts`, `src/lib/calculations.ts` |
| SWP | Monthly amount redeemed by fixed fund order PPFCF, Growth, SmallCap, Gold; records expense and reduces units | `src/modules/calculators/swp-scheduler.ts` |
| Insurance gap | Term target = max(annual income × 10, ₹1Cr); health target ₹20L for family ≤2 else ₹50L | `src/modules/plan/action-engine.ts`, `health-status.ts` |
| Savings rate | (annual income − profile annualExpenses × 12) / annual income; red <15%, yellow <30% | `src/modules/plan/health-status.ts` |
| Profile age | date-fns strict `YYYY-MM-DD` parse; age from the UTC calendar day of today with the anniversary taken in today's year; null on malformed/impossible/future DOB or years 0000–0099 | `src/types/portfolio.ts` |

These are app calculation semantics, including simplifications and defaults;
they do not imply external trade execution. SWP modifies simulated portfolio
units only. The “tax-free” harvest allowance is hard-coded and not a tax-rule
engine. Read [UI](ui.md) for tab-level logic and additional calculations.

## User-facing feature map

- **Profile** (`src/modules/profile/`): profile and portfolio data entry,
  validation, JSON backup/import, CSV export/import round trip (PapaParse
  serialization with spreadsheet formula protection in
  `src/lib/portfolioCsv.ts`, parse/preview/merge-replace apply in
  `src/modules/profile/csv-import.ts`), PDF/CAS parsing and save.
- **Dashboard** (`src/modules/dashboard/`): net worth, SIP P&L, FI progress,
  market drawdown, allocation visualization, and analytics charts over two
  distinct series — persisted daily net-worth snapshots (sparse, never
  backfilled or interpolated) and fetched Nifty market history (benchmark
  only, always labeled with provider, freshness and span). Plain `chart.js`
  dependency; module-local lifecycle helpers replace each chart instance on
  repaint and destroy them on unmount, with a no-op fallback when no 2D
  canvas context exists; cashflow/data trust panels, goals,
  and conditional SWP/expense/advisor widgets.
- **Planning Tools** (`src/modules/calculators/`): crash protocol, emergency
  runway, SIP pause, LTCG tax planner, SWP scheduler, allocation rebalancing and
  side-by-side scenario comparison.
- **Insurance** (`src/modules/insurance/`): term and health cover data. Term
  expiry/provider, health provider and vehicle cover exist in state only and have
  no UI input.
- **Plan** (`src/modules/plan/`): health score, action list, milestones,
  cashflow and history-oriented planning.
- **ESOP Tools** (`src/modules/esop/`): vesting, triggers and quoted valuation.
- **Assistant** (`src/modules/assistant/`): consent-aware chat, proposal review,
  reauthentication for sensitive changes, local audit and undo.
- **Other shared UI** (`src/modules/ui/`): native dialog wrapper and toasts;
  global responsive layout/theme tokens in `src/styles/`.

All features persist the shared state; navigation does not imply a separate
backend resource. See [UI reference](ui.md) for per-module behavior.

## Assistant boundary

The browser builds the summary in `src/lib/assistant/sanitize.ts`, explicitly
transmits exact totals only with the request's `sendExact` choice, and POSTs to
`/api/assistant/query`. The Worker and local Express validate request and
extracted-proposal envelopes with Valibot in `shared/assistant-policy.js`, apply
the separate prompt regex policy, rate limit, forward a system prompt and conversation to
OpenRouter, extract a JSON proposal from model output, and return the reply.
OpenRouter credentials remain server-side. `PERSISTED_ALLOWLIST` remains the
server's top-level output projection; the browser merges proposals into a
candidate and validates the full persisted state before review/acceptance.
Firestore rules independently validate their write boundary. Full flow and
boundaries are in [AI reference](ai.md).

## Configuration and operational checks

- Browser public config: `VITE_FIREBASE_*`, optional
  `VITE_ASSISTANT_API_URL`, `VITE_CORSPROXY_API_KEY`; see `.env.example`.
- Worker secret: `OPENROUTER_API_KEY`; routing/limits in `worker/wrangler.toml`.
- Local proxy: root `.env` and `server/`; local default port 3001.
- Hosting headers/CSP, app rewrites, auth domains and Firestore paths are in
  `firebase.json` and `firestore.rules`.
- Tests: `npm test`, `npm run test:server`, `npm run test:worker`,
  `npm run test:rules`, `npm run test:rules:emulator`, `npm run test:e2e`.
- Gates: `npm run check` (fast local gate: build, lint, format, unit, worker,
  route metadata), `npm run lint`, `npm run build`; deployment:
  `npm run deploy:worker` and Firebase Hosting/rules deploy (see
  `docs/README.md`).

## Repository map

| Path | Purpose |
| --- | --- |
| `src/main.ts`, `src/app/` | Bootstrap, feature routing, auth/session lifecycle |
| `src/core/` | Feature context/ports, reactive status stores (`stores.ts`) and portfolio repository seam |
| `src/lib/` | State persistence, auth coordination, data transforms, calculations and Assistant policy client |
| `src/modules/` | Product UI, domain calculations and external API adapters |
| `src/types/` | State, portfolio, API and Firebase contracts/validators |
| `shared/` | Policy and OpenRouter model/error helpers shared with proxy runtimes |
| `server/` | Local Express Assistant proxy and tests |
| `worker/` | Production Cloudflare Assistant Worker |
| `firestore.rules`, `firestore.indexes.json` | Cloud data boundary |
| `scripts/`, `.github/workflows/` | Build/prerender, route checks, local development, CI/deploy |
| `e2e/` | Playwright user journeys |
| `docs/` | Curated references (`master.md`, `ui.md`, `backend.md`, `ai.md`, `README.md`, `CHANGELOG.md`) plus `docs/superpowers/` design plans and specs |

Update this reference when behavior or data contracts change; detailed
implementation facts should be linked to source, not duplicated from memory.

## End-to-end user workflows

### First visit and guest portfolio

`DOMContentLoaded -> initApp()` sets global error reporting, loads local storage
in the currently active anonymous scope, overlays valid persisted values onto
the singleton `appState`, hydrates caches, and builds shell DOM. Profile is
mounted immediately. Firebase auth listener decides whether to enter guest or
authenticated flow. With no account, guest mode restores the anonymous key,
shows tabs, disables cloud save, and every regular profile save synchronously
validates/writes local data only. Closing/reopening the browser keeps guest
portfolio in localStorage; logout button in guest mode asks user to sign in and
does not delete guest data.

### Sign-in, data merge, and cloud write

Login/signup form validation -> Firebase Auth call -> auth-state callback ->
UID storage scope -> local restore -> remote envelope fetch -> section timestamp
merge -> apply shared `appState` -> local cache update -> Firestore listeners +
sync coordinator -> refresh active UI. Each edit calls repository save, which
validates and persists local data first, publishes the save signal that
refreshes the dashboard, then queues cloud sync if authenticated. Explicit
Profile cloud-save awaits the
Firestore result. A remote listener repeats envelope merge and local apply
without echoing remote data back to cloud. On sign-out/account switch, listeners
stop, pending save receives bounded flush attempt, UID scope is disabled and
memory reset before another identity loads.

### CAS import and portfolio valuation

User selects a statement PDF -> PDF.js extracts positioned text -> parser
detects investor details plus SOA/demat rows -> preview/confirm -> confirmation
replaces existing SIP and demat collections with parsed rows -> user saves ->
local persistence and optional cloud sync -> dashboard refresh loads NAVs ->
KPI values are units × NAV. PDF import is a replacement for those collections,
not an append/merge. See [UI reference](ui.md#cas-pdf-import-exact-flow).

### Market cache and refresh

On startup persisted NAV/Nifty/FX caches hydrate API module. Dashboard identifies
missing/expired NAV for funded SIPs, renders loading state, and invokes the
deduplicated NAV refresh port. NAV values are copied from API module cache back
to app state. Background NAV refresh runs every NAV TTL while online and visible,
iterates one fund at a time and UID-guards updates. Nifty monitor is separately
started for authenticated session and performs immediate then five-minute
checks, while Calculator and Assistant can also manually/on-demand fetch Nifty.
FX/stock quotes are fetched when ESOP/FX features request valuations. API failure
behavior is not uniform: NAV returns stale cache, generic FX may return stale
cache, Nifty currently returns null after failed refresh, and stock quote does
not return expired cache. See [backend API behavior](backend.md#external-service-contracts-and-refresh-triggers).

### Financial planning updates

Profile fields and holdings drive Dashboard KPIs; Insurance thresholds use
profile income and entered covers; Plan derives health/action rows from KPI,
watchdog inputs and tax calendar; Calculator screens modify SWP/tax state or
show assumptions; daily auth-session task appends net worth history, marks
threshold milestones and may simulate an SWP for the month. No domain module
places securities orders. The ESOP page fetches public quote/FX, computes value,
shows deterministic tax/reinvestment scenarios and persists calculator
inputs/triggers; it does not interact with an employer equity plan.

### Assistant question and guarded write

Chat latest transcript -> on-demand Nifty fetch -> summarized context -> proxy
policy/limits -> OpenRouter response -> client displays response -> validates
any allowlisted proposal -> consent check -> review diff -> optional provider
reauth -> snapshot -> confirmed local save and optional cloud sync -> local
audit row. User rejection or any validation/reauth failure leaves portfolio
unchanged. See [AI reference](ai.md#full-request-trace-from-chat-event-to-model-result).

## Domain modules and contracts

| Domain | State inputs | Outputs/effects | Source of behavior |
| --- | --- | --- | --- |
| Auth/profile | Profile fields and identity | Shared `appState`, scoped persistence | `src/modules/auth/`, `src/modules/profile/` |
| Market data | Scheme code/currency/ticker | Cache entries with timestamp, source/status | `src/modules/api/` |
| Dashboard KPIs | All assets, liabilities, caches, profile | Net worth, P&L/XIRR, composition, drawdown | `src/modules/dashboard/kpis.ts` |
| Crash/watchdog | Nifty high/current; manually-entered fund rules | Severity alert and recommendation strings | `nifty-monitor.ts`, `fund-manager-alerts.ts` |
| Tax | SIP units, investment basis, NAV, tax calendar | Harvest estimates, 80C progress display | `calculators/tax/` |
| Retirement | Net worth, FI goal, SIP, assumptions | Simulated FI age/coast status, runway | `calculators/`, `lib/calculations.ts` |
| Plan | State + watchdog/insurance/tax rules | Health band, actions, milestones/history | `modules/plan/` |
| ESOP | Quote holdings + currency + exercise inputs | INR quote value, tax estimate, allocation proposal | `modules/esop/`, `api/esop.ts` |
| Expense tracking | Dated expenses and SWP settings | Mean expense amount per record vs fixed target | `trackers/expense-tracker.ts` |
| Advisor integration | User email, corpus and allocation | External review request URL | `integrations/advisor-webhook.ts` |
| AI guide | Sanitized context and conversation | Reply and optional user-confirmed state proposal | [AI reference](ai.md) |

## Important state and terminology notes

- All monetary amounts are plain JavaScript numbers and app UI generally treats
  them as INR; there is no decimal/money type or server-side financial ledger.
- `profile.annualExpenses` is labeled monthly on Profile, then annualized by
  several Plan functions; Emergency Runway uses the raw value as monthly. Use
  source-level semantics and do not silently normalize this field.
- `mf` and `sip` are separate `SIPFund` maps and are both valued in KPIs. Avoid
  duplicating the same underlying holding in both or it will count twice.
- Some cache data is part of portfolio persisted state, so state documents may
  include price snapshots. External providers remain source of refresh data.
- `state.esop` is a generic amount map included in net worth; `esopDetails`
  stores quote positions and exercise/vesting scenario inputs. The profile
  quote refresh may write computed market value into `state.esop.esop`.
- `swpSchedule.rate` and `taxCalendar.harvestTarget` are persisted but current
  SWP execution and LTCG planner use independent fixed behavior described in
  [UI](ui.md).
- `watchdogRules` hold user-entered observations; source code does not crawl
  manager changes, fund AUM, blocked days or market feeds to populate them.

## Build, route and test paths

Vite builds `src/index.html`/`src/main.ts` and TypeScript typecheck runs first.
Postbuild invokes prerender route metadata. `scripts/routes.mjs` defines route
title, description, heading and static details; prerender output under `dist/`
is verified by `test:metadata`. Firebase Hosting still rewrites routes to SPA
index. `scripts/verify-http.mjs` checks deployed response headers and
`scripts/smoke-routes.mjs` checks route availability. Playwright tests cover
guest navigation, portfolio profile flows and assistant request flow. See
`package.json` and `.github/workflows/` for exact command composition.

For implementation detail by ownership boundary, use [backend](backend.md),
[UI](ui.md), and [AI](ai.md). These references report source behavior, including
approximation, hard-coded defaults, and present differences between labels and
calculation inputs; they are not a substitute for the code when exact behavior
changes.
