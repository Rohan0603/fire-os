import { describe, expect, it } from 'vitest';
import { buildContextSummary } from './sanitize';
import { initializeState } from '../../types/state';

describe('assistant context summary', () => {
  it('returns a sanitized summary and sendExact flag', () => {
    const state = initializeState();
    const contextSummary = buildContextSummary(state, false);

    expect(contextSummary.sendExact).toBe(false);
    expect(contextSummary.userLabel).toBe('User');
    expect(contextSummary.ageBand).toBeTruthy();
    expect(typeof contextSummary.netWorthRange).toBe('string');
    expect(contextSummary.exact).toBeUndefined();
  });

  it('propagates sendExact opt-in only when requested', () => {
    const state = initializeState();
    state.profile.name = 'Confidential Name';
    state.profile.fiTarget = 12000000;

    const denied = buildContextSummary(state, false);
    expect(denied.sendExact).toBe(false);
    expect(denied.exact).toBeUndefined();
    expect(JSON.stringify(denied)).not.toContain('Confidential Name');

    const allowed = buildContextSummary(state, true);
    expect(allowed.sendExact).toBe(true);
    expect(allowed.exact?.fiTarget).toBe(12000000);
    expect(JSON.stringify(allowed)).not.toContain('Confidential Name');
  });
});
