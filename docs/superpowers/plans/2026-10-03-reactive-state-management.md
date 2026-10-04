# Reactive State Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide reusable reactive UI status for portfolio saves, sync, active scope, and market refresh while preserving repository persistence and identity-scoped storage.

**Architecture:** Use Nanostores atoms for ephemeral UI signals, not `@nanostores/persistent`: portfolio persistence already enforces validation, guest/UID scoping, and Firestore synchronization, while persistent storage duplication would weaken that boundary. Keep `FeatureContext` and `PortfolioSession` as owners of domain state and use stores only for cross-module notifications/status that currently use DOM events.

**Tech Stack:** TypeScript, Nanostores, Vitest.

**Spec:** [FIRE OS Capability Expansion Design](../specs/2026-10-03-fire-os-capability-expansion-design.md), especially reactive cross-tab behavior.

## Global Constraints

- Preserve local-first writes, identity scope, queue/retry/flush semantics, and remote snapshot behavior.
- Do not mirror the entire portfolio into a second persistence system.
- Replace only `portfolioStateSaved` and `syncStatusChanged` signal flows initially; retain unrelated DOM events unless directly part of these flows.
- No framework adoption.

## Review Focus

- Guest save must still refresh active dashboard without a cloud write; pin in persistence/dashboard integration test.
- UID switch/teardown must unsubscribe old observers and prevent stale status updates; pin in portfolio session tests.
- Offline/pending/error/synced status transitions must render as before; pin in sync coordinator/session tests.
- Multiple rapid saves must not cause redundant synchronous dashboard renders; preserve animation-frame coalescing.
- Tests and components without a DOM must be able to observe/unsubscribe safely; pin store unit test.
- Account switch must clear scope-specific transient statuses and stale market refresh state; pin session test.
- Subscribers mounted/unmounted repeatedly must not leak callbacks; pin feature lifecycle test.

---

### Task 1: Reactive UI signal stores

**Files:**
- Modify: `package.json`, lockfile
- Create: `src/core/stores.ts`
- Modify: `src/lib/storage.ts`, `src/main.ts`, `src/app/auth-session-controller.ts`
- Test: `src/core/stores.test.ts`, `src/app/portfolio-session.test.ts`

**Interfaces:**
- Produce: typed stores for portfolio-save invalidation and sync status; subscriptions return Nanostores unsubscribe callbacks.
- Preserve `FeatureContext`, `PortfolioRepository`, and `SyncCoordinator` public contracts.

- [ ] Add store tests for save notifications, status values, and unsubscribe behavior.
- [ ] Run `npm test -- src/core/stores.test.ts src/app/portfolio-session.test.ts`; expected: new store tests fail before implementation.
- [ ] Add Nanostores atoms and migrate the existing two event producers/consumers, retaining requestAnimationFrame coalescing and teardown cleanup.
- [ ] Run persistence, session, coordinator, and feature-registry tests plus `npm run build`; expected: pass.

**Completion note:** Update `docs/master.md`, `docs/backend.md`, and `docs/ui.md`; explicitly document that durable portfolio persistence remains in repository/storage, not Nanostores persistent.

### Task 2: Scope and market status consumers

**Files:**
- Modify: `src/core/stores.ts`, `src/app/portfolio-session.ts`, `src/modules/dashboard/index.ts`
- Test: `src/app/portfolio-session.test.ts`, dashboard tests

**Interfaces:**
- Consumes: Task 1 typed save/sync stores.
- Produces: scope-aware active portfolio and market refresh status subscriptions; active UID remains owned by `PortfolioSession`.

- [ ] Test guest-to-user and user-to-user transitions, teardown cleanup, and market refresh success/failure status reset.
- [ ] Run focused lifecycle tests; expected: scope and market status cases fail before implementation.
- [ ] Publish transient status changes from existing session/market adapters and subscribe dashboard/UI surfaces with unsubscribe teardown.
- [ ] Run session, API, dashboard, persistence, and build checks; expected: pass with no stale identity status.

**Expanded completion note:** Update `docs/ui.md` to describe reactive status signals and retain existing repository/session ownership.
