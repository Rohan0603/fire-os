# Master Implementation Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this spec task-by-task.

**Goal:** Implement all pending engineering follow-ups and product candidates from the codebase, moving from conditional triggers to working, testable features.

**Architecture:** This application is a personal FIRE (Financial Independence, Retire Early) planning tool with a React frontend, Cloudflare Workers backend, and Firestore database. It features AI-powered planning assistance, scenario comparison, and detailed portfolio management.

**Tech Stack:** React 19, TypeScript, Cloudflare Workers & R2, Firestore, Zod schemas, Tailwind CSS, ESLint, Prettier, Vitest

**Spec:** docs/master.md, docs/ui.md, docs/backend.md, docs/ai.md, with this master spec as the single source for pending work.

## Global Constraints

- Version floor: All code must be TypeScript with strict type checking
- Dependency limits: Use only what the codebase already includes (no new dependencies for trivial work)
- Naming: snake_case for files, camelCase for types/functions, PascalCase for components
- Platform: Browser client targeting Cloudflare Workers backend, Electron availability as needed
- Max line length: 100 characters
- No console.log in production (use proper logging)

## Review Focus

- **Input validation at trust boundaries:** All Firestore rules and API endpoints must validate input against Zod schemas
- **Error handling:** User-facing errors must be localized and provide actionable messages
- **Performance:** Large data operations (portfolio updates, scenario comparison) must be optimized for sub-second response
- **Data consistency:** Firestore writes must be atomic and handle concurrency correctly
- **Accessibility:** UI components must have ARIA labels and keyboard navigation

## Engineering Follow-ups

### Conditional Work: Start Only When Trigger Occurs

#### Firestore Portfolio Splitting

**Description:** Current portfolio data models approach 750 KB limit with measurable write contention, requiring horizontal scaling.

**Goal:** Split Firestore portfolio documents by type (holdings, transactions, metadata) with backward compatibility.

**Tech Stack:** Firestore Collections (portfolios, holdings, transactions), data migration scripts, migration path with rollback.

**Spec:** This work is triggered by:
- State approaching 750 KB document limit OR
- Measurable write contention during portfolio operations

**Requirements:**
- Keep current `portfolios` collection schema for backward compatibility
- Create new collections: `portfolios/holdings`, `portfolios/transactions`, `portfolios/metadata`
- Add migration script to transform existing data when trigger occurs
- Update all read/write operations to use new split structure
- Implement rollback path if split causes issues
- Maintain data consistency across all collections

#### Main.ts Extraction

**Description:** `src/main.ts` has grown unwieldy and would benefit from being split into independent sections.

**Goal:** Extract self-contained shell sections from `src/main.ts` into separate, testable modules.

**Tech Stack:** Node.js modules, module boundaries, CLI entry points.

**Requirements:**
- Identify logical sections in `src/main.ts` that change independently
- Each section must be testable as a standalone unit
- Maintain the same CLI interface
- Split only when sections have clear boundaries and independent change patterns
- Avoid splitting just to reduce file length - only split when beneficial

#### Aggregate Validation Command

**Description:** Currently running inconsistent subsets of checks (`lint`+`test`+`build`, sometimes `format:check`) without a single command.

**Goal:** Add `npm run check` that runs the fast gate in CI order (no emulator, browser, or server required).

**Tech Stack:** Node scripts, CI configuration, existing validation scripts.

**Requirements:**
- Implement `scripts/check.mjs` that runs: validation, lint, test, format:check
- Order: validation first (fast), then lint, then test, then format check
- Must not require emulators, browser, or server
- Should be usable locally and in CI
- Trigger for this work was observed with ad-hoc subsets

#### Diagnostic CLI / Test Utility

**Description:** Recurring manual tasks exist that could be covered by scripts.

**Goal:** Add diagnostic CLI or test utility only if a recurring manual task is uncovered by current scripts.

**Tech Stack:** Node scripts, CLI interfaces, test utilities.

**Requirements:**
- Audit existing recurring tasks: route metadata verification (`scripts/verify-routes.mjs`), HTTP response headers (`scripts/verify-http.mjs`), post-deploy smoke (`scripts/smoke-routes.mjs`), Firestore rules (`scripts/test-firestore-rules-emulator.mjs`), bundle cost (Vite output)
- If any manual step remains uncovered, implement it as a script
- Add the script to scripts directory with proper CLI interface
- No new script needed if everything is covered

#### Deep-Chat Bundle Cost Reassessment

**Description:** `deep-chat` bundle measured at 471 kB chunk (121 kB gzip), lazy-loaded on first Assistant tab open.

**Goal:** Keep lazy loading approach but verify performance metrics meet acceptable thresholds.

**Tech Stack:** Vite bundling, bundle analysis, lazy loading, performance monitoring.

**Requirements:**
- Measure deep-chat bundle size after each major change
- Keep lazy loading on first Assistant tab open
- Document performance impact if changes are needed
- No further work needed unless size exceeds thresholds

#### Rendering Library Assessment

**Description:** Current UI has 71 render/update functions and 32 `innerHTML` template sites across 7,556 lines of non-test UI.

**Goal:** Consider a rendering library only if stateful UI makes manual DOM updates a measured maintenance cost.

**Tech Stack:** DOM manipulation, rendering libraries, performance monitoring.

**Requirements:**
- Measure maintenance cost from manual DOM updates
- Identify templates using `innerHTML` that could benefit from a library
- Track number of render functions and `innerHTML` usage
- If cost is measurable and library-shaped, implement it
- Otherwise keep current nanostore + manual DOM approach

