# FIRE OS Architecture

## Overview

FIRE OS is a single-page Vite application written in TypeScript. `src/main.ts` bootstraps Firebase, owns authentication-session lifecycle, and initializes the feature modules. The application state is a typed `FireOSState` instance exported as `appState` from `src/lib/appState.ts`.

The application is intentionally modular, but it is not a framework component tree. Feature modules render into DOM containers, read the shared state, dispatch browser events when a view needs refresh, and use library boundaries for persistence, synchronization, calculations, and external APIs.

## Source Structure

```text
src/
  main.ts                    Bootstrap, auth listener, tabs, session teardown
  lib/
    appState.ts              Single in-memory FireOSState instance
    storage.ts               Validated local persistence and cloud enqueue boundary
    merge.ts                 Portfolio envelope creation and section-clock merge
    syncCoordinator.ts       Debounce, retry, offline queue, and flush lifecycle
    authCoordinator.ts       Auth generation and sign-out coordination
    calculations.ts          Financial calculations
    formatters.ts            Display formatting
    fundMatcher.ts           Fund lookup helpers
    error-handler.ts         Global error handling
    logger.ts                Logging helpers
  modules/
    auth/                    Firebase auth UI, validation, and error mapping
    api/                     Firestore, NAV, Nifty, EUR/INR, and API lifecycle
    dashboard/               Dashboard rendering, KPIs, and Coorg tracker
    profile/                 Profile editing and CAS PDF import
    calculators/             Rebalancing, scenarios, SWP, and tax tools
    plan/                    Planning, milestones, actions, and net-worth history
    insurance/               Insurance tracking
    esop/                    ESOP tools
    trackers/                Expense tracking
    watchdog/                Fund-manager alerts
    integrations/            Advisor webhook integration
    ui/                      Shared modal and toast primitives
  types/
    state.ts                 FireOSState and shared persisted-data guards
    firebase.ts              Portfolio envelope types and envelope validation
    portfolio.ts             Portfolio and holding types
    api.ts                   External API and cache types
  styles/                    Global tokens, layout, and application styles
e2e/                         Playwright workflow tests
docs/                        Architecture and API documentation
```

The directory tree above is authoritative for implementation locations. The application has one typed state instance and keeps unit tests beside the implementation, with browser workflows under `e2e/`.

## Runtime State And Module Boundaries

`appState` is the one mutable in-memory state object. It is initialized with `initializeState()` and passed to API initialization where needed. Runtime-only fields include `currentUser`, `_lastSavedAt`, and optional `_syncMetadata`; they are not part of persisted portfolio data.

Modules own their DOM and feature behavior. `main.ts` registers the auth, UI, profile, API, and tab modules, then initializes dashboard, calculators, insurance, plan, and ESOP modules when their tabs are first activated. Modules may dispatch events such as `profileUpdated`; they must not create a second application state or bypass the persistence boundary.

## Authentication And Session Lifecycle

`AuthCoordinator` in `src/lib/authCoordinator.ts` assigns a generation to each auth callback. `main.ts` owns the corresponding session resources:

1. Stop the Firestore portfolio listener.
2. Pause, flush with a bounded timeout, and dispose the active `SyncCoordinator`.
3. Dispose the Nifty monitor, clear the active envelope, and detach the storage sync coordinator.
4. Clear the active local-storage scope and reset `appState` to initialized defaults.
5. For a new user, select that user's storage scope before reading local data or building a Firestore envelope.
6. Reject stale remote snapshots and Nifty callbacks when their auth generation is no longer current.

Teardown is idempotent. A UID-scoped cache remains available for that UID, but it is not loaded into another account. Legacy `fireOS_v2` local data is migrated only into the anonymous scope and is never promoted automatically into an authenticated UID scope. Password-reset handling in `src/modules/auth/firebaseAuth.ts` maps a missing account to the same neutral result as an existing account.

## Persistence

### Local scope

`src/lib/storage.ts` selects one active local-storage key at a time:

- `fireOS_v2:anonymous` for signed-out state;
- `fireOS_v2:user:{uid}` for an authenticated user;
- legacy `fireOS_v2` is read only as an anonymous migration source.

`loadData()` parses the selected value, validates it with the shared state contract, normalizes omitted top-level sections from `initializeState()`, and returns `null` for malformed or runtime-contaminated data. Writes refuse state outside the active UID scope and serialize only portfolio fields.

### Centralized write path

Feature modules use `persistPortfolioState(state)` rather than separately calling low-level storage and queue functions. The operation:

1. Validates and writes the local representation synchronously.
2. Optionally enqueues one debounced Firestore envelope through the active `SyncCoordinator`.
3. Keeps local success when cloud enqueue fails.

Use `persistPortfolioState(state, { sync: false })` when applying a remote snapshot or saving profile data locally without a cloud echo. Use `{ awaitCloud: true }` for an explicit user-visible cloud save. `saveData()` and `queuePortfolioSave()` remain storage internals and session-bound helpers, not feature-level sequencing APIs.

## Firestore Data Model

The canonical owner-scoped state document is:

```text
/users/{uid}/portfolio/state
```

It stores a validated `PortfolioEnvelope` with `schemaVersion`, `lastSavedAt`, persisted `data`, optional client/server metadata, section clocks, migration/format metadata, and entry timestamps. `src/types/firebase.ts` delegates nested `data` validation to `isPersistedPortfolioData()` in `src/types/state.ts`, so local storage and Firestore envelope reads share the same persisted-state contract.

New portfolio saves use `fireOS_v4`. Mutual-fund (`mf`) entries are kept as the client-facing map in memory, but are split into individually validated documents at:

