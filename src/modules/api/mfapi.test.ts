import { afterEach, describe, expect, it, vi } from 'vitest';

describe('NAV cache provenance', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.useRealTimers();
  });

  it('marks API values live and expired values stale', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T00:00:00.000Z'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ data: [{ date: '03-10-2026', nav: '125.5' }] }),
    }));

    const { fetchNAV, getNAVCacheMap } = await import('./mfapi');
    await expect(fetchNAV('123')).resolves.toBe(125.5);
    expect(getNAVCacheMap()['123']).toMatchObject({
      source: 'api.mfapi.in',
      status: 'cache-fresh',
    });

    vi.setSystemTime(new Date('2026-10-04T00:00:00.000Z'));
    expect(getNAVCacheMap()['123'].status).toBe('stale');
  });

  it('marks manually seeded values manual', async () => {
    const { setCachedNAV, getNAVCacheMap } = await import('./mfapi');
    setCachedNAV('123', 125.5);

    expect(getNAVCacheMap()['123']).toMatchObject({
      source: 'manual',
      status: 'manual',
    });
  });
});