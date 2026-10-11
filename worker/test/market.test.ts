import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';

const PRIMARY_ORIGIN = 'https://fire-os-dd6d6.firebaseapp.com';

const env = {
  OPENROUTER_API_KEY: 'test-key',
  ASSISTANT_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
  ALLOWED_ORIGIN: `${PRIMARY_ORIGIN},http://localhost:5173`,
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const niftyPayload = {
  chart: {
    result: [
      {
        meta: { regularMarketPrice: 24500, fiftyTwoWeekHigh: 26000, currency: 'INR' },
        timestamp: [1700000000, 1700086400],
        indicators: { quote: [{ close: [24000, 24200], high: [24100, 24300] }] },
      },
    ],
  },
};

/** Minimal Cache API stub backed by a Map, keyed by string URL. */
function installFakeCache() {
  const store = new Map<string, Response>();
  (globalThis as any).caches = {
    default: {
      async match(key: string) {
        const hit = store.get(key);
        return hit ? hit.clone() : undefined;
      },
      async put(key: string, response: Response) {
        store.set(key, response);
      },
    },
  };
  return store;
}

function marketRequest(path: string, origin = PRIMARY_ORIGIN) {
  return new Request(`https://worker.example${path}`, { headers: { Origin: origin } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete (globalThis as any).caches;
});

describe('Market Worker endpoints', () => {
  it('answers preflight for the market path from an allowed origin', async () => {
    const response = await worker.fetch(
      new Request('https://worker.example/api/market/nifty', {
        method: 'OPTIONS',
        headers: { Origin: PRIMARY_ORIGIN },
      }),
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(PRIMARY_ORIGIN);
  });

  it('proxies Nifty, derives the 52-week high, and serves the second call from cache', async () => {
    installFakeCache();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(niftyPayload));
    vi.stubGlobal('fetch', fetchMock);

    const first = await worker.fetch(marketRequest('/api/market/nifty'), env);
    const body = (await first.json()) as any;

    expect(first.status).toBe(200);
    expect(body).toMatchObject({
      level: 24500,
      high52w: 26000,
      source: 'Yahoo Finance',
      stale: false,
    });
    expect(body.points).toEqual([
      { date: '2023-11-14', value: 24000 },
      { date: '2023-11-15', value: 24200 },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await worker.fetch(marketRequest('/api/market/nifty'), env);
    expect(((await second.json()) as any).level).toBe(24500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the last cached copy when the upstream fails after the TTL', async () => {
    const store = installFakeCache();
    const base = Date.parse('2026-01-01T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(base);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(niftyPayload));
    vi.stubGlobal('fetch', fetchMock);

    await worker.fetch(marketRequest('/api/market/nifty'), env);
    expect(store.size).toBe(1);

    vi.setSystemTime(base + 3_600_000 + 1);
    fetchMock.mockRejectedValue(new Error('upstream down'));

    const response = await worker.fetch(marketRequest('/api/market/nifty'), env);
    const body = (await response.json()) as any;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      level: 24500,
      stale: true,
      timestamp: '2026-01-01T00:00:00.000Z',
    });
  });

  it('returns 502 when upstream fails and nothing is cached', async () => {
    installFakeCache();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));

    const response = await worker.fetch(marketRequest('/api/market/nifty'), env);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Market data unavailable' });
  });

  it('maps an upstream timeout to 504', async () => {
    installFakeCache();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('timeout', 'TimeoutError')));

    const response = await worker.fetch(marketRequest('/api/market/nifty'), env);

    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ error: 'Market data source timed out' });
  });

  it('proxies a currency rate and validates the codes', async () => {
    installFakeCache();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ chart: { result: [{ meta: { regularMarketPrice: 83.12 } }] } }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const ok = await worker.fetch(marketRequest('/api/market/currency?from=usd&to=inr'), env);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ from: 'USD', to: 'INR', rate: 83.12, stale: false });

    const bad = await worker.fetch(marketRequest('/api/market/currency?from=us&to=inr'), env);
    expect(bad.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('proxies a stock quote and rejects an invalid symbol before fetching', async () => {
    installFakeCache();
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        chart: { result: [{ meta: { regularMarketPrice: 42.5, currency: 'EUR' } }] },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const ok = await worker.fetch(marketRequest('/api/market/quote?symbol=MC.PA'), env);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({
      symbol: 'MC.PA',
      price: 42.5,
      currency: 'EUR',
      stale: false,
    });

    const bad = await worker.fetch(marketRequest('/api/market/quote?symbol=../etc/passwd'), env);
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'invalid symbol' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rate-limits market requests like the assistant endpoint', async () => {
    installFakeCache();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const limitedEnv = {
      ...env,
      ASSISTANT_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: false }) },
    };

    const response = await worker.fetch(marketRequest('/api/market/nifty'), limitedEnv);

    expect(response.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-GET market requests', async () => {
    const response = await worker.fetch(
      new Request('https://worker.example/api/market/nifty', {
        method: 'POST',
        headers: { Origin: PRIMARY_ORIGIN },
      }),
      env,
    );

    expect(response.status).toBe(405);
  });

  it('returns 404 for an unknown market route', async () => {
    const response = await worker.fetch(marketRequest('/api/market/unknown'), env);
    expect(response.status).toBe(404);
  });
});
