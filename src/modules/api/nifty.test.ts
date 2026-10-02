import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Nifty API fallback proxies', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('authenticates the CorsProxy fallback', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          chart: { result: [{ meta: { regularMarketPrice: 24000, fiftyTwoWeekHigh: 26000 } }] },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_CORSPROXY_API_KEY', 'test-key');

    const { fetchNifty } = await import('./nifty');
    await expect(fetchNifty()).resolves.toEqual({
      level: 24000,
      high52w: 26000,
      source: 'Yahoo Finance API (corsproxy)',
    });

    const [request] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(request).toContain('key=test-key');
  });
});