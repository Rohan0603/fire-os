import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HistoricalSeries } from '../../types/api';
import {
  HISTORY_CACHE_MAX_BYTES,
  HISTORY_CACHE_MAX_ENTRIES,
  HISTORY_CACHE_TTL,
} from '../../types/state';

vi.mock('./nifty', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./nifty')>();
  return { ...actual, fetchNiftyHistory: vi.fn(async () => null) };
});

vi.mock('./mfapi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./mfapi')>();
  return { ...actual, fetchNAVHistory: vi.fn(async () => null) };
});

import * as mfapiAdapter from './mfapi';
import * as niftyAdapter from './nifty';
import { NAV_HISTORY_MAX_POINTS } from './mfapi';
import { NIFTY_HISTORY_MAX_POINTS } from './nifty';
import {
  fetchNAVHistory,
  fetchNiftyHistory,
  getHistoryCacheMap,
  initializeHistoryCache,
  sanitizeHistoryCache,
} from './index';

function makePoints(count: number, start = '2015-01-01') {
  const startMs = Date.parse(start);
  return Array.from({ length: count }, (_, index) => ({
    date: new Date(startMs + index * 86_400_000).toISOString().slice(0, 10),
    value: 100 + index * 0.5,
  }));
}

function makeSeries(
  count: number,
  fetchedAt = new Date().toISOString(),
  start = '2015-01-01',
): HistoricalSeries {
  return { points: makePoints(count, start), source: 'test-provider', fetchedAt, status: 'live' };
}

