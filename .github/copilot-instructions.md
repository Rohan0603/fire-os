# FIRE OS Instructions

## Subagents

- Every spawned subagent MUST use model `GPT-5.6 Luna`.
- Never silently substitute another model. If `GPT-5.6 Luna` is unavailable, report the blocker and ask how to proceed.

## Coding Standards

- Preserve existing TypeScript, Vite, ESLint, Prettier, Vitest, and Playwright conventions.
- Prefer small, focused changes that reuse existing helpers and module boundaries.
- Keep public types and APIs explicit. Validate data at trust boundaries and handle failure paths deliberately.
- Avoid unrelated refactors, speculative abstractions, new dependencies, and broad formatting churn.
- Keep UI changes accessible, responsive, and consistent with existing styles.
- Add or update focused tests for non-trivial behavior and regressions.
- Run the narrowest relevant check during development. For shared or user-facing changes, run `npm run lint`, `npm run test`, and `npm run build` before completion.

## Documentation

- Before completing work, update relevant documentation when behavior, public APIs, configuration, architecture, workflows, or user-visible functionality changes.
- Prefer updating existing `docs/README.md`, `docs/QUICKSTART.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, or `docs/CHANGELOG.md` over creating duplicate guides.
- In the final response, state which documentation was updated or why no documentation change was needed.