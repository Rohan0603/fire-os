# FIRE OS Capability Expansion Design

## Goal

Use the proposed libraries as shared product capabilities—not isolated code substitutions—to expand FIRE OS planning, portfolio analytics, data portability, and cross-tab responsiveness while avoiding parallel custom implementations.

## User intent and success criteria

The user wants FIRE OS to make broader use of the proposed changes, including new useful planning and analytics functionality. Public market data may be obtained from the free APIs already used by FIRE OS. Success means the libraries support multiple real product workflows, existing local-first and trust boundaries remain intact, and new features reuse shared schemas, calculations, date helpers, charts, import parsing, and reactive updates.

## Current architecture

FIRE OS is a local-first vanilla TypeScript/Vite application. `FeatureContext` and the portfolio repository expose shared state and operations to tab modules. Validated state is stored in guest- or UID-scoped localStorage and synchronized to Firestore for authenticated users. Assistant proposals are checked in the browser and server-side request/proposal handling is shared by local Express and the Cloudflare Worker.

Market clients in `src/modules/api/` currently use MFAPI for NAV and Yahoo chart data through the existing corsproxy integration for Nifty, FX, and ESOP quotes. Adapters cache results and have varying fallbacks. Nifty fetch currently obtains a year of daily chart data to calculate the high but returns a summary; MFAPI NAV reads current-first data today. API response history, provider limits, cache size, and resilience must be verified before choosing retention or date-range behavior.

## Proposed capability architecture

Adopt the proposed libraries as shared foundations, with narrow interfaces at current module boundaries:

1. **Valibot schemas:** define persisted portfolio and import data contracts once for browser validation, backup/import diagnostics, and Assistant proposals. Keep Firestore rules independently authoritative for cloud authorization and shape restrictions. Keep request/prompt policy behavior in the proxy boundary.
2. **Financial calculations:** use a tested XIRR implementation for irregular dated cash flows, retain simple formulas where the app’s existing semantics are more specific, and expose reusable results to dashboard performance views and scenario comparison.
3. **Chart.js:** render portfolio composition and time-series analytics from domain outputs, not duplicate valuation math inside the chart layer.
4. **Nanostores:** publish reactive save, sync, active-scope, and market-refresh status to tab modules. The portfolio repository and scoped storage remain the durable source of truth; do not duplicate persisted portfolio state into `@nanostores/persistent`.
5. **PapaParse:** support both robust CSV export and CSV parsing for an import-preview workflow. Revalidate normalized imported values with the shared persisted-data schema before any write.
6. **date-fns:** centralize strict parsing, calendar arithmetic, period boundaries, and date-range calculations for planning, data series, and history. Preserve stored formats and explicitly preserve current UTC/local semantics where relied upon.

## Product capabilities in scope

### Portfolio backup restore and CSV import

- Add a JSON backup restore path alongside the existing JSON download. Parse into an isolated candidate, validate against the persisted-state schema, show useful validation errors and a preview, and require explicit confirmation before saving.
- Add CSV import alongside export. Parse using PapaParse, map recognized portfolio categories/columns, show row-level issues and a preview, and support explicit replace or merge behavior. Reject unknown or invalid records instead of silently dropping them.
- Reuse the existing portfolio repository for local-first writes and optional cloud sync. Do not import runtime auth/sync metadata or allow imports to bypass active identity scope.
- Continue formula-injection protection on export. Imported text remains data and must not be evaluated as formulas.

### Planning and performance calculations

- Add a reusable dated cash-flow return calculation for irregular contributions, withdrawals, and current portfolio value; use it in portfolio performance where input history is sufficient.
- Expand scenario comparison so users can compare a small set of assumptions (starting corpus, contribution, step-up, return, and goal) side-by-side using shared calculations. Keep assumptions visible and projections clearly labeled as estimates.
- Reuse date-range helpers for period-based performance, SIP holding periods, and planning horizons. Do not replace domain-specific tax/SWP rules with generic library defaults.

### Market-backed analytics

- Extend existing MFAPI and Yahoo chart adapters to expose validated historical series where those endpoints provide it; do not add a new provider for this scope.
- Normalize series and timestamps at the API boundary, reuse existing cache/status/fallback conventions, and bound retained history to the ranges actually needed by the UI.
- Use historical values to support portfolio/holding performance and Nifty benchmark comparison, with source, range, and data freshness visible. Where constituent history is unavailable, label portfolio history as available snapshots/estimated rather than presenting a synthetic actual history.
- Add interactive net-worth trend, allocation composition, and market/portfolio drawdown views. Derive net-worth series from stored snapshots; use fetched market histories for benchmark and market drawdown. Do not imply historical portfolio valuations where the app lacks historical holding quantities or values.
- Handle empty, partial, stale, and failed market data without blocking current-value dashboard functionality.

### Reactive cross-tab behavior

- Replace current save/sync DOM-event flows with typed reactive subscriptions and extend the same mechanism to market refresh and active portfolio scope status where useful.
- Preserve animation-frame coalescing and module teardown/unsubscribe behavior.
- Keep Firestore queueing, retry, offline behavior, and session generation/race protection in their existing owners.

### Date and calendar workflows

- Reuse strict date parsing and calendar arithmetic for import validation, history filtering, benchmark comparisons, tax/planning period boundaries, and existing recurring/daily tasks.
- Preserve `YYYY-MM`, `YYYY-MM-DD`, and ISO timestamp storage contracts.
- Keep user-visible timezone/calendar behavior explicit and test leap days, month/year boundaries, invalid dates, and UTC-vs-local transitions.

## Rollout and sequencing

Treat the work as six independent plans with shared interfaces coordinated in this order:

1. Schema foundation, including one persisted-data contract that import workflows and client-side Assistant proposal validation can reuse.
2. Date and financial calculation foundations, preserving current outputs before adding new period-based uses.
3. Market history adapter extension and cache contracts; validate API response and range limits before UI dependencies.
4. Reactive signal foundation for lifecycle-safe tab updates.
5. JSON/CSV import workflows using the schema, parser, date helpers, and existing repository.
6. Chart-backed analytics and scenario comparison consuming the shared data/calculation capabilities.

Plans may ship independently once their consumed interfaces exist. Keep dependency installation within the task that first uses each library. Every new user-facing workflow gets focused tests and documentation updates in its implementation task.

## Constraints and non-goals

- No new paid market-data provider; use existing free API integrations and disclose their availability/freshness limits.
- No broker trades, tax filing, or claims of audited investment returns.
- No second durable portfolio store and no weakening of guest/UID storage isolation.
- No fabricated historical portfolio series: market history is not equivalent to historical user holdings.
- No automatic import writes. Preview and user confirmation precede repository persistence.
- Do not change existing financial business rules merely to match a package default.
- Keep this as vanilla TypeScript/Vite; do not introduce a UI framework.

## Validation expectations

- Unit tests cover schema boundaries, date periods, financial return edge cases, CSV parsing/escaping, store subscriptions/teardown, and chart empty/stale states.
- Market adapter tests use captured/mock provider payloads and verify malformed/partial responses and cache fallback behavior.
- Import-flow tests prove invalid input leaves portfolio state unchanged and valid confirmed imports use repository persistence.
- Run `npm run lint`, `npm test`, `npm run build`, plus relevant server/Worker/rules and e2e checks when their boundaries change.
- Update `docs/master.md` and applicable detailed references as each behavior ships.
