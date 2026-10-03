import { describe, expect, it } from 'vitest';
import {
  applyAssistantProposal,
  applyValidatedProposal,
  buildCandidate,
  classifyProposal,
  computeDiff,
  HIGH_VALUE_THRESHOLD,
} from './proposal';
import { initializeState } from '../../types/state';

describe('applyAssistantProposal', () => {
  it('accepts a minimal persisted-key proposal and produces a diff', () => {
    const state = initializeState();
    state.profile.fiTarget = 55000000;

    const result = applyAssistantProposal(state, { profile: { fiTarget: 60000000 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate.profile.fiTarget).toBe(60000000);
    expect(result.candidate.profile.name).toBe(state.profile.name);
    expect(result.diff).toEqual([
      { path: 'profile.fiTarget', before: 55000000, after: 60000000 },
    ]);
  });

  it('does not mutate the input state', () => {
    const state = initializeState();
    applyAssistantProposal(state, { profile: { fiTarget: 1 } });
    expect(state.profile.fiTarget).toBe(initializeState().profile.fiTarget);
  });

  it('rejects runtime fields', () => {
    const state = initializeState();
    expect(applyAssistantProposal(state, { currentUser: { uid: 'x' } })).toMatchObject({
      ok: false,
    });
    expect(applyAssistantProposal(state, { _lastSavedAt: '2026-01-01' })).toMatchObject({
      ok: false,
    });
    expect(applyAssistantProposal(state, { _syncMetadata: {} })).toMatchObject({ ok: false });
    expect(applyAssistantProposal(state, { _anything: 1 })).toMatchObject({ ok: false });
  });

  it('rejects unknown top-level keys', () => {
    const state = initializeState();
    expect(applyAssistantProposal(state, { hack: true })).toMatchObject({ ok: false });
    expect(applyAssistantProposal(state, { assistantActions: [] })).toMatchObject({ ok: false });
  });

  it('rejects non-objects and empty proposals', () => {
    const state = initializeState();
    expect(applyAssistantProposal(state, null)).toMatchObject({ ok: false });
    expect(applyAssistantProposal(state, 'text')).toMatchObject({ ok: false });
    expect(applyAssistantProposal(state, [1, 2])).toMatchObject({ ok: false });
    expect(applyAssistantProposal(state, {})).toMatchObject({ ok: false });
  });

  it('rejects proposals whose merged result fails portfolio validation', () => {
    const state = initializeState();
    // Negative annualExpenses violates isProfile's finite/positive shape checks? profile guard
    // requires finite numbers; a string violates the shape.
    const result = applyAssistantProposal(state, { profile: { annualExpenses: 'lots' } });
    expect(result.ok).toBe(false);
  });

  it('keeps the rest of a section intact (one-level merge)', () => {
    const state = initializeState();
    state.profile.taxSlabRate = 20;
    const result = applyAssistantProposal(state, { profile: { fiTarget: 9999 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidate.profile.taxSlabRate).toBe(20);
    expect(result.candidate.profile.fiTarget).toBe(9999);
  });
});

describe('classifyProposal', () => {
  it('flags removal of holding entries as destructive', () => {
    const state = initializeState();
    state.fd = {
      fd1: { amount: 100000, currency: 'INR' },
      fd2: { amount: 200000, currency: 'INR' },
    };
    const analysis = classifyProposal(state, { fd: { fd1: { amount: 100000, currency: 'INR' } } });
    expect(analysis.requiresReauth).toBe(true);
    expect(analysis.reasons[0]).toContain('fd');
  });

  it('flags high-value numeric changes as destructive', () => {
    const state = initializeState();
    state.profile.fiTarget = 1000000;
    const analysis = classifyProposal(state, {
      profile: { fiTarget: 1000000 + HIGH_VALUE_THRESHOLD },
    });
    expect(analysis.requiresReauth).toBe(true);
    expect(analysis.reasons[0]).toContain('profile.fiTarget');
  });

  it('does not flag small non-deleting changes', () => {
    const state = initializeState();
    state.profile.fiTarget = 1000000;
    const analysis = classifyProposal(state, { profile: { fiTarget: 1500000 } });
    expect(analysis.requiresReauth).toBe(false);
    expect(analysis.reasons).toEqual([]);
  });
});

describe('buildCandidate / computeDiff / applyValidatedProposal', () => {
  it('builds a deep candidate and applies in place', () => {
    const state = initializeState();
    state.profile.fiTarget = 1;

    const candidate = buildCandidate(state, { profile: { fiTarget: 2 } });
    expect(candidate.profile.fiTarget).toBe(2);
    expect(state.profile.fiTarget).toBe(1);

    const diff = computeDiff(state, candidate);
    expect(diff).toEqual([{ path: 'profile.fiTarget', before: 1, after: 2 }]);

    applyValidatedProposal(state, { profile: { fiTarget: 3 } });
    expect(state.profile.fiTarget).toBe(3);
    expect(state.profile.age).toBe(candidate.profile.age);
  });
});
