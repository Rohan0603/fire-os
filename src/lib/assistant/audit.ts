/**
 * Local-only audit log for assistant actions.
 * Stored under `{scope}:fireOS:assistant:audit` in localStorage.
 * Never uploaded; ring buffer of MAX_ENTRIES.
 */

import type { ProposalDiffEntry } from './proposal';

const AUDIT_SUFFIX = 'fireOS:assistant:audit';
const MAX_ENTRIES = 50;

export type AssistantDecision =
  | 'confirmed'
  | 'rejected'
  | 'reauth-required'
  | 'validation-failed'
  | 'save-failed';

export interface AssistantActionEntry {
  id: string;
  timestamp: string;
  /** First 200 chars of the question that triggered the proposal */
  question: string;
  diff: ProposalDiffEntry[];
  decision: AssistantDecision;
  cloudSaved: boolean;
  /** Human-readable reasons (e.g. re-auth requirements, failure detail) */
  notes?: string[];
}

function auditKey(scope: string): string {
  return `${scope}:${AUDIT_SUFFIX}`;
}

function readRaw(scope: string): AssistantActionEntry[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(auditKey(scope));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is AssistantActionEntry =>
        typeof e === 'object' && e !== null && typeof (e as AssistantActionEntry).id === 'string'
    );
  } catch {
    return [];
  }
}

/** Read the full audit log for a scope (newest last). */
export function readAssistantAudit(scope: string): AssistantActionEntry[] {
  return readRaw(scope);
}

/** Append an audit entry (ring buffer, newest last). */
export function appendAssistantAction(
  scope: string,
  entry: Omit<AssistantActionEntry, 'id' | 'timestamp'>
): AssistantActionEntry {
  const full: AssistantActionEntry = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  try {
    if (typeof localStorage !== 'undefined') {
      const entries = readRaw(scope);
      entries.push(full);
      localStorage.setItem(auditKey(scope), JSON.stringify(entries.slice(-MAX_ENTRIES)));
    }
  } catch {
    // storage unavailable - audit entry is dropped, action itself is unaffected
  }
  return full;
}

/** True when at least one confirmed change exists (enables the undo affordance). */
export function hasConfirmedAssistantAction(scope: string): boolean {
  return readRaw(scope).some((e) => e.decision === 'confirmed');
}
