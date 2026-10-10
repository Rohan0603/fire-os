import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFeatureContext, type FeatureContext } from '../../core/feature-context';
import { crashAlertStore } from '../../core/stores';
import { initializeState } from '../../types/state';
import { fetchSIPNAVs, refreshStaleData, staleSourceLabels, updateCrashAlert } from './index';
import { setCachedCurrencyRate } from '../api/currency';
import type { CrashAlert } from '../api/nifty-monitor';

describe('dashboard stale source labels', () => {
  let context: FeatureContext;

  beforeEach(() => {
    context = createFeatureContext(initializeState());
  });

  it('names a stale held-fund NAV from its holding name', () => {
    context.state.sip.ppfcf = {
      name: 'Parag Parikh Flexi Cap',
      schemeCode: '122639',
      units: 0,
      startDate: '2024-01',
      monthlyAmount: 5000,
    };
    context.state.nav['122639'] = {
      schemeCode: '122639',
      nav: 100,
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      ttl: 4 * 60 * 60 * 1000,
      status: 'stale',
    };
    context.state.currencyRates.EURINR = {
      rate: 90,
      timestamp: new Date().toISOString(),
      status: 'stale',
    };

    expect(staleSourceLabels(context.state)).toEqual(['Parag Parikh Flexi Cap', 'EURINR rate']);
  });

  it('treats a persisted NAV entry without a status as stale once its TTL passes', () => {
    context.state.sip.smallcap = {
      name: 'Nippon Small Cap',
      schemeCode: '118778',
      units: 0,
      startDate: '2024-01',
      monthlyAmount: 1000,
    };
    context.state.nav['118778'] = {
      schemeCode: '118778',
      nav: 50,
      timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      ttl: 4 * 60 * 60 * 1000,
    };

    expect(staleSourceLabels(context.state)).toEqual(['Nippon Small Cap']);
  });

  it('reports nothing stale when every source is current', () => {
    expect(staleSourceLabels(context.state)).toEqual([]);
  });

  it('treats a persisted FX entry without a status as stale once its TTL passes', () => {
    context.state.currencyRates.EURINR = {
      rate: 90,
      timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      sourceCurrency: 'EUR',
      targetCurrency: 'INR',
    };

    expect(staleSourceLabels(context.state)).toEqual(['EUR→INR rate']);
  });
});

describe('dashboard stale data refresh', () => {
  let context: FeatureContext;

  beforeEach(() => {
    context = createFeatureContext(initializeState());
  });

  it('re-fetches a stale FX row and clears it once a fresh rate lands', async () => {
    context.state.currencyRates.EURINR = {
      rate: 90,
      timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      status: 'stale',
      sourceCurrency: 'EUR',
      targetCurrency: 'INR',
    };
    setCachedCurrencyRate('EUR', 'INR', 95, { source: 'Yahoo Finance via corsproxy', status: 'live' });
    const fetchRate = vi.spyOn(context.ports.marketData, 'fetchCurrencyRate');

    await refreshStaleData(context);

    expect(fetchRate).toHaveBeenCalledWith('EUR', 'INR');
    expect(context.state.currencyRates.EURINR.rate).toBe(95);
    expect(context.state.currencyRates.EURINR.status).not.toBe('stale');
    expect(staleSourceLabels(context.state)).toEqual([]);
  });

  it('leaves a stale FX row untouched when no fresh rate comes back', async () => {
    context.state.currencyRates.GBPINR = {
      rate: 105,
      timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      status: 'stale',
      sourceCurrency: 'GBP',
      targetCurrency: 'INR',
    };
    vi.spyOn(context.ports.marketData, 'fetchCurrencyRate').mockResolvedValue(null);

    await refreshStaleData(context);

    expect(context.state.currencyRates.GBPINR.rate).toBe(105);
    expect(context.state.currencyRates.GBPINR.status).toBe('stale');
  });

  it('refreshes portfolio NAVs through the coalesced market-data port', async () => {
    const refresh = vi.spyOn(context.ports.marketData, 'refreshPortfolioNAVs');

    await fetchSIPNAVs(context);

    expect(refresh).toHaveBeenCalledWith(context.state);
  });
});

describe('dashboard crash alert publisher', () => {
  it('publishes the current alert and clears it with null', () => {
    const alert: CrashAlert = { crashPercentage: 12.5, severity: 'medium', shouldAlert: true };

    updateCrashAlert(alert);
    expect(crashAlertStore.get()).toEqual(alert);

    updateCrashAlert(null);
    expect(crashAlertStore.get()).toBeNull();
  });
});
