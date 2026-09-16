# t4 — Modularization Conformance, Build Health, and Extension Workflow

## Verdict

**PASS — overall quality gate.** Modularization conformance, application build/unit/lint checks, focused boundary tests, and the canonical browser workflow all pass. On Windows, Playwright defaults to the installed system Chrome channel; managed Chromium remains an explicit diagnostic override only.

Build and regression health pass. System Chrome with `.env` credentials passes both browser journeys; no application or browser-gate failure remains in the canonical Windows workflow.

## Scope and Evidence

- Source scope: `src/app`, `src/core`, `src/main.ts`, `src/modules`, `e2e`, `playwright.config.ts`.
- Verification rerun: task started `2026-09-16T18:41:57.3834367Z`; canonical browser and conformance gates completed during this task.
- Required upstream artifacts consumed:
  - `.github/modernize/rearchitecture/artifacts/t1-architect.md`
  - `.github/modernize/rearchitecture/artifacts/t2-frontend.md`
  - `.github/modernize/rearchitecture/artifacts/t3-tester.md`
  - `.github/modernize/rearchitecture/artifacts/t3.1-tester.md`
  - `.github/modernize/rearchitecture/artifacts/t4.1-frontend.md`
  - `.github/modernize/rearchitecture/learnings/teamlead/modularization-conformance.md`
  - `.github/modernize/rearchitecture/learnings/frontend/feature-context-ports.md`
  - `.github/modernize/rearchitecture/learnings/frontend/feature-port-boundary.md`
- Shared `context.md` was absent at task start; teamlead `log.md` was present and updated with this rerun. No evidence was inferred from the missing context file.

## Gate Results

| Gate | Verdict | Evidence |
| --- | --- | --- |
| TypeScript/Vite build | PASS | `npm run build` completed TypeScript check and Vite production build; 85 modules transformed. |
| Canonical regression suite | PASS | `npm test`: 5 files, 22 tests passed, 0 failed. |
| Modular boundary suite | PASS | `npx vitest run src/app/feature-registry.test.ts src/core/persistence/portfolio-repository.test.ts`: 2 files, 6 tests passed, 0 failed. |
| Lint and whitespace | PASS | `npm run lint` exited successfully; `git diff --check` exited successfully with only a CRLF normalization warning for `playwright.config.ts`. |
| Authenticated browser behavior via system Chrome | PASS | `npm run test:e2e -- --reporter=line`: 2 passed, 0 failed, 0 skipped with no channel override. The Windows config selects system Chrome by default; credential values were not printed or persisted. |
| Default browser runtime | PASS | The canonical command passes through the configured Windows default. Managed Chromium remains available only through explicit `PLAYWRIGHT_CHANNEL=chromium` diagnostics. |
| Registry/context implementation | PASS | `FeatureRegistry` has duplicate-ID protection, lookup, mount, and optional unmount; `FeatureContext` preserves current `appState` identity and injects `PortfolioRepository`. |
| Full feature-boundary conformance | PASS | Current source scan finds no feature implementation references to `src/main`, `appState`, persistence facades, or sibling implementation imports. |

## Modularization Completeness

### Passing requirements

- `src/main.ts` registers the six current feature descriptors once and tab routing calls `featureRegistry.mount(...)` instead of maintaining feature-specific routing branches.
- Every mounted feature receives the same `FeatureContext` instance; `createFeatureContext` preserves the live `appState` identity and injects repository, ports, and event bus dependencies.
- Feature modules consume shared calculations, UI, widgets, market data, and persistence through context ports/adapters.
- No feature implementation imports `src/main.ts`, the global singleton, persistence implementation functions, or another feature implementation.
- The only remaining direct `localStorage` use is the explicitly deferred standalone EPF calculator preference in `src/modules/calculators/tax/index.ts`; it is not portfolio persistence.
- Registry duplicate-ID, unknown-ID, mount, unmount, context identity, and repository semantics are covered by focused tests.

### Incremental limitation, not a conformance defect

- A new feature still requires one import and one descriptor registration in `src/main.ts`, which remains the composition root. It does not require a new routing branch.
- The compatibility adapter `src/core/feature-ports.ts` may import legacy implementation files internally; feature code sees only typed ports. Physical relocation remains intentionally deferred.

## Future Feature-Extension Workflow

A new feature can be introduced safely today by:

