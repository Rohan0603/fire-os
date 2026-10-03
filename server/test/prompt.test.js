import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildMessages } from '../lib/prompt.js';

describe('buildSystemPrompt', () => {
  it('includes India-focused role, friendly style, accuracy rules, and context', () => {
    const prompt = buildSystemPrompt({ netWorthRange: '5–25L' });
    expect(prompt).toContain('FIRE OS financial guide');
    expect(prompt).toContain('Indian personal finance');
    expect(prompt).toContain('friendly, thoughtful guide');
    expect(prompt).toMatch(/precise and concise/i);
    expect(prompt).toMatch(/avoid drama/i);
    expect(prompt).toMatch(/separate observed facts, derived calculations, and optional recommendations/i);
    expect(prompt).toMatch(/80 words or fewer/i);
    expect(prompt).toMatch(/exactly 1–3 numbered actions/i);
    expect(prompt).toMatch(/never invent/i);
    expect(prompt).toContain('clarifying question');
    expect(prompt).toMatch(/do not assume SIP entries are also recorded as mutual-fund holdings/i);
    expect(prompt).toContain('5–25L');
    expect(prompt).toContain('PII');
  });

  it('serializes object context and accepts string context', () => {
    const fromString = buildSystemPrompt('plain text context');
    expect(fromString).toContain('plain text context');

    const fromNull = buildSystemPrompt(null);
    expect(fromNull).toContain('{}');
  });

  it('does not embed API keys or secrets', () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).not.toMatch(/OPENROUTER_API_KEY|Bearer\s+\w/i);
  });
});

describe('buildMessages', () => {
  it('produces system + user messages', () => {
    const messages = buildMessages('sys', [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'Hi!' },
      { role: 'user', content: 'what is my FI progress?' },
    ]);
    expect(messages).toHaveLength(4);
    expect(messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect(messages[1]).toEqual({ role: 'user', content: 'hello' });
    expect(messages[3]).toEqual({ role: 'user', content: 'what is my FI progress?' });
  });
});
