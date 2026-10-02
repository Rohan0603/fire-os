# FIRE OS Website Audit

**Audit date:** 2026-10-02  
**Scope:** Public and guest experience; no sign-in, private-data access, or cloud writes.

## Evidence standard

- **Verified in repository:** confirmed from source, configuration, tests, or generated-build logic.
- **Observed by supplied live-site audit:** reported by the provided ChatGPT and Claude audits; not independently re-fetched here.
- **Documented:** stated in project documentation, but not necessarily exercised.
- **Inferred:** reasonable interpretation that still needs runtime evidence.
- **Unverified:** requires a production browser, HTTP, mobile, accessibility, or authenticated check.

Repository evidence is stronger than an unexecuted claim, but it cannot prove that the deployed site matches the current checkout.

## Executive assessment

FIRE OS has a strong local-first foundation: guest storage, UID-scoped cloud persistence, validated state, offline synchronization, route prerendering, Firestore validation, and a broad financial-planning model. The product opportunity is not another calculator. It is a clearer review loop that explains what changed, what is unreliable, and what the user should do next.

Highest-risk findings:

1. **Decision-driving Nifty fallback:** Yahoo/proxy failure can produce a Gold ETF-derived Nifty level and 52-week high, then stale cache or hardcoded defaults. This can influence crash-protocol outputs. **Verified in repository; high priority.**
2. **PDF.js supply-chain exposure:** PDF.js is versioned, but CAS parsing has a runtime fallback to another external CDN. CAS files contain sensitive holdings data. **Verified in repository; high priority.**
3. **Missing hosting security headers:** Firebase Hosting has a catch-all rewrite but no configured CSP, frame, referrer, or permissions policies. **Verified in repository; high priority.**
4. **Cloud deletion contradiction:** users can update their state but the state document cannot be deleted by any client. **Verified in repository; product decision required.**
5. **Weak data provenance UX:** the calculator displays a generic source string; freshness, fallback class, and timestamp are not clearly surfaced in the inspected code. **Verified/inferred.**

Do not treat functionality, visual design, mobile, accessibility, or production-readiness scores as measured. The supplied audits explicitly lacked complete interactive verification.

## Reconciliation of supplied audits

| Topic | Reconciled finding | Evidence |
|---|---|---|
| Static routes | Six public routes are prerendered with route-specific titles, descriptions, canonicals, Open Graph tags, and JSON-LD. | Verified in [scripts/prerender-routes.mjs](scripts/prerender-routes.mjs) |
| Homepage metadata | Source homepage has a generic description and title, but no homepage canonical or Open Graph tags. | Verified in [src/index.html](src/index.html) |
| CI | The claim that CI skips lint, unit tests, and E2E is false for the quality workflow. Deploy still runs only build and rules validation before deployment. | Verified in [.github/workflows/quality.yml](.github/workflows/quality.yml) and [.github/workflows/deploy.yml](.github/workflows/deploy.yml) |
| Unit-test scope | `npm test` runs an explicit subset, not every `*.test.ts` file. | Verified in [package.json](package.json) |
| PDF.js | Entry-point PDF.js is version-pinned on jsDelivr; runtime fallback is version-pinned on cdnjs, but remains third-party executable code. | Verified in [src/index.html](src/index.html) and [src/modules/profile/pdf-parser.ts](src/modules/profile/pdf-parser.ts) |
| Crawler files | `robots.txt`, `sitemap.xml`, and `llms.txt` exist in the repository. Their deployed availability remains unverified. | Verified in [public/robots.txt](public/robots.txt), [public/sitemap.xml](public/sitemap.xml), and [public/llms.txt](public/llms.txt) |
| Plan/action centre | Plan-related health, actions, milestones, cash flow, and history are present in prerendered route content. Calling a deeper action centre feature missing is unsupported without interactive testing. | Verified in [scripts/prerender-routes.mjs](scripts/prerender-routes.mjs) |
| Guest privacy | Guest mode and no guest Firestore writes are documented. Plaintext-storage and sync-state disclosure in the product UI remain incomplete or unverified. | Documented in [README.md](README.md) and [public/llms.txt](public/llms.txt) |
| Canonical slash behavior | The supplied audit reports a possible slash/redirect mismatch. Source generates slashless section canonicals, but production redirect behavior needs HTTP verification. | Source verified; deployment unverified |
| Live content | The supplied audits report useful static content on all seven URLs. This report does not independently re-fetch production. | Observed by supplied audits |

