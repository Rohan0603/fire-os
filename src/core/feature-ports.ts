import {
  fetchNAV,
  fetchNifty,
  fetchEURINR,
  getNAVCacheMap,
} from '../modules/api';
import { fetchSocGenPrice } from '../modules/api/esop';
import { totalNetWorth, sipStatus, fiProgress, floatIndicator, portfolioComposition } from '../modules/dashboard/kpis';
import { calculateAllocationDrift } from '../modules/calculators/portfolio-rebalancing';
import { calculateFIAge } from '../modules/calculators/scenario-modeler';
import { renderCashflowSummary } from '../modules/plan/cashflow-summary';
import { renderAdvisorIntegrationWidget, registerAdvisorReview } from '../modules/integrations/advisor-webhook';
import { renderExpenseTracker } from '../modules/trackers/expense-tracker';
import { checkWatchdogRules } from '../modules/watchdog/fund-manager-alerts';
import { createModal, closeModal } from '../modules/ui/Modal';
import { showToast } from '../modules/ui/Toast';
import { getFundSchemeCode } from '../lib/fundMatcher';
import type { FireOSState } from '../types/state';

export {
  totalNetWorth,
  sipStatus,
  fiProgress,
  floatIndicator,
  portfolioComposition,
  calculateAllocationDrift,
  calculateFIAge,
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
  calculateAllocationDrift: typeof calculateAllocationDrift;
  calculateFIAge: typeof calculateFIAge;
}

export interface FeatureWidgetPort {
  renderCashflowSummary: typeof renderCashflowSummary;
  renderAdvisorIntegrationWidget: typeof renderAdvisorIntegrationWidget;
  registerAdvisorReview: typeof registerAdvisorReview;
  renderExpenseTracker: typeof renderExpenseTracker;
}

export interface FeatureMarketDataPort {
  fetchNifty: typeof fetchNifty;
  fetchSocGenPrice: typeof fetchSocGenPrice;
  fetchEURINR: typeof fetchEURINR;
  refreshPortfolioNAVs: (state: FireOSState) => Promise<void>;
}

export interface FeaturePorts {
  ui: FeatureUiPort;
  calculations: FeatureCalculationPort;
  widgets: FeatureWidgetPort;
  marketData: FeatureMarketDataPort;
}

export async function refreshPortfolioNAVs(state: FireOSState): Promise<void> {
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
      calculateAllocationDrift,
      calculateFIAge,
    },
    widgets: {
      renderCashflowSummary,
      renderAdvisorIntegrationWidget,
      registerAdvisorReview,
      renderExpenseTracker,
    },
    marketData: {
      fetchNifty,
      fetchSocGenPrice,
      fetchEURINR,
      refreshPortfolioNAVs,
    },
  };
}
