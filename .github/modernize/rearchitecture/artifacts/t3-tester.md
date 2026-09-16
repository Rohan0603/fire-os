# t3 — Focused Module Boundary Regression Tests

## Summary
Canonical-suite regression coverage verifies the FeatureRegistry lifecycle contract, FeatureContext dependency identity, PortfolioRepository local-first behavior, and `awaitCloud` promise forwarding. The focused boundary suites also pass directly; tests remain in existing suites so `npm test` executes the canonical assertions without changing project configuration.

## Upstream Artifacts Consumed
- `.github/modernize/rearchitecture/artifacts/t2-frontend.md` — defined the FeatureRegistry, FeatureContext, PortfolioRepository, insurance compatibility, and expected follow-up coverage.

## Evidence Mapping
- `t2-frontend.md#Behavior Boundary` -> `src/lib/persistence.test.ts` verifies registry lifecycle dispatch, duplicate/unknown feature handling, injected dependency identity, repository persistence after cloud enqueue failure, and the `awaitCloud` adapter contract.
- `t2-frontend.md#Test Results` -> canonical `npm test`, focused boundary suites, build, lint, whitespace, and browser checks rerun after modularization.

## Test Results
- Command: `npm test`
- Passed: 22
- Failed: 0
- Skipped: 0
- Scope: 5 Vitest files, including the registry/context/repository assertions in `src/lib/persistence.test.ts`.
- Command: `npx vitest run src/app/feature-registry.test.ts src/core/persistence/portfolio-repository.test.ts`
- Passed: 6
- Failed: 0
- Skipped: 0
- Command: `npm run build`
- Passed: TypeScript and Vite build
- Failed: 0
- Skipped: 0
- Command: `npm run lint`
- Passed: lint completed with no errors or warnings
- Failed: 0
- Skipped: 0
- Command: `git diff --check`
- Passed: whitespace validation
- Failed: 0
- Skipped: 0
- Command: `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` with `E2E_EMAIL` and `E2E_PASSWORD` loaded in-process from `.env`
- Passed: 2
- Failed: 0
- Skipped: 0
- Scope: authentication shell and authenticated portfolio/dashboard flow; credential values were not printed or persisted.
- Command: default `npm run test:e2e`
- Not rerun in this pass; prior Windows diagnosis remains documented in t3.1: Playwright-managed Chromium fails before test execution with `spawn UNKNOWN`.

## Runtime Verdict
integration: PASS — 22 canonical Vitest tests pass; focused registry/repository suites pass 6 tests; build, lint, and whitespace checks pass.
e2e: PARTIAL — both authentication and authenticated portfolio flows pass with system Chrome and `.env` credentials; default managed Chromium remains blocked by Windows `spawn UNKNOWN`.
overall: NEEDS_SIGNOFF — module boundaries and existing behavior pass; default Playwright browser configuration still needs a working managed Chromium runtime.

## Findings
- No source behavior defects found by focused regression tests.
- E2E environment blocker: Playwright-managed Chromium process launch returns `spawn UNKNOWN` on the current Windows setup; system Chrome control launch passes.
- Authenticated E2E is verified through the existing system Chrome fallback with credentials loaded from `.env`; no credential values were exposed.

## Latest Verification
- Timestamp: `2026-09-16T18:02:51.9933291Z` start; validation completed after this run
- `npm test`: 22 passed, 0 failed
- Focused boundary Vitest suites: 6 passed, 0 failed
- `npm run build`: passed
- `npm run lint`: passed
- `git diff --check`: passed
- `npm run test:e2e` with `PLAYWRIGHT_CHANNEL=chrome` and `.env` credentials: 2 passed, 0 failed, 0 skipped
- Default `npm run test:e2e`: prior run recorded 0 passed, 2 failed before test execution because managed Chromium launch returned `spawn UNKNOWN`; Vite web server started successfully.
