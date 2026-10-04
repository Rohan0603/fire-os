import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Nifty API fallback proxies', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('authenticates the CorsProxy fallback', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          chart: { result: [{ meta: { regularMarketPrice: 24000, fiftyTwoWeekHigh: 26000 } }] },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_CORSPROXY_API_KEY', 'test-key');

    const { fetchNifty } = await import('./nifty');
    await expect(fetchNifty()).resolves.toMatchObject({
      level: 24000,
      high52w: 26000,
      source: 'Yahoo Finance API (corsproxy)',
      status: 'live',
    });

    const [request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request).toContain('key=test-key');
  });
});

describe('Nifty history normalization', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  function epochSeconds(isoDate: string): number {
    return Date.parse(`${isoDate}T12:00:00.000Z`) / 1000;
  }

  function chartPayload(timestamps: unknown[], closes: unknown[]) {
    return {
      chart: {
        result: [
          {
            meta: { regularMarketPrice: 25000, fiftyTwoWeekHigh: 26000 },
            timestamp: timestamps,
            indicators: { quote: [{ close: closes }] },
          },
        ],
      },
    };
  }

  function stubYahoo(payload: unknown, corsproxyKey = 'test-key') {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_CORSPROXY_API_KEY', corsproxyKey);
    return fetchMock;
  }

  it('requests the five-year daily window and sorts out-of-order timestamps ascending', async () => {
    const fetchMock = stubYahoo(chartPayload(
      [epochSeconds('2026-10-03'), epochSeconds('2026-10-01'), epochSeconds('2026-10-02')],
      [126, 124, 125],
    ));

    const { fetchNiftyHistory } = await import('./nifty');
    const series = await fetchNiftyHistory();

    expect(series).toMatchObject({ source: 'Yahoo Finance API (corsproxy)', status: 'live' });
    expect(series!.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(series!.points).toEqual([
      { date: '2026-10-01', value: 124 },
      { date: '2026-10-02', value: 125 },
      { date: '2026-10-03', value: 126 },
    ]);

    const [request] = fetchMock.mock.calls[0] as [string];
    expect(decodeURIComponent(request)).toContain('range=5y');
    expect(decodeURIComponent(request)).toContain('interval=1d');
  });

  it('keeps the first provider record when a date repeats', async () => {
    stubYahoo(chartPayload(
      [epochSeconds('2026-10-01'), epochSeconds('2026-10-01') + 3600],
      [124, 555],
    ));

    const { fetchNiftyHistory } = await import('./nifty');
    const series = await fetchNiftyHistory();

    expect(series!.points).toEqual([{ date: '2026-10-01', value: 124 }]);
  });

  it('drops malformed points and keeps the valid ones', async () => {
    stubYahoo(chartPayload(
      [
        epochSeconds('2026-10-04'),
        epochSeconds('2026-10-03'),
        'bad-timestamp',
        epochSeconds('2026-10-02'),
        epochSeconds('2026-10-01'),
        epochSeconds('2026-10-05'),
        epochSeconds('2026-10-06'),
        epochSeconds('2026-10-07'),
      ],
      [127, null, 126, NaN, 0, -3, 'x', 128],
    ));

    const { fetchNiftyHistory } = await import('./nifty');
    const series = await fetchNiftyHistory();

    expect(series!.points).toEqual([
      { date: '2026-10-04', value: 127 },
      { date: '2026-10-07', value: 128 },
    ]);
  });

  it('ignores records beyond the shortest provider array', async () => {
    stubYahoo(chartPayload(
      [epochSeconds('2026-10-01'), epochSeconds('2026-10-02'), epochSeconds('2026-10-03')],
      [124],
    ));

    const { fetchNiftyHistory } = await import('./nifty');
    const series = await fetchNiftyHistory();

    expect(series!.points).toEqual([{ date: '2026-10-01', value: 124 }]);
  });

  it('returns null when the chart payload has no usable series', async () => {
    const payloads = [
      { chart: { result: [] } },
      { chart: {} },
      { chart: { result: [{ meta: { regularMarketPrice: 25000 } }] } },
      chartPayload([], []),
      { chart: { result: [null] } },
    ];

    for (const payload of payloads) {
      vi.resetModules();
      stubYahoo(payload);
      const { fetchNiftyHistory } = await import('./nifty');
      await expect(fetchNiftyHistory()).resolves.toBeNull();
    }
  });

  it('keeps sparse provider gaps without inventing dates', async () => {
    stubYahoo(chartPayload(
      [epochSeconds('2026-10-01'), epochSeconds('2026-10-04'), epochSeconds('2026-10-14')],
      [124, 125, 130],
    ));

    const { fetchNiftyHistory } = await import('./nifty');
    const series = await fetchNiftyHistory();

    expect(series!.points.map((point) => point.date)).toEqual([
      '2026-10-01',
      '2026-10-04',
      '2026-10-14',
    ]);
  });

  it('rejects invalid ranges before any request', async () => {
    const fetchMock = stubYahoo({});
    const { fetchNiftyHistory } = await import('./nifty');

    for (const range of [
      { start: '2026-10-05', end: '2026-10-01' },
      { start: '2026-13-01', end: '2026-12-01' },
      { start: 'nope', end: '2026-10-01' },
    ]) {
      await expect(fetchNiftyHistory(range)).resolves.toBeNull();
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('filters inclusively to the requested window', async () => {
    stubYahoo(chartPayload(
      [
        epochSeconds('2026-10-01'),
        epochSeconds('2026-10-02'),
        epochSeconds('2026-10-03'),
        epochSeconds('2026-10-04'),
        epochSeconds('2026-10-05'),
      ],
      [124, 125, 126, 127, 128],
    ));

    const { fetchNiftyHistory } = await import('./nifty');
    const series = await fetchNiftyHistory({ start: '2026-10-02', end: '2026-10-04' });

    expect(series!.points.map((point) => point.date)).toEqual([
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
  });

  it('clamps requests older than the five-year provider window', async () => {
    stubYahoo(chartPayload(
      [
        epochSeconds('2019-06-01'),
        epochSeconds('2021-10-03'),
        epochSeconds('2021-10-04'),
        epochSeconds('2026-10-03'),
      ],
      [90, 100, 101, 150],
    ));

    const { fetchNiftyHistory } = await import('./nifty');
    const series = await fetchNiftyHistory({ start: '2015-01-01', end: '2026-10-03' });

    expect(series!.points).toEqual([
      { date: '2021-10-03', value: 100 },
      { date: '2021-10-04', value: 101 },
      { date: '2026-10-03', value: 150 },
    ]);
  });

  it('returns null when the requested window does not overlap provider data', async () => {
    const fetchMock = stubYahoo(chartPayload([epochSeconds('2026-10-03')], [150]));

    const { fetchNiftyHistory } = await import('./nifty');
    const series = await fetchNiftyHistory({ start: '2019-01-01', end: '2019-12-31' });

    expect(series).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caps oversized series keeping the newest points', async () => {
    const end = Date.UTC(2026, 9, 3);
    const timestamps: number[] = [];
    const closes: number[] = [];
    for (let i = 0; i < 1300; i++) {
      timestamps.push((end - i * 86400000) / 1000);
      closes.push(100 + i);
    }
    stubYahoo(chartPayload(timestamps, closes));

    const { fetchNiftyHistory, NIFTY_HISTORY_MAX_POINTS } = await import('./nifty');
    const series = await fetchNiftyHistory();

    expect(NIFTY_HISTORY_MAX_POINTS).toBe(1260);
    expect(series!.points).toHaveLength(1260);
    expect(series!.points[0]).toEqual({
      date: '2023-04-23',
      value: 1359,
    });
    expect(series!.points[1259]).toEqual({ date: '2026-10-03', value: 100 });
  });

  it('returns null without a corsproxy key or when the request fails', async () => {
    const noKeyFetch = stubYahoo(chartPayload([epochSeconds('2026-10-03')], [150]), '');
    const { fetchNiftyHistory } = await import('./nifty');
    await expect(fetchNiftyHistory()).resolves.toBeNull();
    expect(noKeyFetch).not.toHaveBeenCalled();

    vi.resetModules();
    vi.stubEnv('VITE_CORSPROXY_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const offline = await import('./nifty');
    await expect(offline.fetchNiftyHistory()).resolves.toBeNull();

    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({}) }));
    const httpError = await import('./nifty');
    await expect(httpError.fetchNiftyHistory()).resolves.toBeNull();
  });

  it('derives UTC calendar dates at day boundaries', async () => {
    stubYahoo(chartPayload([1751327999, 1751328000], [25000.5, 25010.25]));

    const { fetchNiftyHistory } = await import('./nifty');
    const series = await fetchNiftyHistory();

    expect(series!.points).toEqual([
      { date: '2025-06-30', value: 25000.5 },
      { date: '2025-07-01', value: 25010.25 },
    ]);
  });

  it('keeps a valid close when an earlier same-date entry is invalid', async () => {
    stubYahoo(chartPayload(
      [epochSeconds('2026-10-01'), epochSeconds('2026-10-01')],
      [null, 124],
    ));

    const { fetchNiftyHistory } = await import('./nifty');
    const series = await fetchNiftyHistory();

    expect(series!.points).toEqual([{ date: '2026-10-01', value: 124 }]);
  });
});