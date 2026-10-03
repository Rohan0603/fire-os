/**
 * Client for POST /api/assistant/query.
 * Same-origin only (Vite dev proxy / Firebase Hosting rewrite) - never exposes API keys.
 */

export interface AssistantQueryResponse {
  reply: string;
  proposedChanges?: Record<string, unknown>;
}

export interface AssistantConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class AssistantRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'AssistantRequestError';
  }
}

const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Send a question + sanitized context summary to the assistant proxy.
 * Throws AssistantRequestError on non-2xx responses.
 */
export async function queryAssistant(
  question: string,
  contextSummary: unknown,
  options: {
    sendExact?: boolean;
    timeoutMs?: number;
    messages?: AssistantConversationMessage[];
  } = {}
): Promise<AssistantQueryResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const resp = await fetch('/api/assistant/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        contextSummary,
        messages: options.messages ?? [{ role: 'user', content: question }],
        ...(options.sendExact !== undefined ? { sendExact: options.sendExact } : {}),
      }),
      signal: controller.signal,
    });

    const data: unknown = await resp.json().catch(() => ({}));
    const rec = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;

    if (!resp.ok) {
      throw new AssistantRequestError(
        typeof rec.error === 'string' ? rec.error : `Request failed (${resp.status})`,
        resp.status
      );
    }

    return {
      reply: typeof rec.reply === 'string' ? rec.reply : '',
      ...(rec.proposedChanges && typeof rec.proposedChanges === 'object'
        ? { proposedChanges: rec.proposedChanges as Record<string, unknown> }
        : {}),
    };
  } finally {
    clearTimeout(timer);
  }
}
