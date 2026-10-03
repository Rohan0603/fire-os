# FIRE OS agent instructions

## Before implementation

- Read `docs/master.md` before changing the project. Use it to understand the
  current architecture, behavior, and relevant workflows.
- Identify the scope, then read the corresponding reference(s): `docs/ui.md`
  for UI/features/calculations, `docs/backend.md` for persistence/APIs/deploy,
  and `docs/ai.md` for Assistant behavior. Read more than one when the change
  crosses areas. Read `docs/README.md` for setup or operational questions.
- Check the current source and tests; documentation is a map, not a substitute
  for verifying current behavior.
- Before editing, make a concise implementation plan: intended change, affected
  areas/files, and relevant validation. For small changes this can be a short
  checklist; for larger work, outline the steps before proceeding.

## Implementation and validation

- Follow existing TypeScript, Vite, ESLint, Prettier, Vitest, and Playwright
  conventions. Prefer focused changes that reuse existing helpers and module
  boundaries.
- Keep public types/APIs explicit, validate data at trust boundaries, and handle
  failure paths deliberately. Keep UI accessible and consistent with existing
  styles.
- Avoid unrelated refactors, speculative abstractions, new dependencies, and
  broad formatting churn.
- Add or update focused tests for non-trivial behavior and regressions. Run the
  narrowest relevant checks while developing; for shared or user-facing changes
  run `npm run lint`, `npm run test`, and `npm run build` before completion.
- Report checks that could not be run and why; do not claim unverified results.

## Documentation after implementation

- After implementing and validating a change, update `docs/master.md` whenever
  behavior, architecture, data contracts, workflows, configuration, or
  validation/deployment paths have changed. Keep it aligned with the code and
  remove or correct obsolete information encountered in the affected scope.
- Update the relevant detailed reference(s) (`docs/ui.md`, `docs/backend.md`,
  `docs/ai.md`) with new behavior and remove superseded details. Update
  `docs/README.md` for setup, operations, or navigation changes and
  `docs/CHANGELOG.md` when the change belongs in release history.
- Keep documentation focused: edit existing references instead of duplicating
  the same facts in new documents. If no documentation update is warranted,
  state why in the final response.

## Working constraints

- Preserve unrelated user changes; modify only files needed for the task.
- In the final response, summarize the implementation, documentation updated,
  and validation performed.