## Verified technical findings

### Market data and crash protocol

[src/modules/api/nifty.ts](src/modules/api/nifty.ts) does not call a direct NSE API. Its effective fallback chain is:

1. Yahoo Finance through public CORS proxies.
2. Gold ETF NAV multiplied into an estimated Nifty level and synthetic 52-week high.
3. Expired in-memory cache.
4. Hardcoded June 2026 defaults.

The source comments describe an NSE-first strategy, but the implementation attempts Yahoo first. The Gold ETF is not a defensible proxy for Nifty drawdown. A value labelled approximate can still look authoritative when it drives crash scenarios.

**Required direction:** return an explicit unavailable/manual state when a real Nifty value is unavailable. If an approximation is retained temporarily, block it from decision-driving crash alerts and display source class, timestamp, and warning beside every dependent result.

Focused tests currently cover proxy authentication behavior, but the unsafe ETF, expired-cache, and default branches need dedicated tests.

### PDF import

[src/index.html](src/index.html) loads `pdfjs-dist@3.11.174` from jsDelivr. [src/modules/profile/pdf-parser.ts](src/modules/profile/pdf-parser.ts) dynamically loads the same version from cdnjs when `window.pdfjsLib` is absent and configures a cdnjs worker.

Version pinning reduces accidental upgrades. It does not remove supply-chain or availability risk. The script processes CAS statements containing holdings and folio data.

**Required direction:** self-host PDF.js and its worker, or make one controlled local asset the only path. Add a parser test for successful extraction and failure handling.

### Hosting and security headers

[firebase.json](firebase.json) serves `dist` and rewrites all unmatched paths to `/index.html`. It has no hosting `headers` block.

Production should set, at minimum, a deliberate Content Security Policy, `frame-ancestors` or equivalent clickjacking protection, `Referrer-Policy`, and `Permissions-Policy`. Header choices must account for Firebase, Chart.js, PDF.js, Firebase Auth, and the configured API endpoints.

### CI and release gates

[.github/workflows/quality.yml](.github/workflows/quality.yml) runs build, lint, format checking, unit tests, Firestore emulator tests, and Playwright E2E.

[.github/workflows/deploy.yml](.github/workflows/deploy.yml) runs build and Firestore rules validation, then deploys. It does not run the quality workflow, production route smoke checks, or post-deploy checks.

[package.json](package.json) defines `npm test` as an explicit list. That list omits some repository tests, including the Nifty test, rules test, and other module tests. This is a test-discovery gap, not proof that the project has no tests.

### Firestore deletion

[firestore.rules](firestore.rules) allows an owner to create and update the portfolio state but explicitly denies deletion of the state document. Holding subdocuments can be deleted by their owner.

This is a valid data-retention choice only if made explicit. Otherwise it conflicts with a user expectation of “delete my cloud data.” The rules tests cover unauthenticated state deletion and holding permissions, but authenticated-owner state deletion should be tested to document the intended denial.

### Privacy and disclaimer communication

[README.md](README.md) documents guest storage, cloud sync, external APIs, plaintext browser storage, and a general financial disclaimer. [public/llms.txt](public/llms.txt) documents guest behavior and privacy at a high level.

The inspected static route shell does not visibly communicate plaintext local storage, third-party market-data requests, sync status, or a financial disclaimer. The crash panel renders a generic `Source:` value in [src/modules/calculators/index.ts](src/modules/calculators/index.ts), but does not visibly distinguish live, cached, approximate, default, or manual data.

## Product and UX review

### Strengths

- Guest-first local persistence reduces sign-in friction.
- Profile, dashboard, calculators, insurance, plan, and ESOP form a broad financial model.
- Plan content already points toward actions, milestones, health, cash flow, and history.
- CAS import with confirmation is a valuable workflow if privacy and parser reliability are clear.
- Real links and prerendered route content support crawlers and non-JavaScript discovery.

