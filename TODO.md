# TODO and brainstorm

Engineering follow-ups are conditional; start them only when their trigger is
observed. Product ideas are candidates for discussion, not commitments.
Personal FIRE workflow and broader-user needs have equal weight; validate each
with actual use before promoting it to planned work.

## Engineering & maintenance

Conditional work: start only when the stated trigger occurs.

- [ ] **Decide whether to keep the local Express Assistant proxy.** Remove
  `server/` and its local-only dependencies if local proxy development/testing
  no longer provides value; production already uses the Cloudflare Worker.
- [ ] **Revisit Firestore portfolio splitting** if state approaches the 750 KB
  warning or write contention becomes measurable. Use the existing size metrics
  before adding more document boundaries.
- [ ] **Extract from `src/main.ts` only when a section changes independently**
  or would gain a useful test boundary. Avoid splitting it just to reduce file
  length.
- [ ] **Add an aggregate validation command only if contributors repeatedly run
  inconsistent subsets** of the existing checks.
- [ ] **Add a diagnostic CLI or new test utility only if a recurring manual task
  is not covered by the current scripts.**
- [ ] **Reassess `deep-chat` only if bundle cost is measured or it blocks a
  concrete UI requirement.** Keep it while it provides chat transcript and
  interaction behavior.
- [ ] **Consider a rendering library only if stateful UI makes manual DOM
  updates a measured maintenance cost.** Static templates using `innerHTML` do
  not justify one by themselves.
- [ ] **Consider new Assistant capabilities (tool-calling, retrieval, or model
  routing analytics) only when a concrete use case cannot be handled by the
  current sanitized context and user-confirmed proposal flow.**

## Product candidates — personal FIRE workflow

Ideas to evaluate against day-to-day use of the app:

- [ ] **Make portfolio updates easier to verify after import.** Explore a clear
  before/after summary for CAS imports and CSV/JSON restore, especially for
  holdings that are replaced rather than appended.
- [ ] **Make data freshness actionable.** Show which portfolio values are stale
  and what the user can do (refresh, enter a manual value, or leave it as-is),
  building on existing cache status and freshness indicators.
- [ ] **Improve scenario comparison.** Let users compare a small number of
  saved FIRE assumptions/results side by side; first validate that repeated
  comparisons are a real workflow.

## Product candidates — broader-user needs

Ideas to validate with people beyond the primary developer/user:

- [ ] **Explain the effect of assumptions beside results.** Surface the inputs
  and approximation behind key planning outputs so users can understand what
  changes a result.
- [ ] **Clarify expense and holding semantics during entry.** `annualExpenses`
  has different calculation interpretations and MF/SIP data can be counted in
  both maps. Determine the intended product behavior before changing
  calculations or persisted data.
- [ ] **Make Assistant suggestions easier to assess.** Ensure each proposal
  shows the affected fields, resulting values, and relevant assumptions before
  confirmation; validate this with users who review suggested changes.

## Completed improvements

- Removed unused Chart.js; dashboard charts use canvas.
- Consolidated route metadata into `scripts/routes.mjs`.
- Switched the shared modal to native `<dialog>`.
- Added browser-native CSV export and displayed existing market-data freshness
  in the Assistant; neither needs another dependency or service.

Avoid speculative framework, state-management, database, or AI-tooling
migrations without a concrete need.
