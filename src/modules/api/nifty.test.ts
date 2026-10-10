import { afterEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('Nifty market endpoint', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('fetches level and 52-week high from the Worker market endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ level: 24000, high52w: 26000, source: 'Yahoo Finance' })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { fetchNifty } = await import('./nifty');
    await expect(fetchNifty()).resolves.toMatchObject({
      level: 24000,
      high52w: 26000,
      source: 'Yahoo Finance',
      status: 'live',
    });

    const [request] = fetchMock.mock.calls[0] as [string];
    expect(request).toContain('/api/market/nifty');
  });

  it('falls back to the level when the Worker omits a 52-week high', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ level: 24000 })));

    const { fetchNifty } = await import('./nifty');
    await expect(fetchNifty()).resolves.toMatchObject({ level: 24000, high52w: 24000 });
  });

  it('returns null when the Worker is unreachable or returns unusable data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const offline = await import('./nifty');
    await expect(offline.fetchNifty()).resolves.toBeNull();

    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false, 502)));
    const httpError = await import('./nifty');
    await expect(httpError.fetchNifty()).resolves.toBeNull();

    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ level: 'nope' })));
    const badData = await import('./nifty');
    await expect(badData.fetchNifty()).resolves.toBeNull();
  });
});

describe('Nifty history from the Worker market endpoint', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  function pointsPayload(points: unknown) {
    return { points };
  }

  function stubWorker(points: unknown, ok = true, status = 200) {
    return vi.fn().mockResolvedValue(jsonResponse(pointsPayload(points), ok, status));
  }

  it('sorts, validates and returns the series', async () => {
    const fetchMock = stubWorker([
      { date: '2026-10-03', value: 126 },
      { date: '2026-10-01', value: 124 },
      { date: '2026-10-02', value: 125 },
    ]);
    vi.stubGlobal('fetch', fetchMock);

    const { fetchNiftyHistory } = await import('./nifty');
    const series = await fetchNiftyHistory();

    expect(series).toMatchObject({ source: 'Yahoo Finance', status: 'live' });
    expect(series!.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(series!.points).toEqual([
      { date: '2026-10-01', value: 124 },
      { date: '2026-10-02', value: 125 },
      { date: '2026-10-03', value: 126 },
    ]);

    const [request] = fetchMock.mock.calls[0] as [string];
    expect(decodeURIComponent(request)).toContain('/api/market/nifty');
  });

  it('keeps the first valid record when a date repeats', async () => {
    vi.stubGlobal('fetch', stubWorker([
      { date: '2026-10-01', value: 124 },
      { date: '2026-10-01', value: 555 },
    ]));

    const { fetchNiftyHistory } = await import('./nifty');
    const series = await fetchNiftyHistory();

    expect(series!.points).toEqual([{ date: '2026-10-01', value: 124 }]);
  });

  it('drops malformed points and keeps the valid ones', async () => {
    vi.stubGlobal('fetch', stubWorker([
      { date: '2026-10-04', value: 127 },
      { date: '2026-10-03', value: null },
      { date: '2026-10-02', value: NaN },
      { date: '2026-10-05', value: 0 },
      { date: 'bad-date', value: 128 },
      { date: '2026-10-07', value: 128 },
      'not-an-object',
    ]));

    const { fetchNiftyHistory } = await import('./nifty');
    const series = await fetchNiftyHistory();

    expect(series!.points).toEqual([
      { date: '2026-10-04', value: 127 },
      { date: '2026-10-07', value: 128 },
    ]);
  });

  it('returns null when the payload has no usable series', async () => {
    const payloads = [undefined, null, [], 'nope', [{ date: 'nope', value: 1 }]];

    for (const points of payloads) {
      vi.resetModules();
      vi.stubGlobal('fetch', stubWorker(points));
      const { fetchNiftyHistory } = await import('./nifty');
      await expect(fetchNiftyHistory()).resolves.toBeNull();
    }
  });

  it('keeps sparse provider gaps without inventing dates', async () => {
    vi.stubGlobal('fetch', stubWorker([
      { date: '2026-10-01', value: 124 },
      { date: '2026-10-04', value: 125 },
      { date: '2026-10-14', value: 130 },
    ]));

    const { fetchNiftyHistory } = await import('./nifty');
    const series = await fetchNiftyHistory();

    expect(series!.points.map((point) => point.date)).toEqual([
      '2026-10-01',
      '2026-10-04',
      '2026-10-14',
    ]);
  });

  it('rejects an invalid range before any request', async () => {
    const fetchMock = stubWorker([{ date: '2026-10-03', value: 150 }]);
    vi.stubGlobal('fetch', fetchMock);

    const { fetchNiftyHistory } = await import('./nifty');
    await expect(fetchNiftyHistory({ start: '2026-10-04', end: '2026-10-02' })).resolves.toBeNull();
    await expect(fetchNiftyHistory({ start: '2026-13-01', end: '2026-10-02' })).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('filters inclusively to the requested window', async () => {
    vi.stubGlobal('fetch', stubWorker([
      { date: '2026-10-01', value: 124 },
      { date: '2026-10-02', value: 125 },
      { date: '2026-10-03', value: 126 },
      { date: '2026-10-04', value: 127 },
      { date: '2026-10-05', value: 128 },
    ]));

    const { fetchNiftyHistory } = await import('./nifty');
    const series = await fetchNiftyHistory({ start: '2026-10-02', end: '2026-10-04' });

    expect(series!.points.map((point) => point.date)).toEqual([
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
  });

  it('clamps requests older than the five-year window', async () => {
    vi.stubGlobal('fetch', stubWorker([
      { date: '2019-06-01', value: 90 },
      { date: '2021-10-03', value: 100 },
      { date: '2021-10-04', value: 101 },
      { date: '2026-10-03', value: 150 },
    ]));

    const { fetchNiftyHistory } = await import('./nifty');
    const series = await fetchNiftyHistory({ start: '2015-01-01', end: '2026-10-03' });

    expect(series!.points).toEqual([
      { date: '2021-10-03', value: 100 },
      { date: '2021-10-04', value: 101 },
      { date: '2026-10-03', value: 150 },
    ]);
  });

  it('returns null when the requested window does not overlap provider data', async () => {
    const fetchMock = stubWorker([{ date: '2026-10-03', value: 150 }]);
    vi.stubGlobal('fetch', fetchMock);

    const { fetchNiftyHistory } = await import('./nifty');
    const series = await fetchNiftyHistory({ start: '2019-01-01', end: '2019-12-31' });

    expect(series).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caps oversized series keeping the newest points', async () => {
    const points: Array<{ date: string; value: number }> = [];
    for (let i = 0; i < 1300; i++) {
      const date = new Date(Date.UTC(2026, 9, 3) - i * 86400000).toISOString().slice(0, 10);
      points.push({ date, value: 100 + i });
    }
    vi.stubGlobal('fetch', stubWorker(points));

    const { fetchNiftyHistory, NIFTY_HISTORY_MAX_POINTS } = await import('./nifty');
    const series = await fetchNiftyHistory();

    expect(NIFTY_HISTORY_MAX_POINTS).toBe(1260);
    expect(series!.points).toHaveLength(1260);
    expect(series!.points[series!.points.length - 1]).toEqual({ date: '2026-10-03', value: 100 });
  });

  it('returns null on network failure or an error response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const offline = await import('./nifty');
    await expect(offline.fetchNiftyHistory()).resolves.toBeNull();

    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false, 502)));
    const httpError = await import('./nifty');
    await expect(httpError.fetchNiftyHistory()).resolves.toBeNull();
  });
});
