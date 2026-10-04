import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';

const env = {
  OPENROUTER_API_KEY: 'test-key',
  ASSISTANT_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
  ALLOWED_ORIGIN: 'https://fire-os-dd6d6.web.app',
  OPENROUTER_FALLBACK_MODELS: 'fallback/model:free',
};

function queryRequest(overrides: Record<string, unknown> = {}, headers: HeadersInit = {}) {
  const question =
    typeof overrides.question === 'string' ? overrides.question : 'How is my plan progressing?';
  const body = {
    question,
    contextSummary: { portfolioValue: 100 },
    messages: [{ role: 'user', content: question }],
    ...overrides,
  };
  return new Request('https://worker.example/api/assistant/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: env.ALLOWED_ORIGIN,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('Assistant Worker', () => {
  it('answers preflight requests with the configured origin', async () => {
    const response = await worker.fetch(
      new Request('https://worker.example/api/assistant/query', {
        method: 'OPTIONS',
        headers: { Origin: env.ALLOWED_ORIGIN },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(env.ALLOWED_ORIGIN);
  });

  it('rejects unknown routes and methods without calling the provider', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://worker.example/other'), env);

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid request shape before calling the provider', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(queryRequest({ messages: [] }), env);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('messages') });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid message roles with the existing 400 response', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      queryRequest({ messages: [{ role: 'system', content: 'How is my plan progressing?' }] }),
      env,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'messages must alternate user/assistant with text content only',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects destructive requests before calling the provider', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      queryRequest({ question: 'Delete everything in my account' }),
      env,
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 429 when the Cloudflare rate limit is exceeded', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const rateLimitedEnv = {
      ...env,
      ASSISTANT_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: false }) },
    };

    const response = await worker.fetch(queryRequest(), rateLimitedEnv);

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: 'Rate limit exceeded. Please try again later.',
    });
    expect(rateLimitedEnv.ASSISTANT_RATE_LIMITER.limit).toHaveBeenCalledWith({ key: 'unknown' });
  });

  it('forwards validated context and only returns allowed proposal fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  'Suggested update: {"profile":{"age":40},"currentUser":"ignored","unknown":"ignored"}',
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(queryRequest(), env);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      reply: 'Suggested update: {"profile":{"age":40},"currentUser":"ignored","unknown":"ignored"}',
      proposedChanges: { profile: { age: 40 } },
    });
    expect(payload.models).toEqual(['openrouter/free', 'fallback/model:free']);
    expect(payload.messages[0].content).toContain('Current user context');
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('maps provider failures to a bounded 502 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'provider unavailable' } }), {
          status: 429,
        }),
      ),
    );

    const response = await worker.fetch(queryRequest(), env);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'LLM backend error: provider unavailable' });
  });

  it('returns a gateway timeout when the provider request times out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError')),
    );

    const response = await worker.fetch(queryRequest(), env);

    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ error: 'LLM backend timed out' });
  });

  it('rejects requests whose declared body size exceeds the limit', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('https://worker.example/api/assistant/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': '100001' },
      body: '{}',
    });

    const response = await worker.fetch(request, env);

    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects serialized bodies over 100KB with the existing 413 response', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(
      queryRequest({ contextSummary: { blob: 'x'.repeat(100_001) } }),
      env,
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'contextSummary too large (max 100KB)' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
