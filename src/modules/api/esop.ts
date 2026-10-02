/**
 * ESOP Stock Fetcher
 * Fetches stock prices from Yahoo Finance Chart API for configured ESOP holdings
 */
import { getLogger } from '../../lib/logger';
import { convertCurrency } from './eurInr';
import type { EsopHolding } from '../../types/state';

const logger = getLogger();
const STOCK_QUOTE_CACHE_TTL = 15 * 60 * 1000;
const STOCK_QUOTE_STORAGE_PREFIX = 'fireOS:stockQuote:';
const stockQuoteCache = new Map<string, { quote: StockQuote; cachedAt: number }>();
const stockQuoteRequests = new Map<string, Promise<StockQuote | null>>();

export interface StockQuote {
  price: number;
  currency: string;
}

export interface EsopValuation {
  holding: EsopHolding;
  quote: StockQuote | null;
  rate: number | null;
  value: number | null;
}

function toYahooSymbol(symbol: string): string {
  const value = symbol.trim().toUpperCase();
  const match = value.match(/^(EPA|NSE|BSE):\s*(.+)$/);
  if (!match) return value;
  const suffix = match[1] === 'EPA' ? '.PA' : match[1] === 'NSE' ? '.NS' : '.BO';
  return match[2].endsWith(suffix) ? match[2] : `${match[2]}${suffix}`;
}

function isStockQuote(value: unknown): value is StockQuote {
  if (!value || typeof value !== 'object') return false;
  const quote = value as { price?: unknown; currency?: unknown };
  return typeof quote.price === 'number'
    && Number.isFinite(quote.price)
    && typeof quote.currency === 'string'
    && quote.currency.length > 0;
}

function getCachedStockQuote(yahooSymbol: string): StockQuote | null {
  const memoryEntry = stockQuoteCache.get(yahooSymbol);
  if (memoryEntry && Date.now() - memoryEntry.cachedAt < STOCK_QUOTE_CACHE_TTL) {
    return memoryEntry.quote;
  }

  try {
    const stored = localStorage.getItem(`${STOCK_QUOTE_STORAGE_PREFIX}${yahooSymbol}`);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { quote?: unknown; cachedAt?: unknown };
    if (
      typeof parsed.cachedAt !== 'number'
      || Date.now() - parsed.cachedAt >= STOCK_QUOTE_CACHE_TTL
      || !isStockQuote(parsed.quote)
    ) return null;
    stockQuoteCache.set(yahooSymbol, { quote: parsed.quote, cachedAt: parsed.cachedAt });
    return parsed.quote;
  } catch {
    return null;
  }
}

function cacheStockQuote(yahooSymbol: string, quote: StockQuote): void {
  const cachedAt = Date.now();
  stockQuoteCache.set(yahooSymbol, { quote, cachedAt });
  try {
    localStorage.setItem(
      `${STOCK_QUOTE_STORAGE_PREFIX}${yahooSymbol}`,
      JSON.stringify({ quote, cachedAt }),
    );
  } catch {
    // Memory cache still prevents duplicate calls when storage is unavailable.
  }
}

async function requestStockQuote(yahooSymbol: string, symbol: string): Promise<StockQuote | null> {
  const proxyKey = import.meta.env.VITE_CORSPROXY_API_KEY;
  if (!proxyKey) {
    logger.warn('Stock quote request skipped: VITE_CORSPROXY_API_KEY is not configured');
    return null;
  }

  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`;
  const endpoint = `https://corsproxy.io/?key=${encodeURIComponent(proxyKey)}&url=${encodeURIComponent(yahooUrl)}`;
  console.log('[ESOP API] Stock quote request', { symbol, yahooSymbol });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
    });
    console.log('[ESOP API] Stock quote response', { symbol, status: response.status, ok: response.ok });
    if (!response.ok) return null;

    const data = await response.json() as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: unknown; currency?: unknown } } | null> };
    };
    const meta = data.chart?.result?.[0]?.meta;
    if (
      typeof meta?.regularMarketPrice !== 'number'
      || !Number.isFinite(meta.regularMarketPrice)
      || typeof meta.currency !== 'string'
    ) {
      logger.warn(`Stock ${symbol}: Yahoo quote returned invalid data`);
      return null;
    }

    const quote = { price: meta.regularMarketPrice, currency: meta.currency };
    cacheStockQuote(yahooSymbol, quote);
    console.log('[ESOP API] Stock quote parsed', { symbol, quote });
    return quote;
  } catch (error) {
    logger.warn(`Stock ${symbol} quote request failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  const yahooSymbol = toYahooSymbol(symbol);
  if (!yahooSymbol) return null;

  const cachedQuote = getCachedStockQuote(yahooSymbol);
  if (cachedQuote) return cachedQuote;

  const pendingRequest = stockQuoteRequests.get(yahooSymbol);
  if (pendingRequest) return pendingRequest;

  const request = requestStockQuote(yahooSymbol, symbol).finally(() => {
    stockQuoteRequests.delete(yahooSymbol);
  });
  stockQuoteRequests.set(yahooSymbol, request);
  return request;
}

export async function fetchCurrencyToInr(currency: string): Promise<number | null> {
  const normalized = currency.trim().toUpperCase();
  if (normalized === 'INR') {
    console.log('[ESOP API] Currency conversion', { currency: normalized, rate: 1, source: 'identity' });
    return 1;
  }
  if (normalized === 'EUR') {
    const rate = await convertCurrency(1, 'EUR', 'INR');
    console.log('[ESOP API] Currency conversion', { currency: normalized, rate, source: 'EURINR API' });
    return rate;
  }
  const rate = await convertCurrency(1, normalized, 'INR');
  console.log('[ESOP API] Currency conversion', { currency: normalized, rate, source: 'FX API' });
  return rate;
}

export async function fetchEsopValuations(holdings: EsopHolding[]): Promise<EsopValuation[]> {
  console.log('[ESOP API] Valuation request', { holdings });
  return Promise.all(holdings.map(async (holding) => {
    const [quote, rate] = await Promise.all([
      fetchStockQuote(holding.symbol),
      fetchCurrencyToInr(holding.currency),
    ]);
    const value = quote && rate !== null && quote.price >= 0 && rate > 0
      ? holding.quantity * quote.price * rate
      : null;
    console.log('[ESOP API] Valuation result', {
      symbol: holding.symbol,
      quantity: holding.quantity,
      price: quote?.price ?? null,
      currency: quote?.currency ?? holding.currency,
      rate,
      value,
    });
    return { holding, quote, rate, value };
  }));
}
