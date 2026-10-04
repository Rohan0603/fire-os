import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HISTORY_CACHE_TTL } from '../types/state';

vi.mock('../modules/api/nifty', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../modules/api/nifty')>();
  return { ...actual, fetchNiftyHistory: vi.fn(async () => null) };
});

vi.mock('../modules/api/mfapi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../modules/api/mfapi')>();
  return { ...actual, fetchNAVHistory: vi.fn(async () => null) };
});

import * as mfapiAdapter from '../modules/api/mfapi';
import * as niftyAdapter from '../modules/api/nifty';
import { fetchNAVHistory, fetchNiftyHistory, initializeHistoryCache } from '../modules/api';
import { createFeaturePorts } from './feature-ports';

describe('market history feature ports', () => {
  beforeEach(() => {
    initializeHistoryCache({});
    vi.mocked(niftyAdapter.fetchNiftyHistory).mockReset().mockResolvedValue(null);
    vi.mocked(mfapiAdapter.fetchNAVHistory).mockReset().mockResolvedValue(null);
  });

  it('exposes the cached history adapters under the Task 1 signatures', () => {
    const ports = createFeaturePorts();
    expect(ports.marketData.fetchNiftyHistory).toBe(fetchNiftyHistory);
    expect(ports.marketData.fetchNAVHistory).toBe(fetchNAVHistory);
  });

  it('forwards range and scheme arguments to the Task 1 adapters', async () => {
    const range = { start: '2026-01-01', end: '2026-10-04' };
    const ports = createFeaturePorts();

    await ports.marketData.fetchNiftyHistory(range);
    await ports.marketData.fetchNAVHistory('122639', range);
    await ports.marketData.fetchNAVHistory('999999');

    expect(niftyAdapter.fetchNiftyHistory).toHaveBeenCalledTimes(1);
    expect(niftyAdapter.fetchNiftyHistory).toHaveBeenCalledWith(range);
    expect(mfapiAdapter.fetchNAVHistory).toHaveBeenCalledTimes(2);
    expect(mfapiAdapter.fetchNAVHistory).toHaveBeenNthCalledWith(1, '122639', range);
    expect(mfapiAdapter.fetchNAVHistory).toHaveBeenNthCalledWith(2, '999999', undefined);
  });

  it('serves hydrated history through the port with cache-fresh status', async () => {
    initializeHistoryCache({
      nifty: {
        points: [{ date: '2026-10-01', value: 25000 }],
        source: 'Yahoo Finance API (corsproxy)',
        fetchedAt: new Date().toISOString(),
        status: 'live',
      },
    });
    const ports = createFeaturePorts();

    const result = await ports.marketData.fetchNiftyHistory();

    expect(result).toMatchObject({ status: 'cache-fresh', points: [{ date: '2026-10-01', value: 25000 }] });
    expect(niftyAdapter.fetchNiftyHistory).not.toHaveBeenCalled();
  });

  it('falls back to expired hydrated history with stale status', async () => {
    initializeHistoryCache({
      'nav:122639': {
        points: [{ date: '2026-10-01', value: 150.25 }],
        source: 'api.mfapi.in',
        fetchedAt: new Date(Date.now() - HISTORY_CACHE_TTL - 1000).toISOString(),
        status: 'live',
      },
    });
    vi.mocked(mfapiAdapter.fetchNAVHistory).mockResolvedValue(null);
    const ports = createFeaturePorts();

    const result = await ports.marketData.fetchNAVHistory('122639');

    expect(result?.status).toBe('stale');
    expect(mfapiAdapter.fetchNAVHistory).toHaveBeenCalledTimes(1);
  });
});
