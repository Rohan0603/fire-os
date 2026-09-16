## [t3] Focused module boundary regression tests
- Added registry/context/repository assertions to the existing canonical persistence suite so `npm test` includes them without config changes.
- `npm test` passed 21 tests; build, lint, and diff checks passed.
- Playwright Vite startup succeeded, but Chromium launch failed with `spawn UNKNOWN`; browser E2E remains unverified.
- Learnings consumed: none.

## [t3] Current verification
- Re-ran canonical checks at `2026-09-16T17:33:22.725Z`: 21 Vitest tests passed; build, lint, and diff checks passed.
- Re-ran Playwright: Vite started, but both browser tests failed before execution with Chromium `spawn UNKNOWN`.
- Code-style choice: kept boundary assertions in the explicit-path persistence suite so canonical `npm test` cannot omit them.
- Learnings consumed: [tester/canonical-regression-placement]

## [t3.1] Windows Chromium launch diagnosis
- Playwright 1.63 resolved Chromium revision 1243, but the managed Chromium/headless-shell executables were missing from the local cache.
- Both existing E2E tests failed before assertions with `browserType.launch: spawn UNKNOWN`; serialized execution ruled out parallel worker contention.
- Installed system Chrome launched successfully through Playwright, isolating the issue to the Playwright browser cache.
- Repair command is `npx playwright install chromium`; not run because tester charter prohibits downloading/installing infrastructure.
- Learnings consumed: [tester/canonical-regression-placement]

## [t3] Focused module boundary regression tests
- Added `awaitCloud` promise-forwarding coverage to the canonical persistence suite; `npm test` now passes 22 tests.
- Focused registry/context/repository suites pass 18 tests; build, lint, and diff checks pass.
- Playwright retry still fails both browser tests before assertions with managed Chromium `spawn UNKNOWN`; managed executable exists, while system Chrome launches successfully as a control.
- Learnings consumed: [tester/canonical-regression-placement, tester/playwright-cache-on-windows]

## [t3.1] Opt-in Windows system Chrome fallback
- Added `PLAYWRIGHT_CHANNEL=chrome` to the existing Playwright config; managed Chromium remains the default.
- `$env:PLAYWRIGHT_CHANNEL='chrome'; npm run test:e2e` passed 1 test and skipped 1 credential-gated test; no failures.
- `npm test` passed 22 tests; build, lint, and diff checks passed.
- Default `npm run test:e2e` still fails both tests with managed Chromium `spawn UNKNOWN`, confirming the environment-specific diagnosis.
- Learnings consumed: [tester/canonical-regression-placement, tester/playwright-cache-on-windows]

## [t3] Final focused regression verification
- Canonical `npm test` passed 22 tests; direct registry/repository boundary suites passed 6 tests.
- `npm run build`, `npm run lint`, and `git diff --check` passed.
- System Chrome E2E passed the auth shell and skipped authenticated flow because credentials are unset; default managed Chromium still fails before execution with `spawn UNKNOWN`.
- Learnings consumed: [tester/canonical-regression-placement, tester/playwright-cache-on-windows]

## [t3] Credential retry and final validation
- `.env` contains Firebase client configuration only; no `E2E_EMAIL` or `E2E_PASSWORD` values exist in repository test files or environment keys.
- Focused registry/context/repository suites passed 18 tests; canonical `npm test` passed 27 tests; build, lint, and whitespace checks passed.
- System Chrome E2E passed the authentication shell and skipped the authenticated portfolio flow because no credentials were available. No credential was invented or hard-coded.
- Learnings consumed: [tester/canonical-regression-placement, tester/playwright-cache-on-windows]

## [t3] Credential retry with `.env`
- `.env` now provides non-empty `E2E_EMAIL` and `E2E_PASSWORD`; values were loaded only in-process and never printed or persisted.
- Canonical `npm test` passed 22 tests; direct registry/repository suites passed 6 tests; build, lint, and whitespace checks passed.
- System Chrome E2E passed both authentication shell and authenticated portfolio/dashboard flows: 2 passed, 0 failed, 0 skipped.
- Default managed Chromium remains an environment blocker with `spawn UNKNOWN`; system Chrome fallback is the verified browser path.
- Learnings consumed: [tester/canonical-regression-placement, tester/playwright-cache-on-windows]

## [t3.1] Default Windows E2E repair
- Changed only `playwright.config.ts`: Windows now defaults to installed system Chrome; `PLAYWRIGHT_CHANNEL=chromium` preserves managed-browser diagnosis.
- Canonical `npm run test:e2e` passed 1 test and skipped 1 credential-gated test; browser assertions executed successfully.
- Explicit managed Chromium override reproduced 2 pre-assertion `spawn UNKNOWN` failures, confirming the environment diagnosis.
- Canonical `npm test` passed 22 tests; build, lint, whitespace, and config diagnostics passed.
- Learnings consumed: [tester/canonical-regression-placement, tester/playwright-cache-on-windows]

## [t3.1] Repository dotenv loading and final Windows verification
- Added a config-only loader for `E2E_EMAIL` and `E2E_PASSWORD` in `playwright.config.ts`; explicit process variables remain authoritative and values are never logged.
- With both E2E variables removed from the shell, canonical `npm run test:e2e` passed both authentication and authenticated portfolio/dashboard flows: 2 passed, 0 failed, 0 skipped.
- Managed Chromium override still fails before assertions: 0 passed, 2 failed with `spawn UNKNOWN` for the cached `chrome-headless-shell.exe`; default Windows system Chrome path passes.
- `npm test` passed 22 tests; build, lint, whitespace, and config diagnostics passed.
- Learnings consumed: [tester/canonical-regression-placement, tester/playwright-cache-on-windows]
