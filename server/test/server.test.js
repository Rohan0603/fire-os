import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../server.js';

describe('assistant proxy conversation forwarding', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('adds the trusted prompt and forwards validated history through OpenRouter fallbacks', async () => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-openrouter-key');
    vi.stubEnv('OPENROUTER_FALLBACK_MODELS', 'google/gemma-4-31b-it:free');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'google/gemma-4-31b-it:free',
        choices: [{ message: { content: 'Your SIPs are separate records.' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await request(app)
      .post('/api/assistant/query')
      .send({
        question: 'Are these SIPs mutual funds?',
        contextSummary: { holdingsSummary: { sip: { count: 3 } } },
        messages: [
          { role: 'user', content: 'How many SIPs do I have?' },
          { role: 'assistant', content: 'Your context lists three SIPs.' },
          { role: 'user', content: 'Are these SIPs mutual funds?' },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.reply).toBe('Your SIPs are separate records.');

    const [url, init] = fetchMock.mock.calls[0];
    const payload = JSON.parse(init.body);
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer test-openrouter-key');
    expect(init.headers['HTTP-Referer']).toBe('https://fire-os-dd6d6.web.app');
    expect(init.headers['X-OpenRouter-Title']).toBe('FIRE OS');
    expect(payload.models).toEqual(['openrouter/free', 'google/gemma-4-31b-it:free']);
    expect(payload.max_tokens).toBe(180);
    expect(payload.messages.map(({ role }) => role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
    ]);
    expect(payload.messages[0].content).toContain('Indian personal finance');
    expect(payload.messages[0].content).toContain('holdingsSummary');
    expect(payload.messages[1].content).toBe('How many SIPs do I have?');
  });
});
