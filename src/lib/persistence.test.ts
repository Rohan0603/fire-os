import { describe, expect, it, vi } from 'vitest';
import { buildEnvelopeFromState, mergeEnvelopes } from './merge';
import { SyncCoordinator } from './syncCoordinator';
import { initializeState } from '../types/state';
import { isPortfolioEnvelope } from '../types/firebase';

const client = { clientId: 'test-client', lastWriteId: 'write-1' };

describe('portfolio persistence contracts', () => {
  it('rejects malformed envelopes at the runtime boundary', () => {
    expect(isPortfolioEnvelope({ schemaVersion: 'fireOS_v3' })).toBe(false);
    expect(isPortfolioEnvelope({
      schemaVersion: 'fireOS_v3',
      lastSavedAt: 'not-a-date',
      data: {},
    })).toBe(false);
    const valid = buildEnvelopeFromState(initializeState(), client, '2025-01-01T00:00:00.000Z');
    expect(isPortfolioEnvelope({ ...valid, data: { ...valid.data, unknownField: true } })).toBe(false);
    expect(isPortfolioEnvelope({ ...valid, data: { ...valid.data, niftyHigh: Number.NaN } })).toBe(false);
    expect(isPortfolioEnvelope({ ...valid, client: { platform: 'cordova' } })).toBe(false);
  });

  it('retains clocks for sections unchanged since the previous envelope', () => {
    const state = initializeState();
    const previous = buildEnvelopeFromState(state, client, '2025-01-01T00:00:00.000Z');
    const next = buildEnvelopeFromState(state, client, '2025-01-02T00:00:00.000Z', previous);

    expect(next.sectionUpdatedAt?.profile).toBe('2025-01-01T00:00:00.000Z');
    expect(next.lastSavedAt).toBe('2025-01-02T00:00:00.000Z');
  });

  it('resolves equal timestamps with the client tie-breaker', () => {
    const state = initializeState();
    state.profile.name = 'local';
    const local = buildEnvelopeFromState(state, { clientId: 'z-client' }, '2025-01-01T00:00:00.000Z');
    state.profile.name = 'remote';
    const remote = buildEnvelopeFromState(state, { clientId: 'a-client' }, '2025-01-01T00:00:00.000Z');

    expect(mergeEnvelopes(local, remote).envelope.data.profile?.name).toBe('local');
  });

  it('coalesces pending writes before flush', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const coordinator = new SyncCoordinator({ uid: 'user-1', save, debounceMs: 60_000, initialOnline: true });
    const state = initializeState();
    const first = buildEnvelopeFromState(state, client, '2025-01-01T00:00:00.000Z');
    state.profile.name = 'latest';
    const latest = buildEnvelopeFromState(state, client, '2025-01-02T00:00:00.000Z', first);

    coordinator.markDirty(first);
    coordinator.markDirty(latest);
    await coordinator.flush();

    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith('user-1', latest);
    coordinator.dispose();
  });
});