```text
/users/{uid}/portfolio/state/holdings/{holdingId}
```

Each holding document has `kind`, `value`, and `updatedAt`. `src/modules/api/firestore.ts` removes inline `mf` and `entryUpdatedAt.holdings` from the writable state envelope, writes/deletes holding documents in the same batch, and rehydrates the map when loading or receiving snapshots. Existing v2/v3 envelopes remain readable during migration.

`firestore.rules` enforces authenticated owner access, denies state deletion, validates fixed nested objects and envelope metadata, bounds dynamic containers, and validates each holding subdocument. Rules apply the complete post-write envelope validation to both create and update. The TypeScript guards additionally enforce finite numbers, parseable timestamps, exact keys, and normalized defaults at the application boundary.

## Data Flow

```text
User interaction
  -> module validation and state mutation
  -> appState
  -> persistPortfolioState
       -> validated localStorage write
       -> optional SyncCoordinator enqueue
       -> Firestore state envelope + holdings subdocuments
  -> profileUpdated or feature-specific UI refresh
```

Remote startup and snapshot flow is the reverse boundary: Firestore data is checked as a `PortfolioEnvelope`, holding documents are checked individually, envelopes are merged by section clocks, and the result is applied to `appState` before local-only persistence. The active auth generation is checked before remote data can mutate the current session.

External API modules use bounded fetches and cached values for NAV, Nifty, and EUR/INR data. Nifty monitoring returns a cleanup function; its in-flight completion path checks whether monitoring is still active before changing application state.

## Testing

Vitest tests live beside the implementation under `src/`:

- `src/lib/persistence.test.ts` covers malformed local data, nested validation, normalization, local-first ordering, UID scopes, and cloud failure retention.
- `src/lib/authCoordinator.test.ts` and `src/lib/authSession.test.ts` cover auth generations, teardown, and cross-account isolation.
- `src/modules/api/nifty-monitor.test.ts` covers stale in-flight monitor callbacks.
- `src/modules/auth/firebaseAuth.test.ts` covers authentication error mapping and neutral password-reset behavior.
- `src/lib/firestore.rules.test.ts` runs Firestore emulator rules cases for owner access, malformed envelopes, runtime-only fields, metadata bounds, updates, and validated holding subdocuments.

The Playwright workflow test is `e2e/portfolio.spec.ts`. The package scripts are the executable source of truth:

```bash
npm test                         # focused Vitest regression suites
npm run test:rules               # rules suite against a running emulator
npm run test:rules:emulator      # start an emulator and run the rules suite
npm run test:e2e                 # Playwright workflow tests
npm run build                    # TypeScript check and Vite production build
npm run lint                     # ESLint
```

## Deployment

`firebase.json` is the deployment configuration authority:

- Hosting publishes `dist` and rewrites SPA routes to `/index.html`.
- Firestore rules use `firestore.rules`.
- Firestore indexes use the tracked `firestore.indexes.json`, which currently contains no composite indexes because the application has no query requiring one.

A parity release must build first, validate the rules, and deploy all declared Firebase artifacts in one authenticated command:

```bash
npm ci
npm run build
npm run test:rules:emulator
npx --no-install firebase-tools deploy --only hosting,firestore:rules,firestore:indexes --project fire-os-dd6d6 --token "$FIREBASE_TOKEN"
```

The Firebase project identifier is configuration; `FIREBASE_TOKEN` is CI-secret material and must not enter source, frontend configuration, or build output. The GitHub workflow at `.github/workflows/deploy.yml` is the automation entry point and must preserve this Hosting/rules/indexes target as deployment wiring evolves.

## Security Residuals

The final security review found zero HIGH or CRITICAL findings. The following are deliberate, non-blocking residuals requiring future hardening work:

- **L1, moderate:** financial data is plaintext in browser storage. Any same-origin XSS or compromised executable CDN asset could read it. `src/index.html` still loads unpinned jsDelivr scripts and Hosting has no documented CSP/security-header policy.
- **L2, low:** several dynamic maps (`sip`, `fd`, `epf`, `esop`, `bonds`, `demat`, `nav`, `alphaTrackerData`, and `completedActions`) are bounded by Firestore rules but are not individually validated there. The client validator rejects malformed rehydrated values.
- **L3, low:** Firestore numeric/timestamp predicates and `isStoredMfEntry()` are looser than the client finite-number, parseable-date, and bounded-string contract for seeded or legacy data.
- **Authorization regression coverage, closed after t7:** `src/lib/firestore.rules.test.ts` explicitly exercises unauthenticated state/holding access, state deletion denial, owner holding update/delete, and cross-user holding CRUD denial.

These residuals do not change the current owner-scoped access model or the closed F1/F2/F3/F5 findings: cross-account cache contamination, inline dynamic MF/timestamp bypass, password-reset account enumeration, envelope metadata abuse, and the t7 authorization regression coverage are remediated for the current representation.

## Extension Guidance

When adding a persisted feature:

1. Add its type and default to `src/types/state.ts`.
2. Add the field to the shared persisted-data guard and normalization path.
3. Add the corresponding `PortfolioData` and envelope/rules validation when it crosses Firestore.
4. Route mutations through `persistPortfolioState`.
5. Add focused tests beside the owning library or module, plus emulator coverage for direct Firestore writes.
6. Update this document only when the ownership boundary, persistence contract, deployment surface, or test topology changes.

## See Also

- [API.md](API.md) - external API integrations and response contracts
- [QUICKSTART.md](../QUICKSTART.md) - developer setup and common commands# FIRE OS Architecture
