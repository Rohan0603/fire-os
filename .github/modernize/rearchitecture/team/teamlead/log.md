## [t4] Modularization conformance audit
- Codebase/domain discoveries: registry/context/repository seams are healthy; insurance is the only feature migrated off singleton/storage imports. Remaining feature modules still use appState, persistPortfolioState, and sibling implementations.
- Wrong assumptions and corrections: `.env` values are not automatically available to Playwright test code; loading them into the process enabled the authenticated system-Chrome run. Default managed Chromium still fails before assertions with `spawn UNKNOWN`.
- Debugging dead-ends and what actually worked: execution-subagent output omitted command summaries, so direct read-only commands were used for auditable counts.
- Techniques/patterns worth reusing: treat build/unit/browser/runtime gates independently; report system Chrome as a documented fallback, never as proof that managed Chromium passes.
- Learnings consumed: none.

## [t4] Final conformance rerun after t4.1
- Codebase/domain discoveries: t4.1 removed all feature implementation references to appState, persistence facades, main.ts, and sibling implementation paths; only the explicitly deferred tax EPF preference reads/writes localStorage.
- Wrong assumptions and corrections: the prior modularization FAIL was stale after t4.1, but the browser environment blocker remains real and keeps the overall gate FAIL.
- Debugging dead-ends and what actually worked: direct source scans preserved line-level evidence; canonical tests, focused boundary suites, build, lint, and system Chrome E2E all passed.
- Techniques/patterns worth reusing: score modular conformance and browser environment readiness as separate gates; do not let a fallback browser pass erase a default-runtime failure.
- Learnings consumed: teamlead/modularization-conformance, frontend/feature-context-ports, frontend/feature-port-boundary.

## [t4] Final gate correction after canonical Windows E2E
- Codebase/domain discoveries: the current Playwright configuration selects installed system Chrome by default on Windows, so `npm run test:e2e -- --reporter=line` passes both browser journeys without an environment override.
- Wrong assumptions and corrections: the earlier t4 artifact retained stale managed-Chromium failure language; that failure is only an explicit `PLAYWRIGHT_CHANNEL=chromium` diagnostic path, not the canonical workflow.
- Debugging dead-ends and what actually worked: a PowerShell quoting attempt entered parser state; a literal PowerShell source scan confirmed no forbidden feature-boundary references and only the documented tax EPF preference uses localStorage.
- Techniques/patterns worth reusing: keep browser-channel selection and browser behavior as separate evidence; refresh the gate artifact after configuration changes and record low-severity formatting warnings separately from runtime failures.
- Learnings consumed: teamlead/modularization-conformance, frontend/feature-context-ports, frontend/feature-port-boundary.
