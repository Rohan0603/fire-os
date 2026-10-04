# Market History Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend FIRE OS’s existing free MFAPI and Yahoo chart integrations to expose normalized historical series for market-backed analytics.

**Architecture:** Extend the current API adapters and persisted cache contracts only where the existing free endpoints provide usable history. Return bounded, validated time series with source/freshness metadata; retain the current spot-value interfaces and fallback behavior for existing consumers. Do not infer historical user holdings or add another provider.

**Tech Stack:** TypeScript, existing `fetch`/corsproxy integration, Vitest, existing localStorage/Firestore contracts.

**Spec:** [FIRE OS Capability Expansion Design](../specs/2026-10-03-fire-os-capability-expansion-design.md), especially market-backed analytics.

## Global Constraints

- No new paid market-data provider; use existing free API integrations and disclose their availability/freshness limits.
- Validate provider response shape, finite positive values, dates, and bounded series before caching.
- No fabricated historical portfolio series: market history is not equivalent to historical user holdings.
- Keep current spot/NAV API behavior compatible for current consumers.
- Preserve identity scoping and avoid unbounded cache/document growth.

## Review Focus

- Empty or malformed provider history must not erase a valid current cache; test adapter fallback.
- Duplicate or out-of-order provider timestamps must normalize deterministically; test series parser.
- Sparse or partial provider history must remain explicitly sparse; do not interpolate market observations as actual data.
- Requests exceeding supported/available periods must return a deliberate bounded/error result; test request validation.
- Oversized series must be capped without exceeding Firestore/local storage bounds; test retention policy.

---

### Task 1: Normalize provider history

**Files:**
- Modify: `src/modules/api/nifty.ts`, `src/modules/api/mfapi.ts`
- Modify: `src/types/api.ts`
- Tests: `src/modules/api/nifty.test.ts`, `src/modules/api/mfapi.test.ts`

**Interfaces:**
- Produce: `HistoricalDataPoint { date: string; value: number }` and `HistoricalSeries { points: HistoricalDataPoint[]; source: string; fetchedAt: string; status: 'live' | 'cache-fresh' | 'stale' | 'manual' }`.
- Preserve `fetchNifty()` and `fetchNAV(code)` existing return contracts; add `fetchNiftyHistory(range?: { start: string; end: string }): Promise<HistoricalSeries | null>` and `fetchNAVHistory(schemeCode: string, range?: { start: string; end: string }): Promise<HistoricalSeries | null>`.

- [ ] Add fixture-backed tests for provider payload ordering, malformed entries, duplicate dates, empty arrays, and current-value compatibility.
- [ ] Run `npm test -- src/modules/api/nifty.test.ts src/modules/api/mfapi.test.ts`; expected: history parsing cases fail before implementation.
- [ ] Inspect actual existing endpoint payloads from project fixtures/docs and add history methods bounded to provider-supported ranges; normalize dates/values and retain current fallback behavior.
- [ ] Run focused adapter tests and `npm run build`; expected: pass.

### Task 2: Bounded cache and history port

**Files:**
- Modify: `src/types/state.ts`, `src/lib/storage.ts`, `src/modules/api/index.ts`, `src/core/feature-ports.ts`
- Tests: state/storage/API tests

**Interfaces:**
- Consumes: Task 1 `HistoricalSeries`.
- Produces: `FeaturePorts.marketData.fetchNiftyHistory(range?)` and `FeaturePorts.marketData.fetchNAVHistory(schemeCode, range?)`, matching Task 1 signatures; cached history has a documented maximum point count and TTL.

- [ ] Test cache hydrate, stale status, per-series point cap, malformed persisted history, and scoped restore/reset.
- [ ] Run focused tests; expected: bounded-history contract tests fail before implementation.
- [ ] Add minimal bounded history cache and feature-port forwarding, checking serialized payload metrics and preserving UID/session race guards.
- [ ] Run `npm test`, `npm run test:rules`, and `npm run build`; expected: pass without exceeding persistence payload ceiling.

**Expanded completion note:** Update `docs/master.md` and `docs/backend.md` with provider-supported series, limits, fallback, and persistence size behavior.
