import { z } from 'zod';

const DESTRUCTIVE_PATTERNS = [
  /\bdelete\s+(all|everything)\b/i,
  /\bclear\s+(all|everything|my\s+account)\b/i,
  /\b(purge|wipe|erase)\b/i,
  /\bbulk\s+delete\b/i,
  /\bdestroy\b/i,
  /\breset\s+(all|my\s+(account|data|portfolio))\b/i,
  /\bremove\s+(all|everything)\b/i,
];

const messageSchema = z.strictObject({
  role: z.union([z.literal('user'), z.literal('assistant')]),
  content: z.string().trim().min(1).max(6000),
});
const requestSchema = z.record(z.string(), z.unknown());
const questionSchema = z.string().trim().min(1);
const contextSummarySchema = z.unknown().refine((value) => value !== null);
const messagesSchema = z
  .array(messageSchema)
  .min(1)
  .max(12)
  .refine(
    (messages) =>
      messages.every((message, index) => message.role === (index % 2 === 0 ? 'user' : 'assistant')),
    { message: 'messages must alternate user/assistant with text content only' },
  );
const latestMessageSchema = messageSchema.refine((message) => message.role === 'user', {
  message: 'last message must match question',
});
const proposalEnvelopeSchema = z.record(z.string(), z.unknown());
const sendExactSchema = z.boolean();
const messageArrayShapeSchema = z.array(z.unknown()).min(1).max(12);

/** Valibot's `is`: true when the value satisfies the schema, never throwing. */
const is = (schema, value) => schema.safeParse(value).success;

const PII_REQUEST_PATTERNS = [
  /\b(show|give|send|reveal|return|dump|list|share)\b[^.?!]*\b(email|e-mail|uid|user\s*id|transaction\s*(id|ids)|account\s*(number|numbers)|ssn|social\s*security|pan\s*number|dob|date\s+of\s+birth)\b/i,
  /\bfull\s+(portfolio|dump|state|json)\b/i,
  /\braw\s+(data|dump|portfolio)\b/i,
  /\ball\s+transactions\b/i,
];

export const PERSISTED_ALLOWLIST = Object.freeze([
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
]);

/** @returns {null | { status: number, error: string }} */
export function checkPromptPolicy(question) {
  const value = String(question ?? '');
  if (!value.trim()) return { status: 400, error: 'question is required' };
  if (value.length > 4000) return { status: 400, error: 'question too long (max 4000 chars)' };
  if (DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(value))) {
    return {
      status: 403,
      error:
        'Prompts requesting destructive actions are not supported. Use the app UI with confirmation instead.',
    };
  }
  if (PII_REQUEST_PATTERNS.some((pattern) => pattern.test(value))) {
    return {
      status: 403,
      error: 'Prompts requesting PII or raw data disclosure are not supported.',
    };
  }
  return null;
}

/** @returns {null | { status: number, error: string }} */
export function validateAssistantRequest(body) {
  if (!is(requestSchema, body)) {
    return { status: 400, error: 'JSON body required' };
  }
  if (!is(questionSchema, body.question)) {
    return { status: 400, error: 'question is required' };
  }
  if (body.contextSummary === undefined || !is(contextSummarySchema, body.contextSummary)) {
    return { status: 400, error: 'contextSummary is required' };
  }
  if (!is(messageArrayShapeSchema, body.messages)) {
    return { status: 400, error: 'messages must contain 1–12 conversation messages' };
  }
  const result = messagesSchema.safeParse(body.messages);
  if (!result.success) {
    return {
      status: 400,
      error: 'messages must alternate user/assistant with text content only',
    };
  }
  const latestMessage = body.messages.at(-1);
  if (!is(latestMessageSchema, latestMessage) || latestMessage.content !== body.question) {
    return { status: 400, error: 'last message must match question' };
  }
  if (body.sendExact !== undefined && !is(sendExactSchema, body.sendExact)) {
    return { status: 400, error: 'sendExact must be boolean' };
  }
  if (JSON.stringify(body).length > 100_000) {
    return { status: 413, error: 'contextSummary too large (max 100KB)' };
  }
  return null;
}

/** Strip unapproved keys and non-JSON-null values from model-proposed changes. */
export function extractProposedChanges(reply) {
  if (typeof reply !== 'string' || !reply) return null;
  const match = reply.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (!is(proposalEnvelopeSchema, parsed)) return null;
    const allowed = new Set(PERSISTED_ALLOWLIST);
    const filtered = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (
        key.startsWith('_') ||
        ['currentUser', '_lastSavedAt', '_syncMetadata'].includes(key) ||
        !allowed.has(key)
      ) {
        continue;
      }
      if (
        (value !== null && typeof value === 'object' && value !== null) ||
        ['number', 'string', 'boolean'].includes(typeof value)
      ) {
        filtered[key] = value;
      }
    }
    return Object.keys(filtered).length > 0 ? filtered : null;
  } catch {
    return null;
  }
}
