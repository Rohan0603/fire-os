# t1: Module Ownership, Dependency Direction, and Feature Seams

## Scope

This artifact maps the existing TypeScript/Vite application and defines the smallest modularization boundary for t2. It is an implementation guide, not a feature inventory. It preserves the current DOM-rendering approach, singleton state shape, Firebase behavior, and public module entry points while making feature additions local and predictable.

## Evidence and Hypothesis

- `src/main.ts` owns bootstrap, auth-session teardown, tab routing, daily jobs, background NAV refresh, theme, offline UI, and direct feature rendering (`src/main.ts:109-603`).
- `src/lib/appState.ts` exposes one mutable `FireOSState`; seven feature entry points import it directly (`src/modules/calculators/index.ts:6`, `src/modules/calculators/tax/index.ts:1`, `src/modules/dashboard/index.ts:9`, `src/modules/esop/index.ts:1`, `src/modules/insurance/index.ts:5`, `src/modules/plan/index.ts:1`, `src/modules/profile/index.ts:6`).
- Feature persistence is mostly centralized through `persistPortfolioState`, but feature modules still own save timing and mutation (`src/modules/calculators/index.ts:296-313`, `src/modules/insurance/index.ts:128`, `src/modules/profile/index.ts:328-336`, `src/modules/esop/index.ts:64`).
- Feature-to-feature imports are the main extension hazard: dashboard imports plan, calculators, integrations, trackers, and UI (`src/modules/dashboard/index.ts:12-19`); profile imports dashboard (`src/modules/profile/index.ts:11`); plan imports dashboard and calculators (`src/modules/plan/index.ts:7-8`); ESOP imports dashboard KPI logic (`src/modules/esop/index.ts:4`).
- `src/lib/storage.ts` is the correct persistence boundary: it validates, scopes, serializes, and optionally queues cloud writes (`src/lib/storage.ts:50-212`).
- `src/modules/api/firestore.ts` is the correct remote-data adapter: Firestore document/holding representation is intentionally hidden there (`src/modules/api/firestore.ts:42-150`).

**Hypothesis:** New feature work is expensive because the shell and feature modules both know about lifecycle, state mutation, and sibling rendering. A thin application shell plus feature adapters can reduce each new feature to registration, a state slice, and an isolated module without changing existing storage or Firebase contracts.

**Cheap discriminating check:** search for new feature code importing `src/main.ts`, sibling feature folders, `appState`, or browser storage. Current results show no `main.ts` import and no feature importing raw `localStorage` except the tax planner's unrelated calculator preference, but multiple sibling imports and direct singleton access remain. The proposed boundary targets those observed edges.

## Current Ownership Map

| Area | Current owner | Stable responsibility | Coupling to address |
| --- | --- | --- | --- |
| Application shell | `src/main.ts` | DOM shell, auth session, tab navigation, background jobs, global UI listeners | Too many responsibilities; imports every feature and business operation |
| State model | `src/types/state.ts`, `src/types/portfolio.ts`, `src/types/api.ts`, `src/types/firebase.ts` | State shape, defaults, persisted-data validation, transport types | One broad state object means every feature can see every slice |
| State instance | `src/lib/appState.ts` | Process-local mutable state singleton | Feature modules reach through global import instead of receiving dependencies |
| Persistence | `src/lib/storage.ts` | Scoped local storage, validation, local-first writes, sync enqueue | Public API is good; callers decide mutation/save sequencing independently |
| Cloud adapter | `src/modules/api/firestore.ts` | Firestore state and MF holding documents, snapshots, batches | Located under generic API folder despite being a persistence adapter |
| External data | `src/modules/api/{mfapi,nifty,eurInr,esop}.ts`, `nifty-monitor.ts` | Fetch/cache/monitor external market data | API barrel mixes data clients with lifecycle initialization |
| Shared UI | `src/modules/ui/{Modal,Toast,index}.ts` | Modal/toast primitives and containers | Correct low-level dependency; should remain leaf dependency |
| Auth | `src/modules/auth/*` plus `AuthCoordinator` | Auth form behavior and Firebase auth operations | Session orchestration remains in shell, which is appropriate after extraction |
| Profile | `src/modules/profile/*` | Profile/holding editing and CAS import | Imports dashboard NAV fetch; should depend on an explicit market-data port |
| Dashboard | `src/modules/dashboard/*` | KPI read model and dashboard widgets | Imports plan, calculator, tracker, integration UI directly; should consume view/widget ports |
| Calculators | `src/modules/calculators/*` | Interactive calculations and tax/SWP tools | Owns UI and persistence; should depend on calculation/state ports, not shell |
| Plan | `src/modules/plan/*` | Planning read model, actions, milestones, history | Imports dashboard KPI and calculator scenario implementation |
| Insurance | `src/modules/insurance/index.ts` | Insurance gap form and persistence | Closest to a self-contained feature; useful migration template |
| ESOP | `src/modules/esop/index.ts` | ESOP valuation, triggers, external rates, persistence | Imports dashboard KPI and API leaf modules directly |
| Secondary features | `trackers`, `watchdog`, `integrations` | Expense, alerts, advisor integrations | Embedded as dashboard widgets; should expose render/widget contracts |
| Styling | `src/styles/*` plus per-feature `styles.css` | Tokens/layout/global styles and feature styles | Keep per-feature styles colocated; shell owns only global layout |