#### Assistant Capabilities Expansion

**Description:** Consider new Assistant capabilities (tool-calling, retrieval, model routing analytics) only when a concrete use case cannot be handled by current sanitized context and user-confirmed proposal flow.

**Goal:** Parked as of 2026-10-05 (DUNA-20), nothing built. Every use case examined fits existing flow.

**Tech Stack:** AI model integration, tool calling, retrieval systems, analytics.

**Requirements:**
- Decision: no new Assistant capabilities
- Keep current sanitized context and proposal flow
- History and NAV-staleness answers are small derived fields for `buildContextSummary`
- Proposal effect previews computed client-side from validated candidate
- "Refresh my data" button with Nifty refresh before each question
- Trigger: real unanswerable question → add bounded context field
- What-ifs after proposal card shows resulting values → spec read-only calculate tool
- Answer needing large data → spec retrieval tool
- 502/504 cluster or reported bad answer → add worker log line (model id, latency, status)
- Fund-level detail stays out until fund-level questions observed

## Product Candidates — Personal FIRE Workflow

### Make Portfolio Updates Easier to Verify After Import

**Description:** Explore a clear before/after summary for CAS imports and CSV/JSON restore, especially for holdings that are replaced rather than appended.

**Goal:** Add verification UI for portfolio imports showing what changed.

**Tech Stack:** Import components, change diff UI, data comparison utilities.

**Requirements:**
- Create import-summary component showing before/after for CAS imports
- Show holdings that are replaced vs appended during CSV/JSON restore
- Provide clear summary of changes for user confirmation
- Support undo/revert for major changes if needed
- Must work with existing import flow

### Make Data Freshness Actionable

**Description:** The dashboard trust panel now names stale NAV/FX sources and offers a "Refresh now" retry; the count also catches persisted entries that carry no status yet.

**Goal:** Keep current implementation but add missing "Refresh now" retry functionality.

**Tech Stack:** Data refresh components, retry mechanisms, status tracking.

**Requirements:**
- Implement "Refresh now" button in dashboard trust panel
- Name the stale NAV/FX sources clearly
- Provide retry for failed refresh attempts
- Count and track entries that carry no status yet
- Display actionable refresh status to users

### Improve Scenario Comparison

**Description:** Let users compare a small number of saved FIRE assumptions/results side by side; first validate that repeated comparisons are a real workflow.

**Goal:** Add side-by-side comparison UI for saved scenarios.

**Tech Stack:** Comparison components, scenario storage, UI for viewing differences.

**Requirements:**
- Identify which scenarios are compared (small number, e.g., 2-3)
- Create comparison UI showing assumptions and results side by side
- Show differences clearly between scenarios
- Validate comparison workflow with users
- Store comparison preferences per user

## Product Candidates — Broader-User Needs

### Explain the Effect of Assumptions Beside Results

**Description:** Surface the inputs and approximation behind key planning outputs so users can understand what changes a result.

**Goal:** Add assumption explanations beside calculation results.

**Tech Stack:** Assumption documentation, UI tooltips/explanations, calculation details.

**Requirements:**
- Identify key assumptions in calculations (e.g., inflation rate, return rate, tax rate)
- Surface these assumptions beside results (tooltips, side panels, inline)
- Show what happens when assumptions change
- Provide clear explanations for non-technical users
- Must work for all major calculation outputs

### Clarify Expense and Holding Semantics During Entry

**Description:** `annualExpenses` has different calculation interpretations and MF/SIP data can be counted in both maps. Determine the intended product behavior before changing calculations or persisted data.

**Goal:** Clarify expense and holding entry semantics with clear documentation.

**Tech Stack:** Documentation, input validation, user guidance.

**Requirements:**
- Document calculation interpretations for `annualExpenses`
- Clarify MF/SIP data counting in different contexts
- Add input validation with clear error messages
- Provide help text during entry
- Determine intended behavior before changing calculations

### Make Assistant Suggestions Easier to Assess

**Description:** Ensure each proposal shows the affected fields, resulting values, and relevant assumptions before confirmation; validate this with users who review suggested changes.

**Goal:** Enhance Assistant proposal UI to show full impact before confirmation.

**Tech Stack:** Proposal components, impact visualization, user validation testing.

**Requirements:**
- Show affected fields in Assistant proposals
- Display resulting values clearly
- Show relevant assumptions used
- Add confirmation UI that requires explicit user action
- Validate UI with users who review proposed changes
- Must work with existing proposal flow

## Completed Improvements

These have been implemented and should not be re-added:

- Removed unused Chart.js; dashboard charts use canvas
- Consolidated route metadata into `scripts/routes.mjs`
- Switched the shared modal to native `<dialog>`
- Added browser-native CSV export and displayed existing market-data freshness in the Assistant
- Measured `deep-chat` bundle cost (471 kB chunk) and lazy-loaded it on first Assistant tab open
- Dashboard trust panel names the stale NAV/FX sources and adds a "Refresh now" retry instead of only showing a count

## Execution

This spec covers all pending work across multiple independent subsystems:

1. **Data persistence**: Firestore splitting, import verification
2. **App architecture**: Main.ts extraction, validation scripts  
3. **AI integration**: Assistant capabilities (parked)
4. **UI enhancements**: Scenario comparison, assumptions display, proposal assessment, expense/holding semantics

Each subsystem can be implemented independently. For best results, break this into separate plans per subsystem, starting with those having clear triggers.