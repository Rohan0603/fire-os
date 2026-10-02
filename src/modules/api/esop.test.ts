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
      fetchStockQuote('NSE: AAA'),
      fetchStockQuote('AAA.NS'),
    ]);
    const third = await fetchStockQuote('AAA.NS');

    expect(first).toEqual({ price: 42.5, currency: 'EUR' });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('values multiple holdings without relying on a specific employer or symbol', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chart: { result: [{ meta: { regularMarketPrice: 100, currency: 'INR' } }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          chart: { result: [{ meta: { regularMarketPrice: 250, currency: 'INR' } }] },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
    vi.stubEnv('VITE_CORSPROXY_API_KEY', 'test-key');

    const { fetchEsopValuations } = await import('./esop');
    const results = await fetchEsopValuations([
      { name: 'First Grant', symbol: 'NSE: AAA', quantity: 2, currency: 'INR' },
      { name: 'Second Grant', symbol: 'NSE: BBB', quantity: 3, currency: 'INR' },
    ]);

    expect(results.map(({ value }) => value)).toEqual([200, 750]);
    expect(results.reduce((total, { value }) => total + (value ?? 0), 0)).toBe(950);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});