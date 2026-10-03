import { describe, expect, it } from 'vitest';
import { buildAssistantContext } from './contextBuilder';
import { initializeState } from '../../types/state';

describe('buildAssistantContext', () => {
  it('returns a sanitized summary and sendExact flag', () => {
    const state = initializeState();
    const { contextSummary, sendExactFlag } = buildAssistantContext(state, false);

    expect(sendExactFlag).toBe(false);
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

    const denied = buildAssistantContext(state, false);
    expect(denied.sendExactFlag).toBe(false);
    expect(denied.contextSummary.exact).toBeUndefined();
    expect(JSON.stringify(denied.contextSummary)).not.toContain('Confidential Name');

    const allowed = buildAssistantContext(state, true);
    expect(allowed.sendExactFlag).toBe(true);
    expect(allowed.contextSummary.exact?.fiTarget).toBe(12000000);
    expect(JSON.stringify(allowed.contextSummary)).not.toContain('Confidential Name');
  });
});
