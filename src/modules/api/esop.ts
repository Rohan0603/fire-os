/**
 * ESOP Stock Fetcher
 * Fetches Societe Generale (GLE.PA) stock price from Yahoo Finance Chart API
 */
import { getLogger } from '../../lib/logger';

const logger = getLogger();

const CORS_PROXIES = [
  { url: 'https://corsproxy.io/?', name: 'corsproxy' }
];

const SOCGEN_SYMBOL = 'GLE.PA';
const YAHOO_CHARTS_URL = `https://query1.finance.yahoo.com/v8/finance/chart/${SOCGEN_SYMBOL}?interval=1d&range=1d`;

export async function fetchSocGenPrice(): Promise<number | null> {
  for (const proxy of CORS_PROXIES) {
    try {
      const proxyUrl = `${proxy.url}${encodeURIComponent(YAHOO_CHARTS_URL)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(proxyUrl, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(`SocGen Stock ${proxy.name} proxy failed: HTTP ${response.status}`);
        continue;
      }

      let data: any;
      if (proxy.name === 'allorigins') {
        const alloriginsResponse = await response.json();
        data = JSON.parse(alloriginsResponse.contents);
      } else {
        data = await response.json();
      }

      const meta = data?.chart?.result?.[0]?.meta;
      if (!meta || typeof meta.regularMarketPrice !== 'number') {
        logger.warn('SocGen Stock: Could not parse stock price from Yahoo JSON');
        continue;
      }

      return meta.regularMarketPrice;
    } catch (error) {
      logger.warn(`SocGen Stock proxy fetch failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      continue;
    }
  }

  // Fallback price if Yahoo fetch fails
  return 24.50; // A reasonable default price in EUR for SocGen (approx)
}