1. Add `src/modules/<feature>/index.ts` and colocated styles/tests.
2. Export a descriptor-shaped module with a stable unique `id`, user-facing `label`, `mount`, and optional `unmount`.
3. Register the descriptor once in the composition root (`src/main.ts`); do not add a new tab-routing branch.
4. Use `FeatureContext` for state and portfolio persistence; do not import `appState` or `src/lib/storage` in the new module.
5. Keep timers/listeners owned by the feature and release them from `unmount`.
6. Add a typed state slice/default/validator and persistence representation only when the feature stores data.
7. Add focused registry/context/repository tests and ensure they run through canonical `npm test`.
8. Run `npm test`, the focused boundary suites, `npm run build`, `npm run lint`, and the applicable Playwright flow.

This workflow is **usable for new isolated features** and was exercised by the insurance pilot. Existing feature modules now conform to the same boundary; physical file relocation remains intentionally deferred.

## Required Remediation

- None for this gate. The Windows Playwright configuration now makes the verified system Chrome channel the canonical default; `PLAYWRIGHT_CHANNEL=chromium` remains an optional diagnostic path for environments that need managed Chromium.

## Test Results

- Command: `npm test`
  - Passed: 22
  - Failed: 0
  - Skipped: 0
- Command: `npx vitest run src/app/feature-registry.test.ts src/core/persistence/portfolio-repository.test.ts`
  - Passed: 6
  - Failed: 0
  - Skipped: 0
- Command: `npm run build`
  - Passed: 1 production build
  - Failed: 0
  - Skipped: 0
- Command: `npm run lint`
  - Passed: 1 lint run
  - Failed: 0
  - Skipped: 0
- Command: `git diff --check`
  - Passed: whitespace check
  - Failed: 0
  - Skipped: 0
- Command: `npm run test:e2e -- --reporter=line`
  - Passed: 2
  - Failed: 0
  - Skipped: 0
  - Scope: authentication shell and authenticated portfolio/dashboard flow; `.env` credentials were loaded in-process by the Playwright config.
- Command: `npm run format:check`
  - Passed: 0
  - Failed: 1 non-blocking formatting check
  - Skipped: 0
  - Details: existing generated `project-profile.yaml` and modified `playwright.config.ts` differ from Prettier output; no runtime or source-boundary defect.

## Upstream Artifacts Consumed

- `t1-architect.md` — supplied dependency rules, feature contract, acceptance checks, and incremental migration order.
- `t2-frontend.md` — supplied implemented registry/context/repository boundary, insurance pilot scope, and deferred legacy imports.
- `t3-tester.md` — supplied canonical regression and system Chrome E2E evidence.
- `t3.1-tester.md` — supplied the reproduced managed Chromium blocker and fallback configuration.
- `t4.1-frontend.md` — supplied the completed feature migration and typed port boundary evidence.
- `teamlead/modularization-conformance.md`, `frontend/feature-context-ports.md`, `frontend/feature-port-boundary.md` — supplied prior gate and migration learnings.

## Evidence Mapping

- `t1-architect.md#Dependency Direction` and `#Feature Extension Contract` -> current source scan, registry/context inspection, and extension workflow.
- `t1-architect.md#Acceptance Checks for t2` -> gate table verifies routing, context, compatibility, build, and test behavior; current boundary scan passes.
- `t2-frontend.md#Behavior Boundary` and `#Follow-Up` -> confirms singleton/persistence compatibility and the insurance migration pattern.
- `t3-tester.md#Test Results` -> current canonical, focused, build, lint, and system Chrome results rerun and confirmed.
- `t3.1-tester.md#Diagnostics` and `#Findings` -> prior managed-Chromium `spawn UNKNOWN` diagnosis explains the explicit override; current Windows default uses the passing system Chrome path.
- `t4.1-frontend.md#Residual Scope` -> current scan confirms only the documented tax EPF preference remains outside portfolio persistence.

## Findings

- 0 HIGH findings.
- 0 CRITICAL application defects found.
- 0 modular-boundary violations found in feature implementations.
- 0 build, lint, unit-test, focused boundary-test, or canonical browser assertion failures found.
- 1 LOW formatting hygiene issue: Prettier reports the generated `project-profile.yaml` and current `playwright.config.ts`; this does not block conformance or runtime verification.
