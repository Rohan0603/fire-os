import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { appendAssistantAction, hasConfirmedAssistantAction, readAssistantAudit } from './audit';

function stubLocalStorage(): { values: Map<string, string> } {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    clear: () => values.clear(),
  });
  return { values };
}

describe('assistant audit log', () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to an empty log', () => {
    expect(readAssistantAudit('anonymous')).toEqual([]);
    expect(hasConfirmedAssistantAction('anonymous')).toBe(false);
  });

  it('appends entries with timestamp and decision', () => {
    appendAssistantAction('anonymous', {
      question: 'raise my FI target',
      diff: [{ path: 'profile.fiTarget', before: 1, after: 2 }],
      decision: 'confirmed',
      cloudSaved: false,
    });

    const log = readAssistantAudit('anonymous');
    expect(log).toHaveLength(1);
    expect(log[0].decision).toBe('confirmed');
    expect(log[0].question).toBe('raise my FI target');
    expect(log[0].timestamp).toBeTruthy();
    expect(log[0].id).toBeTruthy();
    expect(hasConfirmedAssistantAction('anonymous')).toBe(true);
  });

  it('isolates logs per scope', () => {
    appendAssistantAction('anonymous', {
      question: 'q',
      diff: [],
      decision: 'confirmed',
      cloudSaved: false,
    });
    expect(readAssistantAudit('user:abc')).toEqual([]);
    expect(hasConfirmedAssistantAction('user:abc')).toBe(false);
  });

  it('bounds the log to 50 entries', () => {
    for (let i = 0; i < 60; i++) {
      appendAssistantAction('anonymous', {
        question: `q${i}`,
        diff: [],
        decision: 'rejected',
        cloudSaved: false,
      });
    }
    const log = readAssistantAudit('anonymous');
    expect(log).toHaveLength(50);
    expect(log[0].question).toBe('q10');
    expect(log[49].question).toBe('q59');
  });

  it('tolerates corrupt stored JSON', () => {
    localStorage.setItem('anonymous:fireOS:assistant:audit', '{bad');
    expect(readAssistantAudit('anonymous')).toEqual([]);
  });
});
