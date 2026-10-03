/**
 * Context builder for the assistant.
 * Produces a minimal, sanitized summary of appState suitable for sending
 * to the server proxy, which then forwards it to OpenRouter.
 */

import type { FireOSState } from '../../types/state';
import { buildContextSummary, type SanitizedContext } from './sanitize';

/**
 * Entry point: called from the assistant chat UI when user has opted in.
 * Returns a contextSummary object that gets sent to /api/assistant/query.
 * sendExact only takes effect when the user explicitly allows exact values.
 */
export function buildAssistantContext(
  state: FireOSState,
  sendExact: boolean = false
): { contextSummary: SanitizedContext; sendExactFlag: boolean } {
  const summary = buildContextSummary(state, sendExact);
  return { contextSummary: summary, sendExactFlag: summary.sendExact };
}
