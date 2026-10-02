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
- Production HTTP checks for routes, redirects, headers, and discovery files
- Playwright checks at desktop and approximately 380px wide

## Current implementation status

- Completed: explicit Nifty unavailable state, removed ETF/default/stale fallback branches, calculator provenance message, local pinned Chart.js and PDF.js assets, homepage metadata, canonical policy, report-only security headers, disclaimer and plaintext guest notice, planning-tools navigation label, expanded deploy gates, seven-route smoke script, owner state deletion, and related documentation/tests.
- Verified: production build and 53 unit tests pass; smoke script passes ESLint and Prettier.
- Blocked: full lint has 2,913 existing repository findings; Firestore emulator validation could not start because port 8082 is occupied.
- Remaining P0/P1: replace report-only CSP after browser review, add route-specific metadata assertions, make market-data provenance consistent across all APIs, add sync/privacy panel and completeness/freshness UI, complete browser accessibility/mobile pass, and decide whether public CORS proxies remain acceptable.
- Dependency risk: `npm audit --audit-level=high` reports 1 critical, 13 high, and 10 moderate vulnerabilities. Remediate through controlled dependency upgrades and rerun the audit.

## Product decisions required

- Whether manual Nifty input is acceptable for crash scenarios and how long it remains trusted.
- Whether authenticated users can delete all cloud portfolio state.
- Which external APIs are approved by the final CSP and privacy notice.