# FIRE OS agent instructions

## Before implementation

- Read `docs/master.md` to understand the current architecture, behavior, and relevant workflows.
- Identify the scope, then read the corresponding reference(s):
  - `docs/ui.md` for UI/features/calculations
  - `docs/backend.md` for persistence/APIs/deploy
  - `docs/ai.md` for Assistant behavior
  - `docs/README.md` for setup or operational questions
  Read more than one when the change crosses areas.
- Check the current source and tests; documentation is a map, not a substitute
  for verifying current behavior.
- Before editing, make a concise implementation plan: intended change, affected
  areas/files, and relevant validation. For small changes this can be a short
  checklist; for larger work, outline the steps before proceeding.

## Implementation and validation

- Follow existing TypeScript, Vite, ESLint, Prettier, Vitest, and Playwright conventions.
  Prefer focused changes that reuse existing helpers and module boundaries.
- Keep public types/APIs explicit, validate data at trust boundaries, and handle
  failure paths deliberately. Keep UI accessible and consistent with existing styles.
- Avoid unrelated refactors, speculative abstractions, new dependencies, and
  broad formatting churn.
- **For shared or user-facing changes:** run `npm run lint && npm run format:check && npm run build` before completing any change.
- **For test changes:** `npm test` to verify unit test impact. For Playwright specs: `npm run test:e2e` to validate selector contracts.
- **Report checks that could not be run and why; do not claim unverified results.**

## PR / MR workflow

- Make small, focused commits with descriptive Conventional Commit messages (`feat:`, `fix:`, `refactor:`).
- **Before opening a PR:** ensure `npm run lint && npm run format:check && npm run build` pass and `npm test` passes.
- **For Playwright/e2e changes:** run `npm run test:e2e` on your branch before requesting review; any selector changes must preserve existing `id` and `data-testid` attributes listed in the design spec (§8 of `docs/master.md`).
- **For Cloudflare Worker changes:** update `worker/wrangler.toml` + secrets; run `npm run test:worker` to validate worker unit tests.
- Push to a topic branch (e.g., `ao/fire-os-2/assistant-cors-allowlist`); the orchestrator will open the PR or you may use the GitHub CLI if available.
- If a PR is not owned by any AO session, run `ao review trigger <session-id>` to start the native adversarial reviewer, then `ao review ls <session-id>` to inspect verdicts.

## Documentation after implementation

- After implementing and validating a change, update `docs/master.md` whenever behavior, architecture, data contracts, workflows, configuration, or validation/deployment paths have changed. Keep it aligned with the code and remove or correct obsolete information encountered in the affected scope.
- Update the relevant detailed reference(s) (`docs/ui.md`, `docs/backend.md`, `docs/ai.md`) with new behavior and remove superseded details. Update `docs/README.md` for setup, operations, or navigation changes and `docs/CHANGELOG.md` when the change belongs in release history.
- Keep documentation focused: edit existing references instead of duplicating the same facts in new documents. If no documentation update is warranted, state why in the final response.

## Issue onboarding for agents

- When starting a new task, first check existing sessions with `ao session ls --project fire-os`.
- If no suitable active worker exists, spawn a new AO worker with `ao spawn --project fire-os --name "<label>" --prompt "<clear task description>"`.
- Add `--agent <name>` when a worker must use a specific agent; add `--model <id>` when a specific model is requested (model access, credits, and cost may differ).
- Never claim a PR into the orchestrator session. If a PR needs continuation, assign or spawn a worker.
- For freeform work, publish only when the user requests it or explicitly configured project rules authorize it. Preserve the user's publishing scope (local-only, review-only, do-not-publish) when spawning or redirecting workers.

## Working constraints

- Preserve unrelated user changes; modify only files needed for the task.
- In the final response, summarize the implementation, documentation updated, and validation performed.

### Quick script reference (keep in chat)

| Goal | Command |
|------|---------|
| Fast local gate (no emulator/browser) | `npm run check` |
| Lint + format + build + unit tests | `npm run lint && npm run format:check && npm run build && npm test` |
| Run Playwright e2e | `npm run test:e2e` |
| Run worker tests | `npm run test:worker` |
| TypeScript check only | `npm run build` (tsc --noEmit) |
