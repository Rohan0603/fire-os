import { afterEach, describe, expect, it, vi } from 'vitest';

describe('ESOP stock quote cache', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('coalesces concurrent requests and reuses the cached quote', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        chart: { result: [{ meta: { regularMarketPrice: 42.5, currency: 'EUR' } }] },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
    vi.stubEnv('VITE_CORSPROXY_API_KEY', 'test-key');

    const { fetchStockQuote } = await import('./esop');
    const [first, second] = await Promise.all([
      fetchStockQuote('EPA: GLE'),
      fetchStockQuote('GLE.PA'),
    ]);
    const third = await fetchStockQuote('GLE.PA');

    expect(first).toEqual({ price: 42.5, currency: 'EUR' });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});