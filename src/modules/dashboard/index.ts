/**
 * Dashboard data helpers.
 *
 * The dashboard UI lives in the React route (`src/app/routes/dashboard`). This
 * module keeps only the non-UI behaviour the app shell and that route share:
 * the coalesced NAV/FX refresh (login, background interval, trust-panel retry),
 * the stale-source inventory the trust panel renders, and the crash-alert
 * publisher the banner reads.
 */

import { createFeatureContext, type FeatureContext } from '../../core/feature-context';
import { crashAlertStore } from '../../core/stores';
import { CONFIG } from '../../lib/config';
import { getFundSchemeCode } from '../../lib/fundMatcher';
import { getCurrencyRateCache, isSupportedCurrencyCode } from '../api/currency';
import type { CrashAlert } from '../api/nifty-monitor';
import type { CurrencyRateData } from '../../types/api';
import type { FireOSState } from '../../types/state';

/**
 * Fetch NAVs for every SIP holding units via the market-data port. Coalesced
 * per state by the port, so login, the trust-panel retry and the dashboard's
 * own refresh can call it concurrently without duplicate provider traffic.
 */
export function fetchSIPNAVs(context: FeatureContext = createFeatureContext()): Promise<void> {
  return context.ports.marketData.refreshPortfolioNAVs(context.state);
}

/** Freshness predicate shared by the trust panel and its refresh action: an
 * explicit status wins, otherwise fall back to the entry's TTL (4h NAV default). */
function isStaleEntry(timestamp: string, ttl: number | undefined, status?: string): boolean {
  if (status) return status === 'stale';
  return Date.now() - new Date(timestamp).getTime() > (ttl ?? 4 * 60 * 60 * 1000);
}

/** Resolve the currency pair for a cached FX row, from its fields or its key. */
function currencyPairFor(
  key: string,
  entry: CurrencyRateData,
): [string, string] | null {
  if (entry.sourceCurrency && entry.targetCurrency) {
    return [entry.sourceCurrency, entry.targetCurrency];
  }
  const source = key.slice(0, 3);
  const target = key.slice(3);
  if (isSupportedCurrencyCode(source) && isSupportedCurrencyCode(target)) return [source, target];
  return null;
}

/**
 * Re-fetch one cached FX row and rewrite it only when the live rate cache
 * actually recovered a fresh rate, so a failed refresh stays visibly stale.
 */
async function refreshCurrencyEntry(
  context: FeatureContext,
  key: string,
  entry: CurrencyRateData,
): Promise<void> {
  const pair = currencyPairFor(key, entry);
  if (!pair) return;
  const fetched = await context.ports.marketData.fetchCurrencyRate(pair[0], pair[1]).catch(() => null);
  if (!fetched) return;
  const synced = getCurrencyRateCache()[`${pair[0]}${pair[1]}`];
  if (synced && synced.status !== 'stale') {
    context.state.currencyRates[key] = { ...entry, ...synced };
  }
}

/**
 * Refresh everything the trust panel flags as stale: held-fund NAVs plus each
 * cached FX row past its TTL.
 */
export async function refreshStaleData(context: FeatureContext = createFeatureContext()): Promise<void> {
  const staleFx = Object.entries(context.state.currencyRates || {})
    .filter(([, entry]) => isStaleEntry(entry.timestamp, CONFIG.cacheTtl.currencyRate, entry.status))
    .map(([key, entry]) => refreshCurrencyEntry(context, key, entry));
  await Promise.allSettled([fetchSIPNAVs(context), ...staleFx]);
}

/**
 * Human labels for cached NAVs of held funds and FX rates past their TTL, so
 * the trust panel can name each stale source. `status` is absent on entries
 * restored from persistence before the first refresh, so those fall back to
 * the entry timestamp.
 */
export function staleSourceLabels(state: FireOSState): string[] {
  const namesByCode = new Map<string, string>();
  const holdings = [...Object.values(state.sip || {}), ...Object.values(state.mf || {})];
  for (const fund of holdings) {
    const schemeCode = fund.schemeCode || getFundSchemeCode(fund.name);
    if (schemeCode && !namesByCode.has(schemeCode)) namesByCode.set(schemeCode, fund.name);
  }
  const navLabels = Object.values(state.nav || {})
    .filter((entry) => isStaleEntry(entry.timestamp, entry.ttl, entry.status))
    .map((entry) => namesByCode.get(entry.schemeCode))
    .filter((name): name is string => Boolean(name));
  const currencyLabels = Object.entries(state.currencyRates || {})
    .filter(([, entry]) => isStaleEntry(entry.timestamp, CONFIG.cacheTtl.currencyRate, entry.status))
    .map(([key, entry]) =>
      entry.sourceCurrency && entry.targetCurrency
        ? `${entry.sourceCurrency}→${entry.targetCurrency} rate`
        : `${key} rate`,
    );
  return [...navLabels, ...currencyLabels];
}

/**
 * Publish the current crash alert for the dashboard banner. Called by the
 * Nifty monitor; `null` clears it. The dashboard subscribes to the atom, so a
 * remote account never re-renders this module's own HTML.
 */
export function updateCrashAlert(alert: CrashAlert | null): void {
  crashAlertStore.set(alert);
}
