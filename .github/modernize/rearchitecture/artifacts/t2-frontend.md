# t2 — Frontend Modularization Implementation

## Summary

Added a compatibility-first feature registry and context/repository ports. The shell now mounts existing tab modules through one registry, and insurance is the first feature migrated off direct singleton and storage imports.

## Deliverables

- `src/app/feature-registry.ts` — typed `FeatureModule` contract with registration, duplicate-ID protection, mount, and optional unmount.
- `src/core/feature-context.ts` — `FeatureContext` carrying state and portfolio repository dependencies, defaulting to the existing singleton.
- `src/core/persistence/portfolio-repository.ts` — repository adapter preserving `loadData` and `persistPortfolioState` semantics.
- `src/modules/insurance/index.ts` — insurance rendering and saves now use injected context; legacy exports remain compatible.
- `src/main.ts` — existing profile, dashboard, calculators, insurance, plan, and ESOP tabs register through `FeatureRegistry`; tab routing no longer contains feature-specific branches.

## Behavior Boundary

- Existing `appState` identity remains the live state object.
- Existing local-first persistence and optional cloud-sync behavior remain delegated to `src/lib/storage.ts`.
- Existing tab IDs, lazy initialization behavior, and public module entry points remain unchanged.
- Remaining legacy feature imports of `appState` and `persistPortfolioState` are intentionally deferred for incremental migration.

## Upstream Artifacts Consumed

- `.github/modernize/rearchitecture/artifacts/t1-architect.md` — supplied the FeatureContext, FeatureRegistry, PortfolioRepository, compatibility-adapter, and insurance-pilot decisions.

## Evidence Mapping

- `t1-architect.md#Feature Extension Contract` -> `src/app/feature-registry.ts` and `src/core/feature-context.ts` implement typed module/context contracts.
- `t1-architect.md#Concrete Seams for Existing Couplings` -> `src/core/persistence/portfolio-repository.ts` wraps current storage APIs; insurance uses the wrapper.
- `t1-architect.md#Incremental Implementation Order for t2` -> registry adapter and insurance pilot completed without physical module moves.
- `t1-architect.md#Acceptance Checks for t2` -> shell registry routing, context-backed insurance, and compatibility validation are evidenced by build/tests below.

## Test Results

- Command: `npm run build`
- Passed: 1 build
- Failed: 0
- Skipped: 0
- Command: `npm test`
- Passed: 18 tests across 5 test files
- Failed: 0
- Skipped: 0
- Command: `npm run lint`
- Passed: lint completed with no failures
- Failed: 0
- Skipped: 0
- Command: `git diff --check`
- Passed: whitespace validation
- Failed: 0

## Follow-Up

The next safe increment is to add registry/context regression tests, then migrate one remaining feature at a time. The tax planner's standalone preference key remains outside portfolio persistence and should not be folded into this adapter without a separate decision.