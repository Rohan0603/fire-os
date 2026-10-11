/**
 * Forward migrations for persisted portfolio data.
 *
 * Older payloads (local storage, JSON backups, Firestore envelopes) stored a
 * single hard-coded goal as four scalar `coorg*` fields and a fixed set of ESOP
 * `esopDetails.triggers` booleans. The current shape stores a general `goals`
 * list and a general `liquidationRules` list. `migratePersistedData` rewrites
 * any old payload into the new shape so reads stay liberal while writes stay
 * strict; it is idempotent, so it is safe to run on already-current data.
 *
 * It also assigns a generic `bucketId` to holdings that predate the fund-bucket
 * model, and drops the legacy owner-keyed `watchdogRules` object (it had no UI
 * and only ever held defaults) so the generic rules array can take its place.
 *
 * This module is intentionally shape-agnostic (plain records; its one import is
 * the pure classifier, which imports only types) to avoid an import cycle with
 * the state module that consumes it.
 */

import { classifyFundName } from './fundMatcher';

const LEGACY_COORG_KEYS = ['coorgCorpus', 'coorgStartDate', 'coorgTarget', 'coorgMonthlyAmount'] as const;

/**
 * Default allocation cap applied when migrating a legacy goal trigger. The old
 * `coorgConstruction` boolean carried no amount, so this generic fallback fills
 * the gap; it is a product default, not user data.
 */
const LEGACY_GOAL_ALLOCATION = 500000;

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Map the four legacy coorg scalars onto a single general goal, losslessly. */
function goalFromLegacy(data: Json): Json | null {
  const hasLegacyGoal = LEGACY_COORG_KEYS.some((key) => key in data);
  if (!hasLegacyGoal) return null;
  return {
    id: 'goal-home',
    name: 'Home',
    kind: 'home',
    targetToday: finite(data.coorgTarget) ?? 0,
    targetDate: stringValue(data.coorgStartDate) ?? '',
    inflation: 'cpi',
    linkedAssetIds: [],
    currentAmount: finite(data.coorgCorpus) ?? 0,
    monthlyContribution: finite(data.coorgMonthlyAmount) ?? 0,
    priority: 1,
    riskBucket: 'medium',
  };
}

/** Convert the legacy `esopDetails.triggers` booleans into general rules. */
function rulesFromLegacyTriggers(triggers: Json, goal: Json | null): Json[] {
  const active = (key: string): boolean => triggers[key] === true;
  const rules: Json[] = [
    { id: 'marriage', kind: 'marriage', label: 'Marriage Plan', active: active('marriage') },
    { id: 'childBirth', kind: 'childBirth', label: 'Child Birth', active: active('childBirth') },
    { id: 'jobChange', kind: 'jobChange', label: 'Employment Change', active: active('jobChange') },
  ];
  if (goal) {
    rules.push({
      id: 'goal-home',
      kind: 'goal',
      label: stringValue(goal.name) ?? 'Goal',
      active: active('coorgConstruction'),
      goalId: goal.id,
      allocateAmount: LEGACY_GOAL_ALLOCATION,
    });
  }
  return rules;
}

/** Assign a generic default bucket to any holding that predates the bucket model. */
function assignBuckets(map: unknown): unknown {
  if (!isRecord(map)) return map;
  const next: Json = { ...map };
  for (const key of Object.keys(next)) {
    const fund = next[key];
    if (isRecord(fund) && !('bucketId' in fund)) {
      next[key] = { ...fund, bucketId: classifyFundName(stringValue(fund.name) ?? '') };
    }
  }
  return next;
}

/**
 * Rewrite a persisted data payload into the current shape. Returns the input
 * unchanged when it is not a record; otherwise returns a shallow copy with the
 * legacy keys removed. Already-migrated data passes through untouched.
 */
export function migratePersistedData(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const data: Json = { ...value };

  const legacyGoal = LEGACY_COORG_KEYS.some((key) => key in data) ? goalFromLegacy(data) : null;
  if (legacyGoal && !('goals' in data)) data.goals = [legacyGoal];
  for (const key of LEGACY_COORG_KEYS) delete data[key];

  const esop = data.esopDetails;
  if (isRecord(esop) && isRecord(esop.triggers)) {
    const migratedGoal = Array.isArray(data.goals) ? (data.goals[0] as Json | undefined) ?? null : null;
    if (!('liquidationRules' in data)) {
      data.liquidationRules = rulesFromLegacyTriggers(esop.triggers, migratedGoal ?? legacyGoal);
    }
    const esopCopy: Json = { ...esop };
    delete esopCopy.triggers;
    data.esopDetails = esopCopy;
  }

  // Fund buckets: give every holding an explicit bucket once, so classification
  // never depends on a fund name at read time.
  if ('sip' in data) data.sip = assignBuckets(data.sip);
  if ('mf' in data) data.mf = assignBuckets(data.mf);

  // The legacy owner-keyed watchdog object is replaced by a generic rules array.
  if (isRecord(data.watchdogRules)) delete data.watchdogRules;

  return data;
}

/** Migrate the persisted `data` inside a portfolio envelope, preserving metadata. */
export function migratePortfolioEnvelope(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.data)) return value;
  return { ...value, data: migratePersistedData(value.data) };
}
