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

describe('NAV history normalization', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  function stubNavResponse(data: unknown) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ status: 'SUCCESS', data }),
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  function mfapiDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return `${day}-${month}-${year}`;
  }

  it('sorts newest-first provider records into ascending dated points', async () => {
    stubNavResponse([
      { date: '03-10-2026', nav: '126.5' },
      { date: '01-10-2026', nav: '124.5' },
      { date: '02-10-2026', nav: '125.5' },
    ]);

    const { fetchNAVHistory } = await import('./mfapi');
    const series = await fetchNAVHistory('122639');

    expect(series).toMatchObject({ source: 'api.mfapi.in', status: 'live' });
    expect(series!.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(series!.points).toEqual([
      { date: '2026-10-01', value: 124.5 },
      { date: '2026-10-02', value: 125.5 },
      { date: '2026-10-03', value: 126.5 },
    ]);
  });

  it('keeps the first provider record when a date repeats', async () => {
    stubNavResponse([
      { date: '03-10-2026', nav: '126.5' },
      { date: '02-10-2026', nav: '125.5' },
      { date: '02-10-2026', nav: '999' },
      { date: '01-10-2026', nav: '124.5' },
    ]);

    const { fetchNAVHistory } = await import('./mfapi');
    const series = await fetchNAVHistory('122639');

    expect(series!.points).toEqual([
      { date: '2026-10-01', value: 124.5 },
      { date: '2026-10-02', value: 125.5 },
      { date: '2026-10-03', value: 126.5 },
    ]);
  });

  it('drops malformed records and keeps the valid ones', async () => {
    stubNavResponse([
      { date: '05-10-2026', nav: '128' },
      { date: '04-10-2026', nav: 'abc' },
      { date: '04-10-2026', nav: '127.5' },
      { date: '31-02-2026', nav: '120' },
      { date: '03-10-2026', nav: '-5' },
      { date: '02-10-2026', nav: '' },
      { date: 'garbage', nav: '121' },
      { date: '01-10-2026' },
      { nav: '122' },
      null,
      { date: '01-10-2026', nav: '124.5' },
    ]);

    const { fetchNAVHistory } = await import('./mfapi');
    const series = await fetchNAVHistory('122639');

    expect(series!.points).toEqual([
      { date: '2026-10-01', value: 124.5 },
      { date: '2026-10-04', value: 127.5 },
      { date: '2026-10-05', value: 128 },
    ]);
  });

  it('returns null for an empty data array', async () => {
    stubNavResponse([]);
    const { fetchNAVHistory } = await import('./mfapi');
    await expect(fetchNAVHistory('123')).resolves.toBeNull();
  });

  it('returns null when the payload has no data field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ status: 'NOT_FOUND' }),
    }));

    const { fetchNAVHistory } = await import('./mfapi');
    await expect(fetchNAVHistory('123')).resolves.toBeNull();
  });

  it('returns null when every record is malformed', async () => {
    stubNavResponse([{ date: 'nope', nav: 'x' }, { date: '01-10-2026', nav: 'NaN' }]);
    const { fetchNAVHistory } = await import('./mfapi');
    await expect(fetchNAVHistory('123')).resolves.toBeNull();
  });

  it('returns null when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const { fetchNAVHistory } = await import('./mfapi');
    await expect(fetchNAVHistory('123')).resolves.toBeNull();
  });

  it('returns null for a missing scheme code without requesting', async () => {
    const fetchMock = stubNavResponse([]);
    const { fetchNAVHistory } = await import('./mfapi');
    await expect(fetchNAVHistory('')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps sparse provider gaps without inventing dates', async () => {
    stubNavResponse([
      { date: '15-10-2026', nav: '130' },
      { date: '05-10-2026', nav: '128' },
      { date: '01-10-2026', nav: '124.5' },
    ]);

    const { fetchNAVHistory } = await import('./mfapi');
    const series = await fetchNAVHistory('122639');

    expect(series!.points).toHaveLength(3);
    expect(series!.points.map((point) => point.date)).toEqual([
      '2026-10-01',
      '2026-10-05',
      '2026-10-15',
    ]);
  });

  it('rejects invalid ranges before any request', async () => {
    const fetchMock = stubNavResponse([]);
    const { fetchNAVHistory } = await import('./mfapi');

    for (const range of [
      { start: '2026-10-05', end: '2026-10-01' },
      { start: '2026-10-32', end: '2026-11-01' },
      { start: 'garbage', end: '2026-10-01' },
      { start: '2026-10-01', end: '2026-99-01' },
    ]) {
      await expect(fetchNAVHistory('123', range)).resolves.toBeNull();
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('filters inclusively to the requested window', async () => {
    stubNavResponse([
      { date: '05-10-2026', nav: '128' },
      { date: '04-10-2026', nav: '127.5' },
      { date: '03-10-2026', nav: '126.5' },
      { date: '02-10-2026', nav: '125.5' },
      { date: '01-10-2026', nav: '124.5' },
    ]);

    const { fetchNAVHistory } = await import('./mfapi');
    const series = await fetchNAVHistory('122639', { start: '2026-10-02', end: '2026-10-04' });

    expect(series!.points.map((point) => point.date)).toEqual([
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
  });

  it('bounds ranges wider than provider coverage and returns null without overlap', async () => {
    stubNavResponse([
      { date: '03-10-2026', nav: '126.5' },
      { date: '02-10-2026', nav: '125.5' },
      { date: '01-10-2026', nav: '124.5' },
    ]);

    const { fetchNAVHistory } = await import('./mfapi');

    const bounded = await fetchNAVHistory('122639', { start: '2010-01-01', end: '2026-10-03' });
    expect(bounded!.points).toHaveLength(3);

    const noOverlap = await fetchNAVHistory('122639', { start: '2027-01-01', end: '2027-12-31' });
    expect(noOverlap).toBeNull();
  });

  it('caps oversized series keeping the newest points', async () => {
    const newest = Date.UTC(2026, 9, 3);
    const rows = Array.from({ length: 2600 }, (_, index) => ({
      date: mfapiDate(new Date(newest - index * 86400000).toISOString().slice(0, 10)),
      nav: String(100 + index),
    }));
    stubNavResponse(rows);

    const { fetchNAVHistory, NAV_HISTORY_MAX_POINTS } = await import('./mfapi');
    const series = await fetchNAVHistory('122639');

    expect(NAV_HISTORY_MAX_POINTS).toBe(2520);
    expect(series!.points).toHaveLength(2520);
    expect(series!.points[0]).toEqual({
      date: new Date(newest - 2519 * 86400000).toISOString().slice(0, 10),
      value: 2619,
    });
    expect(series!.points[2519]).toEqual({ date: '2026-10-03', value: 100 });
  });
});