## Target Module Structure

```text
src/
  app/
    bootstrap.ts             # DOMContentLoaded and composition root
    shell.ts                 # nav, tab host, global theme/offline UI
    auth-session.ts          # auth -> scope -> hydrate -> sync -> teardown
    background-jobs.ts       # daily tasks and NAV refresh; receives ports
    feature-registry.ts      # feature descriptors and lazy/first-use initialization
  core/
    state/
      app-state.ts           # state store interface + current implementation adapter
      slices.ts               # feature-owned slice types/defaults (incremental)
    persistence/
      portfolio-repository.ts # facade over current storage + Firestore sync
    events/
      app-events.ts           # typed event names/payloads replacing stringly DOM events
    ui/
      ...                     # current Modal/Toast primitives moved or re-exported
    calculations/
      ...                     # pure shared calculations only
    types/
      ...                     # current public domain/transport types, re-exported first
  infrastructure/
    firebase/                 # current firebase.ts and Firestore adapter
    market-data/              # current API clients and monitor
    persistence/              # current storage/merge/sync implementations
  features/
    auth/
    profile/
    dashboard/
    calculators/
    plan/
    insurance/
    esop/
    trackers/
    watchdog/
    integrations/
```

The physical move is optional for t2. First establish import boundaries with compatibility re-exports, then move files only when no caller depends on the old path. Existing `src/modules/*` paths may remain as public compatibility barrels during the transition.

## Dependency Direction

Allowed direction:

```text
app shell / composition root
  -> feature public contracts
  -> core ports and shared pure utilities
  -> infrastructure adapters

feature UI + feature logic
  -> feature-owned types/state ports
  -> core UI, calculations, events, persistence ports
  -> infrastructure ports through core interfaces
```

Rules for t2 and future features:

1. `app/*` may import feature entry points and infrastructure composition code. Features must not import `app/*` or `main.ts`.
2. A feature may import `core/*`, its own files, and declared infrastructure ports. A feature must not import another feature's implementation file.
3. Cross-feature reuse goes through one of three seams: a pure function in `core`, a typed read-model/widget contract, or an application event. Do not solve it with a sibling import.
4. `appState` remains a compatibility implementation detail. New feature code receives `FeatureContext` (`state`, `repository`, `events`, `ui`) from the registry. Existing modules can be adapted behind the context before the singleton is removed.
5. Only the persistence adapter may call `localStorage`, `saveData`, or `queuePortfolioSave`. `persistPortfolioState` remains the compatibility facade until repository injection is complete.
6. Only market-data adapters may call `fetch` for NAV/Nifty/EUR/INR/ESOP prices. Feature code consumes typed methods such as `marketData.getNAV` and `marketData.getNifty`.
7. Shared calculations must stay pure: input state/read model in, result out; no DOM, singleton state, timers, or persistence.
8. UI primitives are leaf dependencies. `core/ui` may not import features; features may render widgets using UI primitives.
9. Feature CSS stays in its feature directory. Global tokens/layout remain the only cross-feature stylesheet dependency.

## Feature Extension Contract

Every new feature should add one descriptor and one implementation, then only touch state/schema files if it persists data.

```ts
export interface FeatureContext {
  state: FireOSState;
  portfolio: PortfolioRepository;
  marketData: MarketDataPort;
  events: AppEventBus;
  ui: UiPort;
}

export interface FeatureModule {
  id: string;
  label: string;
  mount: (container: HTMLElement, context: FeatureContext) => void | Promise<void>;
  unmount?: (container: HTMLElement, context: FeatureContext) => void | Promise<void>;
}
```

Required behavior:

- `id` is the stable tab/feature key; it is unique in the registry.
- `mount` owns only its container and listeners. It does not create global nav elements or install global timers.
- All mutations go through a feature service/reducer or an injected repository method, followed by one event or refresh request.
- `unmount` clears timers, subscriptions, and pending listeners created by the feature.
- A feature may expose pure read-model builders for other features, but not its DOM internals.
- A persisted feature must add a typed state slice, default, validator, normalization path, Firestore/rules representation if cloud-backed, and focused tests before registration.

## Concrete Seams for Existing Couplings

