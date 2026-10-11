import { afterEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe('currency conversion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses the Worker market exchange rate', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ rate: 102.5 }));
    vi.stubGlobal('fetch', fetchMock);

    const { convertCurrency } = await import('./currency');
    await expect(convertCurrency(2, 'EUR', 'INR')).resolves.toBe(205);

    const [request] = fetchMock.mock.calls[0] as [string];
    const url = String(request);
    expect(url).toContain('/api/market/currency');
    expect(url).toContain('from=EUR');
    expect(url).toContain('to=INR');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('returns null when the market endpoint is unreachable or invalid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const offline = await import('./currency');
    await expect(offline.convertCurrency(1, 'EUR', 'INR')).resolves.toBeNull();

    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ rate: 'nope' })));
    const badData = await import('./currency');
    await expect(badData.convertCurrency(1, 'EUR', 'INR')).resolves.toBeNull();
  });

  it('accepts valid non-EUR currency pairs and rejects unknown codes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ rate: 83.25 }));
    vi.stubGlobal('fetch', fetchMock);

    const { convertCurrency } = await import('./currency');
    await expect(convertCurrency(2, 'GBP', 'INR')).resolves.toBe(166.5);
    await expect(convertCurrency(2, 'ZZZ', 'INR')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('GBP');
  });

  it('reports the Yahoo Finance source in the rate cache', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ rate: 102.5 })));

    const { fetchCurrencyRate, getCachedCurrencyRate } = await import('./currency');
    await expect(fetchCurrencyRate('EUR', 'INR')).resolves.toBe(102.5);
    expect(getCachedCurrencyRate('EUR', 'INR')).toMatchObject({
      source: 'Yahoo Finance',
      status: 'cache-fresh',
    });
  });
});
