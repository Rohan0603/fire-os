/**
 * Server-side policy layer: rejects prompts that would leak PII or request
 * destructive actions. Pure functions - unit tested.
 */

const DESTRUCTIVE_PATTERNS = [
  /\bdelete\s+(all|everything)\b/i,
  /\bclear\s+(all|everything|my\s+account)\b/i,
  /\b(purge|wipe|erase)\b/i,
  /\bbulk\s+delete\b/i,
  /\bdestroy\b/i,
  /\breset\s+(all|my\s+(account|data|portfolio))\b/i,
  /\bremove\s+(all|everything)\b/i,
];

const PII_REQUEST_PATTERNS = [
  /\b(show|give|send|reveal|return|dump|list|share)\b[^.?!]*\b(email|e-mail|uid|user\s*id|transaction\s*(id|ids)|account\s*(number|numbers)|ssn|social\s*security|pan\s*number|dob|date\s+of\s+birth)\b/i,
  /\bfull\s+(portfolio|dump|state|json)\b/i,
  /\braw\s+(data|dump|portfolio)\b/i,
  /\ball\s+transactions\b/i,
];

/**
 * @returns {null | { status: number, error: string }}
 */
export function checkPromptPolicy(question) {
  const q = String(question ?? '');

  if (!q.trim()) {
    return { status: 400, error: 'question is required' };
  }

  if (q.length > 4000) {
    return { status: 400, error: 'question too long (max 4000 chars)' };
  }

  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(q)) {
      return {
        status: 403,
        error:
          'Prompts requesting destructive actions are not supported. Use the app UI with confirmation instead.',
      };
    }
  }

  for (const pattern of PII_REQUEST_PATTERNS) {
    if (pattern.test(q)) {
      return {
        status: 403,
        error: 'Prompts requesting PII or raw data disclosure are not supported.',
      };
    }
  }

  return null;
}

/**
 * Validate the incoming request body shape for /api/assistant/query.
 * @returns {null | { status: number, error: string }}
 */
export function validateRequestBody(body) {
  if (typeof body !== 'object' || body === null) {
    return { status: 400, error: 'JSON body required' };
  }
  if (typeof body.question !== 'string' || !body.question.trim()) {
    return { status: 400, error: 'question is required' };
  }
  if (body.contextSummary === undefined || body.contextSummary === null) {
    return { status: 400, error: 'contextSummary is required' };
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 12) {
    return { status: 400, error: 'messages must contain 1–12 conversation messages' };
  }
  for (let index = 0; index < body.messages.length; index += 1) {
    const message = body.messages[index];
    const expectedRole = index % 2 === 0 ? 'user' : 'assistant';
    if (
      typeof message !== 'object' ||
      message === null ||
      Object.keys(message).some((key) => !['role', 'content'].includes(key)) ||
      message.role !== expectedRole ||
      typeof message.content !== 'string' ||
      !message.content.trim() ||
      message.content.length > 6000
    ) {
      return {
        status: 400,
        error: 'messages must alternate user/assistant with text content only',
      };
    }
  }
  const latestMessage = body.messages.at(-1);
  if (latestMessage.role !== 'user' || latestMessage.content !== body.question) {
    return { status: 400, error: 'last message must match question' };
  }
  if (body.sendExact !== undefined && typeof body.sendExact !== 'boolean') {
    return { status: 400, error: 'sendExact must be boolean' };
  }
  const size = JSON.stringify(body).length;
  if (size > 100_000) {
    return { status: 413, error: 'contextSummary too large (max 100KB)' };
  }
  return null;
}

/**
 * Top-level keys the client is allowed to persist (mirrors
 * PERSISTED_STATE_KEYS in src/types/state.ts). Anything else is dropped.
 */
export const PERSISTED_ALLOWLIST = [
  'profile',
  'mf',
  'fd',
  'epf',
  'sip',
  'esop',
  'bonds',
  'otherHoldings',
  'liabilities',
  'demat',
  'nav',
  'niftyHigh',
  'niftyData',
  'currencyRates',
  'eurInr',
  'eurInrData',
  'alphaTrackerData',
  'coorgCorpus',
  'coorgStartDate',
  'coorgTarget',
  'coorgMonthlyAmount',
  'watchdogRules',
  'swpSchedule',
  'taxCalendar',
  'expenses',
  'netWorthHistory',
  'completedActions',
  'achievedMilestones',
  'insurance',
  'esopDetails',
];

/**
 * Extract a minimal proposed-changes object from a model reply.
 * Strips runtime fields, underscore-prefixed keys, and keys outside
 * PERSISTED_ALLOWLIST. Returns null when nothing usable is found.
 */
export function extractProposedChanges(reply) {
  if (typeof reply !== 'string' || !reply) return null;
  const match = reply.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const forbidden = new Set(['currentUser', '_lastSavedAt', '_syncMetadata']);
    const allowed = new Set(PERSISTED_ALLOWLIST);
    const filtered = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (forbidden.has(key) || key.startsWith('_') || !allowed.has(key)) continue;
      if (typeof value === 'object' && value !== null) {
        filtered[key] = value;
      } else if (
        typeof value === 'number' ||
        typeof value === 'string' ||
        typeof value === 'boolean'
      ) {
        filtered[key] = value;
      }
    }
    return Object.keys(filtered).length > 0 ? filtered : null;
  } catch {
    return null;
  }
}
