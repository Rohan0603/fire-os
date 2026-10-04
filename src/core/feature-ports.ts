import {
  fetchNAV,
  fetchNifty,
  fetchCurrencyRate,
  convertCurrency,
  getNAVCacheMap,
  fetchNiftyHistory,
  fetchNAVHistory,
} from '../modules/api';
import { fetchCurrencyToInr, fetchEsopValuations, fetchStockQuote } from '../modules/api/esop';
import { totalNetWorth, sipStatus, fiProgress, floatIndicator, portfolioComposition, attributeNetWorthChange, esopConcentration } from '../modules/dashboard/kpis';
import { calculateAllocationDrift } from '../modules/calculators/portfolio-rebalancing';
import { calculateFIAge, calculateCoastFire } from '../modules/calculators/scenario-modeler';
import { renderCashflowSummary } from '../modules/plan/cashflow-summary';
import { renderAdvisorIntegrationWidget, registerAdvisorReview } from '../modules/integrations/advisor-webhook';
import { renderExpenseTracker } from '../modules/trackers/expense-tracker';
import { checkWatchdogRules } from '../modules/watchdog/fund-manager-alerts';
import { createModal, closeModal } from '../modules/ui/Modal';
import { showToast } from '../modules/ui/Toast';
import { getFundSchemeCode } from '../lib/fundMatcher';
import { marketRefreshStatusStore } from './stores';
import type { FireOSState } from '../types/state';

export {
  totalNetWorth,
  sipStatus,
  fiProgress,
  floatIndicator,
  portfolioComposition,
  attributeNetWorthChange,
  esopConcentration,
  calculateAllocationDrift,
  calculateFIAge,
  calculateCoastFire,
  checkWatchdogRules,
};

export interface FeatureUiPort {
  createModal: typeof createModal;
  closeModal: typeof closeModal;
  showToast: typeof showToast;
}

export interface FeatureCalculationPort {
  totalNetWorth: typeof totalNetWorth;
  sipStatus: typeof sipStatus;
  fiProgress: typeof fiProgress;
  floatIndicator: typeof floatIndicator;
  portfolioComposition: typeof portfolioComposition;
  attributeNetWorthChange: typeof attributeNetWorthChange;
  esopConcentration: typeof esopConcentration;
  calculateAllocationDrift: typeof calculateAllocationDrift;
  calculateFIAge: typeof calculateFIAge;
  calculateCoastFire: typeof calculateCoastFire;
}

export interface FeatureWidgetPort {
  renderCashflowSummary: typeof renderCashflowSummary;
  renderAdvisorIntegrationWidget: typeof renderAdvisorIntegrationWidget;
  registerAdvisorReview: typeof registerAdvisorReview;
  renderExpenseTracker: typeof renderExpenseTracker;
}

export interface FeatureMarketDataPort {
  fetchNifty: typeof fetchNifty;
  fetchStockQuote: typeof fetchStockQuote;
  fetchCurrencyToInr: typeof fetchCurrencyToInr;
  fetchEsopValuations: typeof fetchEsopValuations;
  fetchCurrencyRate: typeof fetchCurrencyRate;
  convertCurrency: typeof convertCurrency;
  fetchNiftyHistory: typeof fetchNiftyHistory;
  fetchNAVHistory: typeof fetchNAVHistory;
  refreshPortfolioNAVs: (state: FireOSState) => Promise<void>;
}

export interface FeaturePorts {
  ui: FeatureUiPort;
  calculations: FeatureCalculationPort;
  widgets: FeatureWidgetPort;
  marketData: FeatureMarketDataPort;
}

const navRefreshes = new WeakMap<FireOSState, Promise<void>>();

export function refreshPortfolioNAVs(state: FireOSState): Promise<void> {
  const activeRefresh = navRefreshes.get(state);
  if (activeRefresh) return activeRefresh;

  marketRefreshStatusStore.set('refreshing');
  const refresh = refreshPortfolioNAVsNow(state)
    .then(() => {
      marketRefreshStatusStore.set('success');
    })
    .catch((error: unknown) => {
      marketRefreshStatusStore.set('error');
      throw error;
    })
    .finally(() => navRefreshes.delete(state));
  navRefreshes.set(state, refresh);
  return refresh;
}

async function refreshPortfolioNAVsNow(state: FireOSState): Promise<void> {
  const sipsToFetch = Object.entries(state.sip).filter(([, fund]) => fund.units && fund.units > 0);

  for (const [key, fund] of sipsToFetch) {
    const schemeCode = fund.schemeCode || getFundSchemeCode(fund.name);
    if (schemeCode) {
      try {
        await fetchNAV(schemeCode);
        const navCache = getNAVCacheMap();
        if (navCache[schemeCode]) {
          state.nav[schemeCode] = navCache[schemeCode];
        }
      } catch (error) {
        console.warn(`[MarketData] Failed to fetch NAV for SIP ${key}:`, error);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

export function createFeaturePorts(): FeaturePorts {
  return {
    ui: { createModal, closeModal, showToast },
    calculations: {
      totalNetWorth,
      sipStatus,
      fiProgress,
      floatIndicator,
      portfolioComposition,
      attributeNetWorthChange,
      esopConcentration,
      calculateAllocationDrift,
      calculateFIAge,
      calculateCoastFire,
    },
    widgets: {
      renderCashflowSummary,
      renderAdvisorIntegrationWidget,
      registerAdvisorReview,
      renderExpenseTracker,
    },
    marketData: {
      fetchNifty,
      fetchStockQuote,
      fetchCurrencyToInr,
      fetchEsopValuations,
      fetchCurrencyRate,
      convertCurrency,
      fetchNiftyHistory,
      fetchNAVHistory,
      refreshPortfolioNAVs,
    },
  };
}
