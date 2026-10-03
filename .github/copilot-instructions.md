# FIRE OS Instructions

Follow the repository-wide instructions in [`AGENTS.md`](../AGENTS.md) for
planning, implementation, validation, and documentation updates. Treat
`docs/master.md` and the relevant area references under `docs/` as the current
project documentation; do not rely on removed or obsolete document paths.

## GitHub Copilot delegation

- Avoid spawning subagents or delegating work.
- If delegation is necessary, every spawned subagent must use model
  `GPT-5.6-Luna`. Do not silently substitute another model; if it is
  unavailable, report the blocker and ask how to proceed.
