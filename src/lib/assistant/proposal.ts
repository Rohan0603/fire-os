/**
 * Assistant proposal handling: validation, field-level diff, destructive
 * classification, and application to state.
 *
 * Guard rails:
 * - Only top-level PERSISTED_STATE_KEYS may be proposed (never runtime fields).
 * - The candidate must pass isPersistedPortfolioData before any persist call.
 * - Destructive / high-value changes are flagged for re-authentication.
 */

import type { FireOSState } from '../../types/state';
import { isPersistedPortfolioData, PERSISTED_STATE_KEYS } from '../../types/state';

const FORBIDDEN_KEYS = new Set(['currentUser', '_lastSavedAt', '_syncMetadata']);
const HOLDING_KEYS = [
  'mf',
  'sip',
  'fd',
  'epf',
  'esop',
  'bonds',
  'otherHoldings',
  'demat',
  'liabilities',
] as const;

/** Absolute rupee delta treated as a high-value change (₹10L). */
export const HIGH_VALUE_THRESHOLD = 1000000;

export interface ProposalDiffEntry {
  /** Dotted path, e.g. "profile.fiTarget" or "expenses" (array replacement) */
  path: string;
  before: unknown;
  after: unknown;
}

export type ProposalValidation =
  | { ok: true; candidate: FireOSState; diff: ProposalDiffEntry[] }
  | { ok: false; reason: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Strip runtime-only fields, producing the persisted shape used for
 * snapshot recording and validation.
 */
export function stripRuntime(
  state: FireOSState
): Omit<FireOSState, 'currentUser' | '_lastSavedAt' | '_syncMetadata'> {
  const { currentUser, _lastSavedAt, _syncMetadata, ...persisted } = state;
  void currentUser;
  void _lastSavedAt;
  void _syncMetadata;
  const rec = persisted as Record<string, unknown>;
  for (const key of Object.keys(rec)) {
    if (rec[key] === undefined) delete rec[key];
  }
  return persisted;
}

/**
 * Merge proposal keys into a candidate state (one-level merge for plain
 * objects so minimal proposals like { profile: { fiTarget } } keep the rest
 * of the section intact). Returns a fresh object; never mutates inputs.
 */
export function buildCandidate(
  current: FireOSState,
  proposal: Record<string, unknown>
): FireOSState {
  const candidate = deepClone(current);
  for (const [key, value] of Object.entries(proposal)) {
    const currentSection = (current as unknown as Record<string, unknown>)[key];
    if (isPlainObject(value) && isPlainObject(currentSection)) {
      (candidate as unknown as Record<string, unknown>)[key] = {
        ...currentSection,
        ...value,
      };
    } else {
      (candidate as unknown as Record<string, unknown>)[key] = deepClone(value);
    }
  }
  return candidate;
}

/**
 * Compute a field-level diff for the sections touched by the proposal.
 */
export function computeDiff(
  current: FireOSState,
  candidate: FireOSState
): ProposalDiffEntry[] {
  const diff: ProposalDiffEntry[] = [];
  const currentRec = current as unknown as Record<string, unknown>;
  const candidateRec = candidate as unknown as Record<string, unknown>;

  const touched = new Set(
    Object.keys(candidateRec).filter((key) => JSON.stringify(currentRec[key]) !== JSON.stringify(candidateRec[key]))
  );

  for (const key of touched) {
    const before = currentRec[key];
    const after = candidateRec[key];
    if (isPlainObject(before) && isPlainObject(after)) {
      const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
      for (const sub of allKeys) {
        const b = before[sub];
        const a = after[sub];
        if (JSON.stringify(b) !== JSON.stringify(a)) {
          diff.push({ path: `${key}.${sub}`, before: b, after: a });
        }
      }
    } else {
      diff.push({ path: key, before, after });
    }
  }
  return diff;
}

/**
 * Validate a proposal against the current state and produce the candidate
 * state plus a human-readable diff. Pure function.
 */
export function applyAssistantProposal(
  current: FireOSState,
  proposal: unknown
): ProposalValidation {
  if (!isPlainObject(proposal)) {
    return { ok: false, reason: 'Proposal must be a JSON object.' };
  }
  const keys = Object.keys(proposal);
  if (keys.length === 0) {
    return { ok: false, reason: 'Proposal is empty.' };
  }
  if (keys.length > 25) {
    return { ok: false, reason: 'Proposal touches too many fields.' };
  }

  for (const key of keys) {
    if (FORBIDDEN_KEYS.has(key) || key.startsWith('_')) {
      return { ok: false, reason: `Proposal may not modify runtime field "${key}".` };
    }
    if (!(PERSISTED_STATE_KEYS as readonly string[]).includes(key)) {
      return { ok: false, reason: `Proposal may not modify unknown field "${key}".` };
    }
  }

  const candidate = buildCandidate(current, proposal);

  const persistedCandidate = stripRuntime(candidate);

  if (!isPersistedPortfolioData(persistedCandidate)) {
    return { ok: false, reason: 'Proposed state failed portfolio validation.' };
  }

  return { ok: true, candidate, diff: computeDiff(current, candidate) };
}

export interface DestructiveAnalysis {
  requiresReauth: boolean;
  reasons: string[];
}

/**
 * Classify a proposal: bulk deletions and high-value numeric changes
 * require re-authentication before applying.
 */
export function classifyProposal(
  current: FireOSState,
  proposal: Record<string, unknown>
): DestructiveAnalysis {
  const reasons: string[] = [];
  const currentRec = current as unknown as Record<string, unknown>;

  for (const [key, value] of Object.entries(proposal)) {
    if (
      (HOLDING_KEYS as readonly string[]).includes(key) &&
      isPlainObject(value) &&
      isPlainObject(currentRec[key])
    ) {
      const beforeKeys = Object.keys(currentRec[key]);
      const afterKeys = new Set(Object.keys(value));
      const removed = beforeKeys.filter((k) => !afterKeys.has(k));
      if (removed.length > 0) {
        reasons.push(`Removes ${removed.length} entr${removed.length === 1 ? 'y' : 'ies'} from "${key}"`);
      }
    }
    if (isPlainObject(value)) {
      const currentSection = isPlainObject(currentRec[key]) ? currentRec[key] : {};
      for (const [sub, afterVal] of Object.entries(value)) {
        if (typeof afterVal === 'number' && typeof currentSection[sub] === 'number') {
          const delta = Math.abs(afterVal - (currentSection[sub] as number));
          if (delta >= HIGH_VALUE_THRESHOLD) {
            reasons.push(`Large value change at "${key}.${sub}" (Δ ₹${Math.round(delta).toLocaleString('en-IN')})`);
          }
        }
      }
    } else if (Array.isArray(value) && Array.isArray(currentRec[key])) {
      const beforeArr = currentRec[key] as unknown[];
      if (value.length < beforeArr.length && beforeArr.length - value.length >= 10) {
        reasons.push(`Bulk removal from "${key}" (${beforeArr.length} → ${value.length})`);
      }
    }
  }

  return { requiresReauth: reasons.length > 0, reasons };
}

/**
 * Apply a validated proposal to state in place (FIRE OS module convention:
 * mutate the shared appState, then persist). Only call after validation
 * succeeded and re-auth (if required) passed.
 */
export function applyValidatedProposal(
  state: FireOSState,
  proposal: Record<string, unknown>
): void {
  const stateRec = state as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(proposal)) {
    const currentSection = stateRec[key];
    if (isPlainObject(value) && isPlainObject(currentSection)) {
      stateRec[key] = { ...currentSection, ...value };
    } else {
      stateRec[key] = deepClone(value);
    }
  }
}
