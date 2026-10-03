import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  canReadPortfolio,
  consentScope,
  defaultConsent,
  readConsent,
  toggleConsent,
  writeConsent,
} from './consent';

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

describe('consent storage', () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('allows reads by default while keeping writes opt-in', () => {
    const consent = readConsent('anonymous');
    expect(consent).toEqual(defaultConsent);
    expect(consent.allowWrites).toBe(false);
    expect(canReadPortfolio('anonymous')).toBe(true);
  });

  it('toggleConsent flips a single flag and persists it', () => {
    const after = toggleConsent('anonymous', 'allowWrites');
    expect(after.allowWrites).toBe(true);
    expect(readConsent('anonymous').allowWrites).toBe(true);
    expect(canReadPortfolio('anonymous')).toBe(true);

    const reverted = toggleConsent('anonymous', 'allowWrites');
    expect(reverted.allowWrites).toBe(false);
  });

  it('isolates consent per scope (anonymous vs user)', () => {
    toggleConsent('anonymous', 'allowWrites');
    expect(readConsent('user:uid-1').allowWrites).toBe(false);

    writeConsent('user:uid-1', { allowWrites: true });
    expect(readConsent('user:uid-1').allowWrites).toBe(true);
    expect(readConsent('anonymous').allowWrites).toBe(true);
  });

  it('returns defaults for corrupt stored JSON', () => {
    localStorage.setItem('anonymous:fireOS:assistant:consent', '{not-json');
    expect(readConsent('anonymous')).toEqual(defaultConsent);

    localStorage.setItem('anonymous:fireOS:assistant:consent', JSON.stringify({ suggestChanges: true }));
    expect(readConsent('anonymous').allowWrites).toBe(true);
  });

  it('consentScope maps uid to user scope and null to anonymous', () => {
    expect(consentScope(null)).toBe('anonymous');
    expect(consentScope(undefined)).toBe('anonymous');
    expect(consentScope('abc')).toBe('user:abc');
  });
});