| Existing edge | Replacement seam | First implementation step |
| --- | --- | --- |
| `main.ts` directly initializes/render-switches every tab (`src/main.ts:340-426`) | `FeatureRegistry` of `FeatureModule` descriptors | Move current `if (target === ...)` branches into descriptors; preserve old init functions through adapters |
| Features import singleton `appState` | `FeatureContext.state` or a state-slice accessor | Add context adapter wrapping current singleton; migrate one self-contained feature first, preferably insurance |
| Features call `persistPortfolioState` | `PortfolioRepository.save` / `saveLocal` / `saveCloud` | Wrap current storage API; preserve `sync:false` and `awaitCloud:true` semantics |
| Dashboard imports plan/calculator/tracker/integration renderers | `DashboardWidget` contract with `id`, `render`, and optional `refresh` | Register widgets from composition root; dashboard consumes widget outputs, not feature paths |
| Profile imports `fetchSIPNAVs` from dashboard (`src/modules/profile/index.ts:11`) | `MarketDataPort` or `PortfolioValuationService` | Move NAV fetch loop out of dashboard into market-data service; both profile and dashboard call that port |
| Plan imports dashboard `totalNetWorth` and calculator `calculateFIAge` | `core/calculations` pure exports | Keep `totalNetWorth` and scenario calculation free of DOM; re-export from core, then update plan/dashboard |
| ESOP imports dashboard KPI (`src/modules/esop/index.ts:4`) | `PortfolioValuationReadModel` in core | Expose `totalNetWorth(state)` from core; ESOP no longer knows dashboard exists |
| Shell owns daily tasks and NAV refresh (`src/main.ts:508-603`) | `BackgroundJob` descriptors receiving context | Extract jobs into `app/background-jobs.ts`; jobs publish typed refresh events instead of querying DOM |
| String DOM events (`profileUpdated`, `syncStatusChanged`) | Typed `AppEventBus` | Keep DOM dispatch as an adapter during transition; feature code subscribes through typed event names |

## Incremental Implementation Order for t2

1. Add `FeatureContext`, `FeatureModule`, `FeatureRegistry`, and `PortfolioRepository` interfaces without moving existing files.
2. Build the registry adapter around current `init*Module`/`render*` functions; preserve tab IDs and lazy initialization.
3. Extract `main.ts` tab routing into the registry and leave auth/session behavior unchanged.
4. Migrate insurance as the pilot feature because it has no sibling imports and one persistence path.
5. Extract pure valuation/calculation APIs used by dashboard, plan, and ESOP; update those imports to `core/calculations`.
6. Introduce dashboard widget registration; migrate dashboard's plan/expense/advisor/rebalancing dependencies one at a time.
7. Move background jobs behind context ports, then migrate profile NAV refresh to `MarketDataPort`.
8. Only after tests pass, relocate files and add compatibility barrels. Do not combine physical moves with behavior changes.

## Migration Risks and Mitigations

| Severity | Risk | Mitigation |
| --- | --- | --- |
| HIGH | Registry extraction changes first-render/lazy-init order | Preserve `profile` as initially mounted; add a registry test for one mount per tab and repeat tab activation |
| HIGH | Context adapter accidentally creates a second state object | Context must reference the existing `appState` until all consumers migrate; assert object identity in tests |
| HIGH | Moving persistence changes local-first/cloud ordering | Repository delegates to current `persistPortfolioState`; preserve overload semantics and existing persistence tests |
| MEDIUM | Widget extraction causes duplicate listeners or timers | Require `unmount`; track cleanup in each widget adapter; test repeated mount/unmount |
| MEDIUM | Typed event replacement misses existing DOM listeners | Keep DOM event adapter and emit both paths during transition; remove string events only after search confirms no consumers |
| MEDIUM | State slice extraction breaks Firestore/rules shape | Keep `FireOSState` and persisted key list stable in first pass; schema changes are separate migrations |
| LOW | Physical folder move breaks external imports or tests | Add compatibility barrels and move one module at a time |

## Acceptance Checks for t2

- New feature can be added by creating a feature folder, exporting one `FeatureModule`, and registering it once; no `main.ts` branch is needed.
- No feature implementation imports `src/main.ts` or another feature implementation path.
- No feature implementation imports `localStorage`, `saveData`, or `queuePortfolioSave`.
- The first migrated feature receives context backed by the existing singleton; no duplicate state exists.
- Existing `npm run build` and focused `npm test` behavior remains unchanged.
- Existing tab IDs, auth session lifecycle, persistence scope, and Firestore envelope representation remain compatible.

## Upstream Artifacts Consumed

- None; this task had no dependency artifacts. Evidence came from `artifacts/project-profile.yaml`, `docs/ARCHITECTURE.md`, and source imports/implementations.

## Evidence Mapping

- None; no upstream contract was provided. Source evidence is mapped inline above by path and line.

## Test Results

- Command: static source/import inspection only; no source code was changed.
- Passed: architecture evidence checks completed.
- Failed: 0.
- Skipped: runtime/build tests belong to t2/t3 and were not required for this design-only artifact.