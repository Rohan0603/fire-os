import { afterEach, describe, expect, it, vi } from 'vitest';

describe('currency conversion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses authenticated Yahoo Finance proxy data', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        chart: { result: [{ meta: { regularMarketPrice: 102.5 } }] },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_CORSPROXY_API_KEY', 'test-key');

    const { convertCurrency } = await import('./currency');
    await expect(convertCurrency(2, 'EUR', 'INR')).resolves.toBe(205);

    const [request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request).toContain('key=test-key');
    expect(request).toContain(encodeURIComponent(encodeURIComponent('EURINR=X')));
  });

  it('does not make an unauthenticated browser request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_CORSPROXY_API_KEY', '');

    const { convertCurrency } = await import('./currency');
    await expect(convertCurrency(1, 'EUR', 'INR')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts valid non-EUR currency pairs and rejects unknown codes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ chart: { result: [{ meta: { regularMarketPrice: 83.25 } }] } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_CORSPROXY_API_KEY', 'test-key');

    const { convertCurrency } = await import('./currency');
    await expect(convertCurrency(2, 'GBP', 'INR')).resolves.toBe(166.5);
    await expect(convertCurrency(2, 'ZZZ', 'INR')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(encodeURIComponent(encodeURIComponent('GBPINR=X')));
  });

  it('records live source and freshness metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        chart: { result: [{ meta: { regularMarketPrice: 102.5 } }] },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_CORSPROXY_API_KEY', 'test-key');

    const { fetchCurrencyRate, getCachedCurrencyRate } = await import('./currency');
    await expect(fetchCurrencyRate('EUR', 'INR')).resolves.toBe(102.5);
    expect(getCachedCurrencyRate('EUR', 'INR')).toMatchObject({
      source: 'Yahoo Finance via corsproxy',
      status: 'cache-fresh',
    });
  });
});