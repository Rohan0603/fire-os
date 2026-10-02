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

    const { convertCurrency } = await import('./eurInr');
    await expect(convertCurrency(2, 'EUR', 'INR')).resolves.toBe(205);

    const [request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(request).toContain('key=test-key');
    expect(request).toContain(encodeURIComponent(encodeURIComponent('EURINR=X')));
  });

  it('does not make an unauthenticated browser request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_CORSPROXY_API_KEY', '');

    const { convertCurrency } = await import('./eurInr');
    await expect(convertCurrency(1, 'EUR', 'INR')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});