describe('bounded market history cache', () => {
  beforeEach(() => {
    initializeHistoryCache({});
    vi.mocked(niftyAdapter.fetchNiftyHistory).mockReset().mockResolvedValue(null);
    vi.mocked(mfapiAdapter.fetchNAVHistory).mockReset().mockResolvedValue(null);
  });

  it('pins the history status mapping: live, cache-fresh, stale', async () => {
    vi.mocked(niftyAdapter.fetchNiftyHistory).mockResolvedValue(makeSeries(2));
    expect((await fetchNiftyHistory())?.status).toBe('live');
    expect((await fetchNiftyHistory())?.status).toBe('cache-fresh');

    initializeHistoryCache({
      nifty: makeSeries(2, new Date(Date.now() - HISTORY_CACHE_TTL - 1000).toISOString()),
    });
    vi.mocked(niftyAdapter.fetchNiftyHistory).mockResolvedValue(null);
    expect((await fetchNiftyHistory())?.status).toBe('stale');
  });

  it('serves fresh cached history without calling the provider again', async () => {
    const live = makeSeries(3);
    vi.mocked(niftyAdapter.fetchNiftyHistory).mockResolvedValue(live);

    expect(await fetchNiftyHistory()).toEqual(live);
    const cached = await fetchNiftyHistory();

    expect(cached).toMatchObject({ points: live.points, source: live.source, status: 'cache-fresh' });
    expect(niftyAdapter.fetchNiftyHistory).toHaveBeenCalledTimes(1);
  });

  it('keeps a valid cached series when the provider returns null', async () => {
    const cachedSeries = makeSeries(
      4,
      new Date(Date.now() - HISTORY_CACHE_TTL - 1000).toISOString(),
    );
    initializeHistoryCache({ nifty: cachedSeries });
    vi.mocked(niftyAdapter.fetchNiftyHistory).mockResolvedValue(null);

    const result = await fetchNiftyHistory();

    expect(result?.status).toBe('stale');
    expect(result?.points).toEqual(cachedSeries.points);
    expect(getHistoryCacheMap().nifty).toBeDefined();
    expect(niftyAdapter.fetchNiftyHistory).toHaveBeenCalledTimes(1);
  });

  it('returns null when the provider fails and no cache exists', async () => {
    vi.mocked(mfapiAdapter.fetchNAVHistory).mockResolvedValue(null);
    await expect(fetchNAVHistory('122639')).resolves.toBeNull();
  });

  it('rejects invalid scheme codes without calling the provider', async () => {
    await expect(fetchNAVHistory('')).resolves.toBeNull();
    expect(mfapiAdapter.fetchNAVHistory).not.toHaveBeenCalled();
  });

  it('enforces the per-series point caps on hydrated history', () => {
    initializeHistoryCache({
      nifty: makeSeries(1400),
      'nav:122639': makeSeries(3000),
    });

    const cache = getHistoryCacheMap();
    expect(cache.nifty.points).toHaveLength(NIFTY_HISTORY_MAX_POINTS);
    expect(cache['nav:122639'].points).toHaveLength(NAV_HISTORY_MAX_POINTS);
    const nifty = cache.nifty.points;
    const nav = cache['nav:122639'].points;
    expect(nifty[nifty.length - 1]).toEqual(makePoints(1400)[1399]);
    expect(nav[nav.length - 1]).toEqual(makePoints(3000)[2999]);
  });

  it('caps oversized provider history before caching it', async () => {
    vi.mocked(mfapiAdapter.fetchNAVHistory).mockResolvedValue(makeSeries(3000));

    await fetchNAVHistory('122639');

    expect(getHistoryCacheMap()['nav:122639'].points).toHaveLength(NAV_HISTORY_MAX_POINTS);
  });

  it('returns the sanitized capped series from the provider path', async () => {
    vi.mocked(mfapiAdapter.fetchNAVHistory).mockResolvedValue(makeSeries(3000));

    const result = await fetchNAVHistory('122639');

    expect(result?.points).toHaveLength(NAV_HISTORY_MAX_POINTS);
    expect(result).toEqual(getHistoryCacheMap()['nav:122639']);
  });

  it('returns null when the provider series fails the cache schema', async () => {
    vi.mocked(mfapiAdapter.fetchNAVHistory).mockResolvedValue({
      points: [{ date: '2026-10-01', value: -5 }],
      source: 'api.mfapi.in',
      fetchedAt: new Date().toISOString(),
      status: 'live',
    });

    await expect(fetchNAVHistory('122639')).resolves.toBeNull();
    expect(getHistoryCacheMap()['nav:122639']).toBeUndefined();
  });

  it('keeps only the newest HISTORY_CACHE_MAX_ENTRIES series', () => {
    const oversized = Object.fromEntries(
      Array.from({ length: HISTORY_CACHE_MAX_ENTRIES + 4 }, (_, index) => [
        `nav:${1000 + index}`,
        makeSeries(5, new Date(Date.parse('2026-01-01T00:00:00Z') + index * 1000).toISOString()),
      ]),
    );

    initializeHistoryCache(oversized);

    const cache = getHistoryCacheMap();
    expect(Object.keys(cache)).toHaveLength(HISTORY_CACHE_MAX_ENTRIES);
    expect(cache['nav:1000']).toBeUndefined();
    expect(cache[`nav:${1000 + HISTORY_CACHE_MAX_ENTRIES + 3}`]).toBeDefined();
  });

  it('keeps the serialized history within the byte budget', () => {
    const oversized = Object.fromEntries(
      Array.from({ length: 5 }, (_, index) => [
        `nav:${2000 + index}`,
        makeSeries(NAV_HISTORY_MAX_POINTS, new Date(Date.parse('2026-01-01T00:00:00Z') + index * 1000).toISOString()),
      ]),
    );

    initializeHistoryCache(oversized);

    const cache = getHistoryCacheMap();
    expect(JSON.stringify(cache).length).toBeLessThanOrEqual(HISTORY_CACHE_MAX_BYTES);
    expect(Object.keys(cache).length).toBeLessThan(5);
  });

  it('drops malformed cache entries instead of serving them', () => {
    const cleaned = sanitizeHistoryCache({
      nifty: makeSeries(3),
      broken: {
        points: 'nope',
        source: 1,
        fetchedAt: 'not-a-date',
        status: 'live',
      } as never,
    });

    expect(cleaned.nifty).toBeDefined();
    expect(cleaned.broken).toBeUndefined();
  });

  it('caches distinct request ranges under distinct keys', async () => {
    vi.mocked(niftyAdapter.fetchNiftyHistory).mockResolvedValue(makeSeries(5));

    await fetchNiftyHistory({ start: '2026-01-01', end: '2026-10-04' });
    await fetchNiftyHistory();

    expect(niftyAdapter.fetchNiftyHistory).toHaveBeenCalledTimes(2);
    expect(Object.keys(getHistoryCacheMap())).toHaveLength(2);
  });
});
