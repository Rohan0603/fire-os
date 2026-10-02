# FIRE OS Master Documentation

FIRE OS is a single-page Vite application written in TypeScript for financial-independence and retirement planning. It combines portfolio tracking, market data, planning tools, and financial calculators in a modular browser UI.

The application has one typed in-memory state object, `appState`, and uses Firebase Authentication and Cloud Firestore for optional owner-scoped cloud sync. It is offline-first: local browser storage remains the immediate persistence layer, while a debounced sync coordinator queues cloud writes when an authenticated user is online.

This document is the end-to-end guide for new developers. The current TypeScript source, Firebase configuration, and tests are authoritative when older README examples differ from implementation.

## Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Runtime State and Lifecycle](#runtime-state-and-lifecycle)
- [Persistence and Firestore](#persistence-and-firestore)
- [Calculations and Tools](#calculations-and-tools)
- [APIs and Resilience](#apis-and-resilience)
- [Screens and Data Links](#screens-and-data-links)
- [Screens and UI Behavior](#screens-and-ui-behavior)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security Residuals](#security-residuals)
- [Extension Checklist](#extension-checklist)
- [See Also](#see-also)

## Project Overview

### Technology

| Concern | Implementation |
| --- | --- |
| Application | TypeScript, Vite, browser DOM APIs |
| UI model | Modular feature modules rendering into DOM containers; no component framework |
| State | One mutable `FireOSState` instance exported as `appState` |
| Authentication | Firebase Authentication with email/password and Google popup sign-in |
| Cloud data | Cloud Firestore project `fire-os-dd6d6`, owner-scoped portfolio document |
| Local data | UID-scoped `localStorage`, plus Firestore IndexedDB persistence |
| Hosting | Firebase Hosting serving the Vite `dist` output |
| Testing | Vitest, Firestore rules emulator tests, Playwright |

### Main principles

- Feature modules own their DOM and use shared state and ports rather than creating duplicate state.
- User mutations pass through `persistPortfolioState()` so local writes, validation, and cloud enqueueing stay consistent.
- Authentication generations prevent stale listeners and API callbacks from mutating a newer user session.
- External data is treated as opportunistic. Fresh API data is preferred; unavailable market data requires manual confirmation rather than fabricating an index value.
- Firebase client configuration contains public identifiers only. Owner authorization is enforced by Authentication and Firestore Rules.

## Architecture

### Source structure

```text
src/
  main.ts                    Bootstrap, routing, auth lifecycle, module registration
  app/
    feature-registry.ts      Feature registration and mounting
  core/
    feature-context.ts       Shared state, repository, and ports context
    feature-ports.ts         UI, calculations, widgets, and market-data adapters
    persistence/             Portfolio repository boundary and tests
  lib/
    appState.ts              Singleton FireOSState instance
    authCoordinator.ts       Auth generation and sign-out coordination
    calculations.ts           Shared financial calculations
    config.ts                Endpoints, limits, TTLs, goals, scheme codes
    error-handler.ts         Global error handling
    formatters.ts             Display formatting helpers
    fundMatcher.ts            Fund lookup helpers
    logger.ts                 Logging helpers
    merge.ts                  Envelope and section-clock merging
    persistence.test.ts       Persistence regression tests
    storage.ts                Local storage and centralized persistence boundary
    syncCoordinator.ts        Debounce, retry, offline queue, and cloud flush
  modules/
    auth/                     Firebase auth UI, validation, error mapping
    api/                      NAV, Nifty, EUR/INR, Firestore, and monitoring
    calculators/              Rebalancing, scenarios, SWP, and tax tools
    dashboard/                KPIs, dashboard widgets, and Coorg tracker
    esop/                     ESOP UI
    insurance/                Insurance UI
    integrations/             Advisor webhook integration
    plan/                     Milestones, actions, cash flow, and net worth
    profile/                  Portfolio profile and CAS PDF import
    trackers/                 Expense tracking
    ui/                       Modal, Toast, and shared UI helpers
  styles/                     Tokens, layout, and global styles
  types/                      State, portfolio, Firebase, and API contracts

e2e/                          Playwright workflow tests
docs/                         Architecture and API reference documents
firestore.rules                Firestore access and data validation rules
firebase.json                 Hosting, rules, indexes, and emulator configuration
.github/workflows/deploy.yml   Continuous deployment workflow
```

### Bootstrap and module boundaries

`src/main.ts` initializes global error handling, Firebase services, the API module, local state, the UI module, Profile, authentication listeners, tab navigation, background refresh, offline notifications, and theme handling. It also registers top-level features with `FeatureRegistry`:

- Profile is mounted during startup.
- Dashboard, Calculators, Insurance, Plan, and ESOP are initialized the first time their tab is mounted and rendered again on later activation.
- API, Auth, and UI services are available across the application lifecycle.

`FeatureContext` exposes the shared state, portfolio repository, and `FeaturePorts`. Ports let modules call UI, calculation, widget, and market-data capabilities without directly depending on unrelated modules.

A typical feature follows this shape:

```typescript
export function initFeatureModule(containerId: string, context: FeatureContext): void {
  // Attach one-time event handlers and initial DOM behavior.
}

export function renderFeature(container: HTMLElement, context: FeatureContext): void {
  // Read context.state and render current values.
}
```

Modules may mutate validated portfolio fields and must persist through the central boundary. They communicate refresh needs through the established context and browser events such as `profileUpdated`.

## Runtime State and Lifecycle

### `appState`

`src/lib/appState.ts` exports one `FireOSState` instance created by `initializeState()` in `src/types/state.ts`. State is grouped into these areas:

- Profile: name, date of birth, age, tax slab, expenses, FI target, and income.
- Holdings: mutual funds/SIPs, FDs, EPF, ESOPs, bonds, other holdings, and demat holdings.
- Market cache: NAV entries, Nifty data, EUR/INR data, and alpha tracker data.
- Planning: SWP schedule, tax calendar, expenses, net-worth history, completed actions, and achieved milestones.
- Insurance: term-life, health, and vehicle coverage.
- Watchdog and ESOP details: fund-manager rules, vesting schedules, triggers, and valuations.
- Runtime-only values: `currentUser`, `_lastSavedAt`, and `_syncMetadata`.

Runtime-only values are cleared during session teardown and are never written as persisted portfolio data. Runtime guards validate finite numbers, timestamps, exact keys, bounded collections, and normalized defaults.

### Authentication and session lifecycle

`AuthCoordinator` assigns a monotonically increasing generation to authentication callbacks. `main.ts` owns resources associated with the current generation.

```text
Firebase auth callback
  -> increment auth generation
  -> stop previous Firestore listener and Nifty monitor
  -> pause and bounded-flush previous SyncCoordinator
  -> clear previous storage scope and reset appState
  -> select anonymous or UID-scoped local storage
  -> load and validate local data
  -> load and merge Firestore envelope for authenticated users
  -> start listener, sync coordinator, and market monitoring
  -> render current feature state
```

When signing out or switching accounts, teardown is idempotent. Pending cloud work gets a bounded flush attempt, listeners and monitors are disposed, the active envelope is cleared, and state is reset. A new account can only load its own `fireOS_v2:user:{uid}` scope. Stale snapshots, timers, and callbacks are rejected when their generation or UID no longer matches the active session.

## Persistence and Firestore

### Local persistence

`src/lib/storage.ts` selects one active local scope:

| Session | Storage key | Cloud writes |
| --- | --- | --- |
| Guest | `fireOS_v2:anonymous` | Never |
| Authenticated | `fireOS_v2:user:{uid}` | Enqueued through `SyncCoordinator` |
| Legacy migration source | `fireOS_v2` | Read only into anonymous scope |

`loadData()` parses and validates stored data, rejects malformed or runtime-contaminated values, and fills omitted sections from `initializeState()`. `persistPortfolioState(state)` validates and writes local state synchronously, then optionally queues a Firestore envelope. Use `{ sync: false }` when applying remote data or making a local-only change, and `{ awaitCloud: true }` when a caller needs an explicit cloud-save result.

### Sync coordination

`SyncCoordinator` keeps local success independent from cloud availability. Its defaults are:

| Setting | Default |
| --- | ---: |
| Debounce before write | 1 second |
| Maximum retries | 3 retries after the first attempt |
| Retry base delay | 500 ms with exponential backoff |
| Offline behavior | Keep pending envelope and retry on `online` |
| Status values | `idle`, `pending`, `offline`, `syncing`, `error` |

Retryable Firebase/network errors are retried. Authentication teardown pauses the coordinator, attempts a bounded flush, then disposes it so an old account cannot write into a new session.

### Firestore data model

The canonical owner document is:

```text
/users/{uid}/portfolio/state
```

It contains a validated `PortfolioEnvelope`, currently written in the `fireOS_v4` representation. The envelope includes schema/version metadata, `lastSavedAt`, persisted data, optional client and server metadata, section clocks, migration/format metadata, and entry timestamps.

Mutual-fund entries are represented as a client-facing map in memory but are split into individually validated documents for cloud storage:

```text
/users/{uid}/portfolio/state/holdings/{holdingId}
```

A holding document has this shape:

```json
{
  "kind": "mf",
  "value": {
    "name": "Example Fund",
    "schemeCode": "122639",
    "units": 10,
    "startDate": "2024-01-01",
    "monthlyAmount": 10000
  },
  "updatedAt": "2026-10-02T00:00:00.000Z"
}
```

`src/modules/api/firestore.ts` writes the state envelope and holding documents in a batch, removes the inline mutual-fund map from the writable envelope, and rehydrates the map when loading or receiving snapshots. `src/lib/merge.ts` merges portfolio sections by their latest section timestamp and merges individual holdings by entry timestamp, with client/write identifiers used as deterministic tie-breakers.

### Portfolio data flow

```text
User input
  -> module validation and appState mutation
  -> persistPortfolioState(state)
  -> validated localStorage write
  -> debounced SyncCoordinator enqueue
  -> Firestore state envelope + holding subdocuments
  -> realtime snapshot
  -> envelope and section-clock merge
  -> apply validated data to appState
  -> feature refresh or profileUpdated event
```

Remote data follows the same validation boundary before it can mutate the current session. Firestore Rules separately enforce authenticated owner access, bounded structures, exact supported keys, validated envelopes, valid holding documents, and state deletion denial.

## Calculations and Tools

| Tool or capability | Ownership | Purpose |
| --- | --- | --- |
| Portfolio rebalancing | `src/modules/calculators/portfolio-rebalancing.ts` | Compare current allocation with configured targets and show required trades. |
| Crash Protocol | Calculators and dashboard | Model 10%, 15%, and 25% Nifty drawdowns and suggested bond deployment. |
| Scenario Modeler | `src/modules/calculators/scenario-modeler.ts` | Model long-term corpus outcomes under return assumptions and adverse scenarios. |
| SWP Scheduler | `src/modules/calculators/swp-scheduler.ts` | Project monthly withdrawals and execute scheduled monthly withdrawal actions. |
| Tax tools | `src/modules/calculators/tax/ltcg-planner.ts` | Estimate LTCG and track tax-harvesting targets and dates. |
| Dashboard KPIs | `src/modules/dashboard/kpis.ts` | Calculate net worth, FI progress, SIP status, P&L/XIRR, float, and composition. |
| SIP and XIRR tools | `src/lib/calculations.ts` and calculators | Compare invested amounts, current values, cash flows, and return metrics. |
| Emergency runway | Calculators | Estimate months of expenses covered by liquid assets. |
| Insurance requirement | Calculators and Insurance | Estimate required cover from income and lifestyle gaps. |
| SIP pause and step-up SIP | Calculators | Show missed-contribution impact and annual contribution increases. |
| Dual goal and home corpus | Calculators and Coorg tracker | Track FI corpus and home/down-payment goals. |
| FD interest and maturity | Calculators | Track fixed-deposit rates, tenors, interest, and maturity dates. |
| ESOP valuation | `src/modules/esop` | Model vesting, grant/current value, liquidation shares, triggers, and currency conversion. |
| Insurance tracking | `src/modules/insurance` | Store term-life, health, vehicle coverage, premiums, providers, and dates. |
| Expense tracker | `src/modules/trackers/expense-tracker.ts` | Record and review expense-related planning data. |
| Fund-manager watchdog | `src/modules/watchdog/fund-manager-alerts.ts` | Apply AUM, manager-exit, and blocked-day rules to fund alerts. |
| Alpha tracker | Dashboard and API cache | Compare fund performance against configured benchmarks. |
| Planning tools | `src/modules/plan` | Manage milestones, actions, cash-flow summaries, plain-English guidance, and net-worth history. |
| Advisor integration | `src/modules/integrations/advisor-webhook.ts` | Expose the advisor webhook integration widget/action. |

## APIs and Resilience

### API summary

| Service | Source/module | Freshness and timeout | Fallback |
| --- | --- | --- | --- |
| Mutual-fund NAV | `api.mfapi.in/mf/{schemeCode}` via `src/modules/api/mfapi.ts` | 4-hour cache; 30-second abort timeout; in-flight request deduplication | Stale cached NAV, then `null` and manual entry UI |
| Nifty 50 | Yahoo Finance Chart API through AllOrigins or corsproxy via `src/modules/api/nifty.ts` | 1-hour cache; 8-second proxy request timeout | Gold ETF NAV approximation, stale cache, then default values/manual entry recommendation |
| EUR/INR | Yahoo Finance `EURINR=X` Chart API through `corsproxy.io` via `src/modules/api/eurInr.ts` | 24-hour cache; 10-second abort timeout; rate range 80-150 | Stale cached rate, then manual EUR/INR modal |
| Portfolio sync | Firebase Cloud Firestore project `fire-os-dd6d6` via `src/modules/api/firestore.ts` | Debounced and retried by `SyncCoordinator` | Local state remains available; pending write waits for reconnect |

Public APIs and proxies can impose their own rate limits and availability policies. The application does not treat a cached or approximate value as proof of freshness; it uses those values to preserve continuity and gives the user a manual route when automation cannot produce a trustworthy value.

### Mutual-fund NAV

`fetchNAV(schemeCode)` checks the in-memory cache, deduplicates concurrent requests for the same scheme, requests the latest entry from `https://api.mfapi.in/mf/{schemeCode}`, validates the response and numeric NAV, and caches successful results. It returns an expired cache entry after network errors, invalid responses, HTTP failures, or timeouts. If no cache exists, callers can show the manual NAV entry modal.

### Nifty monitoring

`fetchNifty()` first returns a fresh cached value. Otherwise it tries Yahoo Finance Chart API data for `%5ENSEI` through two proxy options:

1. `https://api.allorigins.win/get?url=...`
2. `https://corsproxy.io/?key=...&url=...` when `VITE_CORSPROXY_API_KEY` exists

If both proxy paths fail, the module fetches scheme `135106` as a Gold ETF proxy, estimates the index level and 52-week high, and marks the source as an approximation. It then returns an expired cache when available. The current implementation finally supplies dated default values with a manual-entry recommendation, so the UI may still render rather than receiving `null`.

`monitorNiftyLevel()` periodically refreshes market data and crash indicators. Its cleanup and generation checks prevent stale monitor work from changing a newer session.

### EUR/INR

`fetchEURINR()` calls `convertCurrency(1, 'EUR', 'INR')`. The request uses Yahoo Finance Chart API symbol `EURINR=X` through `corsproxy.io`; the proxy key is read from `VITE_CORSPROXY_API_KEY`. Results outside the configured 80-150 sanity range are rejected. A valid result is cached for 24 hours, while failed or unavailable requests use the cached value even when expired. The manual modal accepts a rate only within the same range.

The generic `convertCurrency(amount, sourceCurrency, desiredCurrency)` path validates finite amounts and three-letter currency codes, returns same-currency values without a request, and returns `null` when proxy configuration, response data, or rate validation fails.

### Error and cache behavior

| Failure | Behavior | User experience |
| --- | --- | --- |
| Network or proxy unavailable | Log warning/error and use stale cache where available | Existing value remains visible; refresh may be retried later |
| Request timeout | Abort request and use fallback | Toast or module error handling explains refresh failure |
| HTTP error/rate limit | Reject response and continue fallback chain | Cached/approximate/manual value is used |
| Invalid provider payload | Validate shape and numbers before caching | Invalid data never becomes the active cache |
| No NAV cache | Return `null` | Manual NAV modal can collect a value |
| No EUR/INR cache | Return `null` | Manual EUR/INR modal can collect a value |
| No reliable Nifty source | Use default values or manual entry recommendation | User can override current level and 52-week high |
| Firestore unavailable/offline | Keep local state and pending envelope | Sync status becomes offline/pending and retries on reconnect |

Cache values are initialized from persisted state when possible. External cache entries are held in memory and mirrored into the persisted portfolio cache by the API/storage integration.

## Screens and Data Links

| Screen or supporting module | Main state and behavior | External dependencies |
| --- | --- | --- |
| Dashboard | Reads holdings, profile, market cache, planning data, and calculates KPIs and crash status. | NAV, Nifty, planning helpers, Chart.js/CDN assets where configured. |
| Profile | Edits profile and holdings, validates input, exports/imports data, and imports CAS PDFs. | PDF.js CDN for CAS parsing; persistence and Firestore migration. |
| Calculators | Reads portfolio/profile assumptions and writes planning results such as SWP and tax calendar. | Calculation ports; Nifty values for crash scenarios. |
| Plan | Renders milestones, actions, cash flow, plain-English guidance, and net-worth history. | Portfolio state and calculation ports. |
| Insurance | Reads and writes term-life, health, and vehicle coverage records. | Central persistence only. |
| ESOP Tools | Reads ESOP details, vesting data, triggers, and holdings; refreshes currency and quote data. | EUR/INR API, configured market quote integrations, persistence. |
| Watchdog | Evaluates fund-manager exits, AUM limits, and blocked-day thresholds. | Portfolio data and persisted watchdog rules. |
| Trackers | Records expenses and cooling-off or review workflow data. | Central persistence and Toast/Modal UI. |
| Integrations | Hosts advisor webhook behavior and related widgets. | Feature ports and configured integration endpoint. |
| UI primitives | Provides `Modal` and `Toast` for confirmations, manual inputs, errors, and status. | Browser DOM and global styles. |
| Auth | Renders sign-in, sign-up, Google popup, password reset, and neutral error messages. | Firebase Authentication. |
| API module | Initializes caches, Firestore, Nifty monitoring, and market-data adapters. | Firebase, external APIs, local persisted cache. |

Modules read through `FeatureContext` and `FeaturePorts` where an adapter exists. A module that changes persisted data should validate the input, mutate the appropriate `appState` section, call `persistPortfolioState`, and request the narrowest relevant UI refresh.

## Screens and UI Behavior

### Dashboard

The Dashboard renders net worth, FI progress, SIP status, per-fund invested/current/P&L/XIRR rows, portfolio composition, cash-flow summaries, Coorg progress, and market float/crash indicators. KPI calculations live in `src/modules/dashboard/kpis.ts`. Nifty monitoring can update crash alerts and market-derived widgets without replacing the user portfolio state.

### Profile and CAS import

Profile renders editable personal assumptions and supported holdings. The CAS PDF flow is:

```text
Upload NSDL/CDSL CAS PDF
  -> PDF.js text extraction
  -> fund, unit, date, and demat candidate parsing
  -> confirmation modal
  -> user confirms
  -> validated profile/holding update
  -> local persistence and optional cloud sync
```

Profile data-management actions also support JSON export/import and authenticated local-to-cloud migration choices.

### Planning

The Plan screen combines milestones, completed actions, net-worth history, cash-flow summaries, and plain-English explanations. Net-worth history is persisted so the UI can show progress across sessions. Milestones can be checked after relevant portfolio changes.

### ESOP Tools

ESOP tools calculate grant/current value, vesting, liquidation scenarios, and trigger-based planning. EUR-denominated values can call `fetchEURINR()` automatically. If the rate cannot be fetched or is outside the sanity range, the user can enter a validated rate in the manual EUR/INR modal.

### Nifty and manual market entries

Nifty monitoring prefers live Yahoo data, then a Gold ETF approximation, cached data, and finally defaults/manual entry. NAV and EUR/INR have their own manual entry paths. Manual values are validated before being cached so a failed provider cannot replace a valid value with malformed data.

### Toasts, modals, and errors

`Toast` provides short-lived status and error feedback. `Modal` supports confirmation and manual-entry workflows, including CAS confirmation and market-data overrides. Global error handling catches unhandled errors and reports a recoverable message rather than silently failing the entire application. Module initialization failures render a local error message when possible.

## Testing

| Layer | Command/file | Coverage |
| --- | --- | --- |
| Focused Vitest | `npm test` | Persistence, auth coordination/session lifecycle, ESOP API behavior, Nifty monitor staleness, and Firebase auth error mapping. |
| API unit tests | `src/modules/api/*.test.ts` | NAV, Nifty, EUR/INR, ESOP, and monitor behavior. |
| Persistence/auth unit tests | `src/lib/*.test.ts` | Malformed local data, UID scopes, local-first behavior, cloud failures, auth generations, and teardown. |
| Firestore rules | `npm run test:rules` | Owner access, cross-user denial, state deletion denial, envelope bounds, and holding validation. |
| Firestore emulator | `npm run test:rules:emulator` | Starts the Firestore emulator and executes the rules tests. |
| Browser workflows | `npm run test:e2e` and `e2e/portfolio.spec.ts` | Guest tab access and configured authenticated portfolio workflows. |
| Static quality | `npm run build`, `npm run lint` | Strict TypeScript check, Vite production build, and ESLint. |

Authenticated Playwright scenarios require the expected `E2E_EMAIL` and `E2E_PASSWORD` environment values. The rules suite requires the Firebase emulator and its Java runtime.

## Deployment

### Firebase resources

- Project: `fire-os-dd6d6`
- Hosting output: `dist`
- Hosting mode: SPA rewrite from all routes to `/index.html`
- Firestore rules: `firestore.rules`
- Firestore indexes: `firestore.indexes.json` (currently no composite indexes)
- Firestore emulator: port `8082`
- Supported Firebase services: Authentication, Firestore, IndexedDB persistence, and Hosting
- Intentionally out of scope: Firebase Functions, App Hosting, Cloud Run, and other Blaze-only backend services

### Local build and deploy

```bash
npm ci
npm run build
npm run test:rules:emulator
npx --no-install firebase-tools login
npx --no-install firebase-tools use fire-os-dd6d6
npx --no-install firebase-tools deploy \
  --only hosting,firestore:rules,firestore:indexes \
  --project fire-os-dd6d6
```

The project pins `firebase-tools` in `package.json`. Frontend Firebase values and the CORS proxy key are supplied through `VITE_*` environment variables at build time. Firebase web API keys are public identifiers; service-account files, private credentials, and deployment tokens must never enter source or `dist`.

### CI/CD

`.github/workflows/deploy.yml` runs on pushes to `main` and manual dispatch:

1. Checkout source.
2. Set up Node 22 and Java 21.
3. Run `npm ci`.
4. Build with Firebase and CORS proxy environment values.
5. Run Firestore emulator rules tests.
6. Deploy Hosting, rules, and indexes to `fire-os-dd6d6` using the `FIREBASE_TOKEN` secret.

### npm scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Run `tsc --noEmit`, build Vite output, then prerender routes through `postbuild`. |
| `npm run postbuild` | Run `scripts/prerender-routes.mjs` after a build. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run ESLint. |
| `npm run format` | Format repository files with Prettier. |
| `npm run format:check` | Check formatting without writing. |
| `npm test` | Run the focused Vitest regression set. |
| `npm run test:watch` | Run Vitest interactively. |
| `npm run test:rules` | Run Firestore rules tests against an available emulator. |
| `npm run test:rules:emulator` | Start the Firestore emulator and run rules tests. |
| `npm run test:e2e` | Run Playwright workflows. |

## Security Residuals

The current owner-scoped access model and major identified authorization issues are covered by rules and tests. Remaining deliberate residuals are:

- Financial data is plaintext in browser storage. A same-origin XSS or compromised executable CDN asset could read it.
- Some third-party scripts are loaded from CDN without documented pinning, and Hosting does not currently document a CSP/security-header policy.
- Several dynamic maps are bounded by Firestore Rules but not individually validated there; client-side rehydration validation remains stricter.
- Firestore numeric/timestamp predicates and legacy `isStoredMfEntry()` checks are looser than the client finite-number, parseable-date, and bounded-string contract for seeded or legacy data.

These are hardening items, not reasons to bypass the current persistence boundary. Do not place secrets in frontend configuration, and keep owner authorization in Firestore Rules rather than relying on UI visibility.

## Extension Checklist

When adding a persisted feature:

1. Add its type and default to `src/types/state.ts`.
2. Update persisted-data guards and normalization.
3. Update `PortfolioData`, envelope validation, and Firestore Rules when the field crosses the cloud boundary.
4. Route all mutations through `persistPortfolioState()`.
5. Add focused unit tests and emulator coverage for direct Firestore writes.
6. Update this document when ownership boundaries, persistence contracts, deployment surfaces, or test topology change.

## See Also

- [API.md](docs/API.md) - external API contracts, caching, errors, and fallbacks
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - detailed architecture, lifecycle, persistence, and security notes
- [QUICKSTART.md](QUICKSTART.md) - setup, Firebase configuration, and common developer commands
- [README.md](README.md) - product overview, feature list, Firebase setup, and user workflows
