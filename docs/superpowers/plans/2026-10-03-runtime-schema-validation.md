# Runtime Schema Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish Valibot schemas as reusable trust-boundary contracts for persisted state, Assistant proposals, and safe JSON backup restore.

**Architecture:** Define Valibot schemas at the TypeScript trust boundary and infer the persisted-data type from them. Keep the shared JavaScript Assistant policy as a JS-compatible adapter using Valibot's runtime API; do not make the browser import server policy. Existing normalization, Firestore authorization rules, and defaulting stay in their current owners.

**Tech Stack:** TypeScript, Valibot, Vitest, Firebase rules tests.

**Spec:** [FIRE OS Capability Expansion Design](../specs/2026-10-03-fire-os-capability-expansion-design.md), especially schema architecture and backup restore.

## Global Constraints

- Keep exact persisted keys and runtime-only exclusions aligned with `PERSISTED_STATE_KEYS` and `shared/assistant-policy.js`.
- Preserve current optional fields, finite-number constraints, collection limits, defaults, and proposal semantics.
- Client schema validation is not authorization; retain independent Firestore rules.
- Add Valibot as the only dependency for this migration.

## Review Focus

- Unknown top-level or nested keys must remain rejected; pin in the state-validator test.
- Missing optional fields and legacy partial persisted state must remain accepted and normalized; pin in the state-validator test.
- Non-finite numbers, oversized holdings/arrays, and malformed timestamps must remain rejected; pin in the state-validator test.
- Assistant request message alternation/size and proposal key allowlisting must remain unchanged; pin in shared policy tests.
- Firestore rules must continue rejecting unauthorized or malformed writes independent of client schemas; run rules tests.
- Invalid JSON restore must leave state and storage unchanged; pin in Profile import-flow tests.

---

### Task 1: Persisted portfolio schema

**Files:**
- Modify: `package.json`, lockfile
- Modify: `src/types/state.ts`
- Test: `src/types/state.test.ts`

**Interfaces:**
- Produces: `persistedPortfolioSchema`, `PersistedPortfolioData`, and compatible `isPersistedPortfolioData(value): value is Partial<FireOSState>`.
- Preserve `normalizePersistedState(value): FireOSState | null` and `isFireOSState(value): value is FireOSState` public APIs.

- [ ] Add tests for unknown nested keys, non-finite values, >50 liabilities, optional legacy fields, and successful normalized partial data.
- [ ] Run `npm test -- src/types/state.test.ts`; expected: new schema cases fail before implementation.
- [ ] Add Valibot and replace manual persisted nested guards with schemas matching existing behavior; infer persisted shape types where practical without changing public `FireOSState` structure.
- [ ] Run `npm test -- src/types/state.test.ts` and `npm run build`; expected: tests pass and types compile.

### Task 2: Assistant request/proposal validation

**Files:**
- Modify: `package.json` (only if Task 1 did not add dependency), lockfile
- Modify: `shared/assistant-policy.js`
- Test: `server/test/policy.test.js`, `server/test/server.test.js`, `worker/test/index.test.ts`
- Modify: `src/lib/assistant/sanitize.ts` only if it contains shape guards needed by the proposal scope

**Interfaces:**
- Consumes: Valibot runtime schemas for the Assistant request and extracted-change envelope. Keep `PERSISTED_ALLOWLIST` as the server's output projection; the client applies Task 1's complete persisted-state schema before any proposal is accepted.
- Preserve exports `validateAssistantRequest`, `extractProposedChanges`, `checkPromptPolicy`, and `PERSISTED_ALLOWLIST`.

- [ ] Add regression assertions for invalid message roles, body-size limit, runtime proposal keys, and unknown persisted top-level keys.
- [ ] Run `npm run test:server` and `npm run test:worker`; expected: new cases fail where validation is missing.
- [ ] Apply Valibot schemas to request and extracted-change envelope validation while retaining prompt regex policy, top-level allowlist projection, and current response error shapes.
- [ ] Run `npm run test:server`, `npm run test:worker`, `npm test`, `npm run test:rules`, and `npm run build`; expected: all pass.

**Completion note:** Update `docs/master.md`, `docs/backend.md`, and `docs/ai.md` to describe schema ownership and keep Firestore rules explicitly independent.

### Task 3: Validated JSON backup restore

**Files:**
- Modify: `src/modules/profile/index.ts`
- Create: `src/modules/profile/backup-import.ts`
- Test: `src/modules/profile/backup-import.test.ts`

**Interfaces:**
- Consumes: Task 1 `persistedPortfolioSchema` and Task 2-compatible persisted allowlist.
- Produces: `parsePortfolioBackup(text: string): { data: Partial<FireOSState> | null; issues: string[] }`.

- [ ] Test malformed JSON, invalid nested shape, runtime-only keys, valid partial backup, cancel/no-write, and confirmed repository save.
- [ ] Run `npm test -- src/modules/profile/backup-import.test.ts`; expected: import cases fail before implementation.
- [ ] Add backup file selection, validation summary, preview, and explicit confirmation; normalize candidate and persist through active `FeatureContext.portfolio` only after confirmation.
- [ ] Run focused tests, `npm test`, and `npm run build`; expected: pass and invalid/cancelled imports do not mutate state.

**Expanded completion note:** Also update `docs/ui.md` with the backup restore preview/confirm workflow and `docs/master.md` with the added state boundary.
