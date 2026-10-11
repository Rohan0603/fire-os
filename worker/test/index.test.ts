import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';

const { verifyMock } = vi.hoisted(() => ({ verifyMock: vi.fn() }));

vi.mock('../src/firebase-auth', () => ({
  verifyFirebaseIdToken: verifyMock,
  AuthConfigError: class AuthConfigError extends Error {},
}));

const PRIMARY_ORIGIN = 'https://fire-os-dd6d6.firebaseapp.com';

const env = {
  OPENROUTER_API_KEY: 'test-key',
  FIREBASE_PROJECT_ID: 'fire-os-test',
  ASSISTANT_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
  ALLOWED_ORIGIN: `${PRIMARY_ORIGIN},https://fire-os-dd6d6.web.app,http://localhost:5173`,
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
      Origin: PRIMARY_ORIGIN,
      Authorization: 'Bearer valid-token',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  verifyMock.mockReset();
  verifyMock.mockResolvedValue({ uid: 'user-1' });
});

afterEach(() => vi.unstubAllGlobals());

describe('Assistant Worker', () => {
  it.each([
    'https://fire-os-dd6d6.firebaseapp.com',
    'https://fire-os-dd6d6.web.app',
    'http://localhost:5173',
  ])('answers preflight requests for the allowed origin %s', async (origin) => {
    const response = await worker.fetch(
      new Request('https://worker.example/api/assistant/query', {
        method: 'OPTIONS',
        headers: { Origin: origin },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
  });

  it('allows the Authorization header in the CORS preflight', async () => {
    const response = await worker.fetch(
      new Request('https://worker.example/api/assistant/query', {
        method: 'OPTIONS',
        headers: { Origin: PRIMARY_ORIGIN },
      }),
      env,
    );

    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });

  it('echoes a disallowed origin instead of granting it access', async () => {
    const response = await worker.fetch(
      new Request('https://worker.example/api/assistant/query', {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example' },
      }),
      env,
    );

    expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe('https://evil.example');
  });

  it('tolerates whitespace around the origin allowlist', async () => {
    const spacedEnv = { ...env, ALLOWED_ORIGIN: ' https://a.example , https://b.example ' };
    const response = await worker.fetch(
      new Request('https://worker.example/api/assistant/query', {
        method: 'OPTIONS',
        headers: { Origin: 'https://b.example' },
      }),
      spacedEnv,
    );

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://b.example');
  });

  it('rejects unknown routes and methods without calling the provider', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(new Request('https://worker.example/other'), env);

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a missing token with 401 before doing any other work', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const limiter = { limit: vi.fn() };

    const { Authorization: _drop, ...withoutAuth } = {
      'Content-Type': 'application/json',
      Origin: PRIMARY_ORIGIN,
      Authorization: 'Bearer valid-token',
    };
    void _drop;
    const response = await worker.fetch(
      new Request('https://worker.example/api/assistant/query', {
        method: 'POST',
        headers: withoutAuth,
        body: JSON.stringify({}),
      }),
      { ...env, ASSISTANT_RATE_LIMITER: limiter },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'unauthenticated' });
    expect(verifyMock).not.toHaveBeenCalled();
    expect(limiter.limit).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired token with 401', async () => {
    verifyMock.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await worker.fetch(queryRequest(), env);

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'unauthenticated' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 500 when the Worker has no project id to verify against', async () => {
    const { AuthConfigError } = await import('../src/firebase-auth');
    verifyMock.mockRejectedValue(new AuthConfigError('no project id'));
    const { FIREBASE_PROJECT_ID: _drop, ...envWithoutProject } = env;
    void _drop;

    const response = await worker.fetch(queryRequest(), envWithoutProject);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Authentication is not configured.' });
  });

  it('answers a valid token and keys the quota by the verified uid', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const limiter = { limit: vi.fn().mockResolvedValue({ success: true }) };

    const response = await worker.fetch(queryRequest({}, { 'CF-Connecting-IP': '203.0.113.7' }), {
      ...env,
      ASSISTANT_RATE_LIMITER: limiter,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ reply: 'ok' });
    expect(verifyMock).toHaveBeenCalledWith('valid-token', 'fire-os-test');
    expect(limiter.limit).toHaveBeenNthCalledWith(1, { key: 'user:user-1' });
    expect(limiter.limit).toHaveBeenNthCalledWith(2, { key: 'ip:203.0.113.7' });
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

  it('returns 429 when the per-user rate limit is exceeded', async () => {
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
    expect(rateLimitedEnv.ASSISTANT_RATE_LIMITER.limit).toHaveBeenCalledTimes(1);
    expect(rateLimitedEnv.ASSISTANT_RATE_LIMITER.limit).toHaveBeenCalledWith({
      key: 'user:user-1',
    });
  });

  it('returns 429 when the per-IP guard trips after the user quota passes', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const limiter = {
      limit: vi
        .fn()
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false }),
    };

    const response = await worker.fetch(queryRequest({}, { 'CF-Connecting-IP': '198.51.100.9' }), {
      ...env,
      ASSISTANT_RATE_LIMITER: limiter,
    });

    expect(response.status).toBe(429);
    expect(limiter.limit).toHaveBeenNthCalledWith(1, { key: 'user:user-1' });
    expect(limiter.limit).toHaveBeenNthCalledWith(2, { key: 'ip:198.51.100.9' });
  });

  it('returns 503 when the rate limiter itself is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const brokenEnv = {
      ...env,
      ASSISTANT_RATE_LIMITER: { limit: vi.fn().mockRejectedValue(new Error('down')) },
    };

    const response = await worker.fetch(queryRequest(), brokenEnv);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Rate limiting is temporarily unavailable' });
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

  it('degrades to a deterministic fallback reply when the provider fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'provider unavailable' } }), {
          status: 429,
        }),
      ),
    );

    const response = await worker.fetch(queryRequest(), env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.fallback).toBe(true);
    expect(body.reply).toContain('temporarily unavailable');
    expect(JSON.stringify(body)).not.toContain('provider unavailable');
  });

  it('degrades to a deterministic fallback reply when the provider times out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError')),
    );

    const response = await worker.fetch(queryRequest(), env);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ fallback: true });
  });

  it('rejects requests whose declared body size exceeds the limit', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('https://worker.example/api/assistant/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': '100001',
        Authorization: 'Bearer valid-token',
      },
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