### Main risks

- Feature breadth can overwhelm first-time users.
- Precise-looking outputs can hide stale, incomplete, or synthetic inputs.
- “Calculators” understates the planner and simulator workflows.
- Net worth can be incomplete without explicit liabilities.
- Employer equity should feed concentration and correlated-employment-risk analysis.
- Users need visible saved-locally, syncing, offline, and error states.

### Recommended interaction model

For each important result, show:

`Inputs -> Assumptions -> Result -> Confidence/freshness -> Interpretation -> Next action`

Prioritize a recurring Financial Review view that gathers existing signals:

- portfolio allocation drift
- SIP status
- emergency runway
- insurance gap
- ESOP concentration
- tax opportunities
- FI progress
- milestones and next actions

Do not describe this as a missing feature until the rendered Plan and dashboard have been tested. The repository proves related copy and architecture, not the quality of the interactive workflow.

## SEO and crawler review

### Verified

- Route prerendering exists and generates route-specific descriptions.
- Section canonical, Open Graph, and JSON-LD metadata are generated.
- `robots.txt`, `sitemap.xml`, and `llms.txt` exist.
- Static route content includes real navigation links, headings, descriptions, feature lists, and guest-mode text.

### Gaps and checks

- Add homepage canonical and Open Graph metadata.
- Check heading hierarchy after prerendering; the repeated site label should not become a competing `h1`.
- Use `curl -I` against each production route to verify redirects and canonical alignment.
- Fetch production discovery files directly.
- Add a CI smoke check for HTTP 200, expected title, route heading, and absence of fatal JavaScript errors.

## Accessibility and mobile

Not verified by repository inspection or the supplied static audits:

- keyboard traversal and focus visibility
- modal focus trap, Escape handling, and focus return
- labels, validation, and error announcements
- screen-reader semantics
- color contrast and color-independent gain/loss indicators
- reduced-motion behavior
- mobile layout, table overflow, charts, tap targets, and empty/error states

Target WCAG 2.2 AA behavior. Test the modal and every data-entry path, not only the static shell.

## Prioritized roadmap

### Immediate

1. Remove Gold ETF and hardcoded Nifty fallbacks from crash decisions; require a real value or manual input.
2. Add data provenance, timestamp, and stale/unavailable states.
3. Add Firebase Hosting security headers and define the CSP against actual dependencies.
4. Remove the runtime PDF.js CDN fallback by self-hosting the pinned assets.
5. Add deploy-time route smoke checks and run the full quality gate before deploy.
6. Add homepage canonical/Open Graph metadata and visible disclaimer/plaintext-storage notice.

### Short term

1. Expose saved-locally, pending, offline, syncing, and error states.
2. Decide whether cloud state deletion is intentionally prohibited; implement a documented deletion path if required.
3. Add focused tests for Nifty fallback branches, metadata generation, PDF parsing, and authenticated state deletion policy.
4. Verify production redirects, headers, robots, sitemap, and llms files.

### Medium term

1. Add data completeness and freshness indicators.
2. Show assumptions and “why this number” explanations.
3. Connect Plan and Dashboard into a recurring Financial Review.
4. Add liabilities and net-worth change attribution.
5. Add employer-equity concentration and correlated-risk analysis.

### Later

- policy and contribution reminders
- scenario comparison
- historical assumption changes
- reports and exports
- household and document workflows

## Verification plan

Run repository checks:

```text
npm run build
npm run lint
npm run format:check
npm test
npm run test:rules:emulator
npm run test:e2e
```

Inspect generated `dist` HTML for every route: title, description, canonical, Open Graph tags, heading count, JSON-LD, navigation, and guest copy.

Run production checks with an HTTP client for route status, redirects, headers, and discovery files. Use Playwright at desktop and approximately 380px wide for keyboard, focus, modal, mobile, empty, failure, offline, and refresh flows.

## Bottom line

FIRE OS is technically more mature than its public explanation suggests. The central issue is trust at decision boundaries: market values must be real or clearly unavailable, imported data must use controlled code, and every financial conclusion must show freshness, assumptions, and confidence. Strengthen those boundaries before adding more tools.
