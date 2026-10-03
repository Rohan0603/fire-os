import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { queryAssistant, AssistantRequestError } from './client';

describe('queryAssistant client', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('posts question + context and returns reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ reply: 'Your FI progress looks healthy.' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await queryAssistant('How am I doing?', { netWorthRange: '5–25L' });

    expect(result.reply).toBe('Your FI progress looks healthy.');
    expect(result.proposedChanges).toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/assistant/query');
    const body = JSON.parse(init.body);
    expect(body.question).toBe('How am I doing?');
    expect(body.contextSummary).toEqual({ netWorthRange: '5–25L' });
    expect(body.messages).toEqual([{ role: 'user', content: 'How am I doing?' }]);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('sends prior conversation turns with the latest question', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ reply: 'Your SIPs are recorded separately.' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await queryAssistant('Are my SIPs mutual funds?', {}, {
      messages: [
        { role: 'user', content: 'How many SIPs do I have?' },
        { role: 'assistant', content: 'Your context lists three SIPs.' },
        { role: 'user', content: 'Are my SIPs mutual funds?' },
      ],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toHaveLength(3);
    expect(body.messages[2]).toEqual({ role: 'user', content: 'Are my SIPs mutual funds?' });
  });

  it('includes proposedChanges when present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ reply: 'ok', proposedChanges: { profile: { fiTarget: 60000000 } } }),
      })
    );

    const result = await queryAssistant('raise target', {});
    expect(result.proposedChanges).toEqual({ profile: { fiTarget: 60000000 } });
  });

  it('throws AssistantRequestError with server message on non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Prompts requesting PII disclosure are not supported.' }),
      })
    );

    await expect(queryAssistant('give me emails', {})).rejects.toThrowError(AssistantRequestError);
    await expect(queryAssistant('give me emails', {})).rejects.toThrow(
      'Prompts requesting PII disclosure'
    );
  });

  it('aborts after timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        (_url: string, init: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError'))
            );
          })
      )
    );

    const promise = queryAssistant('slow', {}, { timeoutMs: 1000 });
    const assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
  });
});
