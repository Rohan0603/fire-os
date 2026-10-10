import { afterEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('ESOP stock quote cache', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('coalesces concurrent requests and reuses the cached quote', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ price: 42.5, currency: 'EUR' }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });

    const { fetchStockQuote } = await import('./esop');
    const [first, second] = await Promise.all([
      fetchStockQuote('NSE: AAA'),
      fetchStockQuote('NSE: AAA'),
    ]);
    const third = await fetchStockQuote('NSE: AAA');

    expect(first).toEqual({ price: 42.5, currency: 'EUR' });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/market/quote');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('AAA.NS');
  });

  it('values multiple holdings with quotes from the market endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ price: 100, currency: 'INR' }))
      .mockResolvedValueOnce(jsonResponse({ price: 250, currency: 'INR' }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });

    const { fetchEsopValuations } = await import('./esop');
    const results = await fetchEsopValuations([
      { name: 'First Grant', symbol: 'NSE: AAA', quantity: 2, currency: 'INR' },
      { name: 'Second Grant', symbol: 'NSE: BBB', quantity: 3, currency: 'INR' },
    ]);

    expect(results.map(({ value }) => value)).toEqual([200, 750]);
    expect(results.reduce((total, { value }) => total + (value ?? 0), 0)).toBe(950);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null when the quote endpoint fails or returns invalid data', async () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false, 502)));

    const { fetchStockQuote } = await import('./esop');
    await expect(fetchStockQuote('NSE: AAA')).resolves.toBeNull();
  });
});
