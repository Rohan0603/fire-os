# FIRE OS Audit Implementation Plan

**Source:** `audit.md` (2026-10-02)

## Goal

Make decision-driving financial outputs trustworthy, make imported data execution controlled, and make deployment and user-facing data state observable. Preserve guest-first behavior and existing route structure.

## Scope correction from product audit validation

Treat the external 53-idea audit as an idea bank, not evidence of missing features. FIRE OS is vanilla TypeScript with bounded local/Firestore state; React re-render and memoization work, Storage rules, MFA/passkeys, and Mint-style transaction aggregation are outside the current architecture. Do not add PAN, account, or policy identifiers merely to support those ideas.

Existing capabilities to verify in-browser before extending: XIRR and SIP analysis, benchmark/alpha tracking, target allocation and rebalancing, emergency runway, scenario modelling, goals, tax planning, JSON export/import, and net-worth history.

## Phase 1: Decision safety and provenance

1. Remove Gold ETF, expired-cache, and hardcoded Nifty fallbacks. `fetchNifty()` returns `null` when no fresh real value or explicit manual value is available.
2. Add focused tests for Yahoo success, proxy failure, unavailable data, cache expiry, and manual entry.
3. Show Nifty source, fetch time, cached/manual status, and unavailable guidance beside crash inputs. Do not run crash alerts from unavailable data.
4. Validate all callers and persisted Nifty data against the updated nullable contract.

## Phase 2: Controlled PDF import

1. Pin PDF.js as a local application asset and remove both external runtime script paths.
2. Configure the local worker from the same pinned asset.
3. Add parser tests for amount/date parsing, successful extraction, and malformed or unavailable PDF failures.

## Phase 3: Hosting and release gates

1. Add Firebase Hosting security headers: CSP reviewed against actual script/API dependencies, frame protection, referrer policy, and permissions policy.
2. Add homepage canonical and Open Graph metadata.
3. Expand `npm test` to discover every repository unit test, while retaining the rules emulator as its own gate.
4. Make deploy run the same quality checks as pull requests, then add route smoke checks after deployment for status, title, canonical, and discovery files.

## Phase 4: Privacy, retention, and product clarity

1. Add visible guest-storage, third-party-data, sync/offline, and financial-disclaimer status to the relevant UI states.
2. Decide whether cloud state deletion is intentionally prohibited. If deletion is required, add authenticated deletion rules, UI confirmation, and tests; otherwise document retention clearly.
3. Add completeness and freshness indicators for liabilities, holdings, market data, and imported CAS data.

## Phase 5: Accessibility and recurring review

1. Test keyboard navigation, modal focus management, labels, announcements, contrast, reduced motion, mobile overflow, tap targets, and empty/error/offline states.
2. Connect existing dashboard and plan signals into a recurring Financial Review view with `Inputs -> Assumptions -> Result -> Confidence -> Interpretation -> Next action`.
3. Add liabilities, net-worth attribution, employer-equity concentration, and correlated employment-risk analysis.

## Product roadmap after audit validation

### P0: trust and consistency

1. Finish provenance and freshness tags across every market and NAV result.
2. Add a cross-module contract test proving Dashboard, Plan, and other net-worth outputs use the same canonical calculation.
3. Add a backup last-export date and reminder without storing sensitive identifiers.

### P1: useful extensions that fit current architecture

1. Add bounded manual liabilities and include them in net worth, with authenticated rules and migration coverage.
2. Add net-worth attribution using existing history, contributions, and market values; separate money added from investment return.
3. Add a bounded last-N snapshot history with undo for local edits.
4. Add Coast FIRE as pure scenario math over existing profile, corpus, contributions, return, and inflation inputs.
5. Add employer/ESOP concentration as an informational exposure percentage.

### Deferred or rejected

- Defer transaction explorer, tags, global search, bank reconciliation, bank/broker imports, and high-volume transaction storage until IndexedDB plus Firestore subcollections are designed.
- Defer fund overlap and sector concentration until a reliable, approved holdings data source exists.
- Reject opaque financial-health scores, Lean/Fat/Barista labels, Sankey visualizations, speculative animation/theme work, and application-level encryption of identifiers.
- Verify current Indian tax rules from authoritative sources before tax-lot implementation.

## Acceptance gates

- `npm run build`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run test:rules:emulator`
- `npm run test:e2e`
- `npm run test:http` with `BASE_URL` set to deployed Hosting URL
- Production HTTP checks for routes, redirects, headers, and discovery files
- Playwright checks at desktop and approximately 380px wide

## Current implementation status

- Completed: explicit Nifty unavailable state and live/cache/manual provenance, generic currency module/file naming with pair-keyed caching and ISO 4217 validation, generic currency-rate persistence with legacy EUR/INR import support, bounded liabilities with canonical net-worth subtraction and Firestore allowlisting, net-worth attribution helper, Coast FIRE helper, ESOP concentration helper, dashboard sync/freshness panel, local backup export/reminder, basic profile completeness display, bounded local snapshot history with one-step undo, NAV and currency source/freshness metadata, authenticated-only CorsProxy market fallback, removed ETF/default/stale Nifty fallback branches, genuine SIP XIRR, canonical calculator net-worth wiring, local pinned Chart.js and PDF.js assets, homepage metadata and JSON-LD, generated route metadata assertions, canonical policy, enforced security headers, disclaimer and plaintext guest notice, planning-tools navigation label, expanded deploy gates, seven-route smoke script, HTTP/header verification script, owner state deletion, mobile E2E coverage, and related documentation/tests.
- Verified: production build, generated metadata for seven routes, 15 unit-test files (67 tests), 3 Playwright E2E tests, Firestore rules tests against the active emulator, full lint, and full format check.
- Known deployment gap: the live Hosting deployment does not yet expose the current security headers and homepage metadata; redeploy before treating `npm run test:http` as passed.
- Remaining P0/P1: finish module-by-module provenance presentation, complete controlled major-version dependency remediation, and redeploy before rerunning deployed `test:http`.
- Dependency risk: Firebase CLI patch upgrade and removal of unused `pdfjs-dist` reduced findings to 10 high and 4 moderate vulnerabilities. Remaining Firebase tooling transitive advisories require controlled upgrades.

## Product decisions required

- Whether manual Nifty input is acceptable for crash scenarios and how long it remains trusted.
- Authenticated users may delete all cloud portfolio state from Profile after confirmation; local browser data remains.
- Manual Nifty values are allowed only when live data is unavailable and are labeled `manual`; users should refresh them before relying on drawdown calculations.
- CorsProxy is the approved authenticated market-data fallback; direct provider or first-party backend replacement remains a future production hardening option.