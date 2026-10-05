import {
  loadData,
  persistPortfolioState,
} from './lib/storage';
import { CONFIG } from './lib/config';
import { getOptionalAuth } from './lib/firebase';
import { AuthCoordinator } from './lib/authCoordinator';
import { AuthSessionController } from './app/auth-session-controller';
import { setupTabNavigation } from './app/tab-navigation';
import { setupOfflineNotification } from './app/offline-notification';
import { setupTheme } from './app/theme';
import { createDailyTaskRunner } from './app/daily-tasks';
import { configurePortfolioStorageScope } from './lib/storage';
import { initFirestore, loadPortfolio, onPortfolioChange, savePortfolio } from './modules/api/firestore';

// Import types
import { applyPersistedState, initializeState } from './types/state';
import { appState } from './lib/appState';
import { createFeatureContext } from './core/feature-context';
import { portfolioSavedStore } from './core/stores';
import { FeatureRegistry } from './app/feature-registry';
import { PortfolioSession } from './app/portfolio-session';

// Import auth module
import { renderAuthScreen, hideAuthScreen, showAuthScreen, initAuthModule } from './modules/auth';

// Import UI module
import { initUIModule } from './modules/ui';

// Import profile module
import { initProfileModule, renderProfile } from './modules/profile';

// Import API module
import { initAPIModule } from './modules/api';

// Import Nifty monitoring
import { monitorNiftyLevel } from './modules/api/nifty-monitor';

// Static imports for tab modules and other deferred modules to prevent dynamic import warnings
import { initDashboardModule, renderDashboard, fetchSIPNAVs, teardownDashboard, updateCrashAlert } from './modules/dashboard';
import { initCalculatorsModule, renderCalculators } from './modules/calculators';
import { initInsuranceModule, renderInsurance } from './modules/insurance';
import { initPlanModule, renderPlan } from './modules/plan';
import { initEsopModule, renderEsop } from './modules/esop';
import { initAssistantModule, renderAssistant } from './modules/assistant';
import { executeMonthlyWithdrawal } from './modules/calculators/swp-scheduler';
import { getFundSchemeCode } from './lib/fundMatcher';
import { fetchNAV } from './modules/api';



// Import error handling
import { setupErrorHandling, handleError } from './lib/error-handler';
import { showToast } from './modules/ui';

// Import styles
import './styles/global.css';
import './styles/layout.css';
import './styles/tokens.css';

// Global state object - properly typed
// Firebase configuration
const firebaseConfig = CONFIG.firebaseConfig;

// Firebase is optional: an absent or partial `VITE_FIREBASE_*` configuration is a
// supported guest-only mode (see docs/README.md). Resolving auth through
// `getOptionalAuth` keeps a missing config from aborting module evaluation, which
// would leave the app unrendered.
export const auth = getOptionalAuth(firebaseConfig);
const authCoordinator = new AuthCoordinator(auth);

const featureContext = createFeatureContext(appState);
const featureRegistry = new FeatureRegistry(featureContext);
const portfolioSession = new PortfolioSession({ resetState: resetLiveAppState });
const checkDailyTasks = createDailyTaskRunner({
  persist: persistPortfolioState,
  notify: showToast,
  executeMonthlyWithdrawal,
  renderDashboardIfVisible: () => {
    const dashboardTab = document.querySelector('[data-tab="dashboard"]');
    if (dashboardTab && dashboardTab.classList.contains('active')) renderDashboard();
  },
});
const sessionController = new AuthSessionController({
  authCoordinator,
  portfolioSession,
  state: appState,
  context: featureContext,
  firebaseConfig,
  loadData,
  configureStorageScope: configurePortfolioStorageScope,
  initFirestore,
  loadPortfolio,
  onPortfolioChange,
  savePortfolio,
  hideAuthScreen,
  showAuthScreen,
  renderProfile,
  fetchSIPNAVs: async () => fetchSIPNAVs(),
  checkDailyTasks,
  monitorNiftyLevel,
  updateCrashAlert,
});
const initializedFeatures = new Set<string>();

featureRegistry.register({
  id: 'profile',
  label: 'Profile',
  mount(container, context) {
    if (!initializedFeatures.has('profile')) {
      initProfileModule(container.id, context);
      initializedFeatures.add('profile');
      return;
    }
    renderProfile(container, context);
  },
});
featureRegistry.register({
  id: 'dashboard',
  label: 'Dashboard',
  mount(container, context) {
    if (!initializedFeatures.has('dashboard')) {
      initDashboardModule(container.id, context);
      initializedFeatures.add('dashboard');
    }
    return renderDashboard(context);
  },
  unmount() {
    teardownDashboard();
  },
});
featureRegistry.register({
  id: 'calculators',
  label: 'Planning Tools',
  mount(container, context) {
    if (!initializedFeatures.has('calculators')) {
      initCalculatorsModule(container.id, context);
      initializedFeatures.add('calculators');
      return;
    }
    renderCalculators(container, context);
  },
});
featureRegistry.register({
  id: 'insurance',
  label: 'Insurance',
  mount(container, context) {
    if (!initializedFeatures.has('insurance')) {
      initInsuranceModule(container.id, context);
      initializedFeatures.add('insurance');
      return;
    }
    renderInsurance(container, context);
  },
});
featureRegistry.register({
  id: 'plan',
  label: 'Plan',
  mount(container, context) {
    if (!initializedFeatures.has('plan')) {
      initPlanModule(container.id, context);
      initializedFeatures.add('plan');
    }
    renderPlan(context);
  },
});
featureRegistry.register({
  id: 'esop',
  label: 'ESOP Tools',
  mount(container, context) {
    if (!initializedFeatures.has('esop')) {
      initEsopModule(container.id, context);
      initializedFeatures.add('esop');
      return;
    }
    renderEsop(container, context);
  },
});

featureRegistry.register({
  id: 'assistant',
  label: 'Assistant',
  mount(container, context) {
    if (!initializedFeatures.has('assistant')) {
      return initAssistantModule(container, context).then(() => {
        initializedFeatures.add('assistant');
      });
    }
    renderAssistant(context);
  },
});

function resetLiveAppState(): void {
  Object.assign(appState, initializeState());
  delete appState.niftyData;
}


// Initialize app on startup
function initApp() {
  try {
    setupErrorHandling();
    const cachedState = loadData();
    if (cachedState) applyPersistedState(appState, cachedState);
    initAPIModule(appState);
    renderApp();

    // Initialize UI module with error handling
    try {
      initUIModule();
    } catch (e) {
      console.error('Failed to initialize UI module:', e);
      handleError(e, 'UI module initialization failed');
    }

    // Initialize profile module with error handling
    const profileEl = document.getElementById('profile');
    if (profileEl) {
      void featureRegistry.mount('profile', profileEl).catch((e) => {
        console.error('Failed to initialize Profile module:', e);
        handleError(e, 'Profile module initialization failed');
        profileEl.innerHTML = '<p style="padding: 20px; color: #d32f2f;">Error loading Profile module. Please reload.</p>';
      });
    }

    sessionController.start();
    setupTabNavigation(featureRegistry, sessionController);
    setupDashboardAutoRefresh();
    setupBackgroundNAVRefresh();
    setupOfflineNotification();
    setupTheme();
  } catch (e) {
    console.error('Fatal error during app initialization:', e);
    handleError(e, 'App initialization failed - please reload the page');
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = '<div style="padding: 20px; color: #d32f2f; font-weight: bold;">Failed to initialize app. Please reload the page.</div>';
    }
  }
}

// Render main app container
function renderApp() {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <nav class="nav">
      <div class="nav-brand">FIRE OS</div>
      <button id="hamburger-btn" class="hamburger-btn" aria-label="Toggle Menu">☰</button>
      <div class="nav-tabs">
        <a class="nav-tab active" href="/profile" data-tab="profile">Profile</a>
        <a class="nav-tab" href="/dashboard" data-tab="dashboard">Dashboard</a>
        <a class="nav-tab" href="/calculators" data-tab="calculators">Planning Tools</a>
        <a class="nav-tab" href="/insurance" data-tab="insurance">Insurance</a>
        <a class="nav-tab" href="/plan" data-tab="plan">Plan</a>
        <a class="nav-tab" href="/esop" data-tab="esop">ESOP Tools</a>
        <a class="nav-tab" href="/assistant" data-tab="assistant">Assistant</a>
      </div>
      <div style="display: flex; gap: 1rem; align-items: center;">
        <label class="theme-switch" title="Toggle Theme">
          <input type="checkbox" id="theme-toggle">
          <span class="slider round"></span>
        </label>
        <button id="logout-btn" class="btn-logout" style="display: none;">Logout</button>
      </div>
    </nav>

    <div id="auth-screen"></div>

    <div class="tabs-container">
      <div id="profile" class="tab active"></div>
      <div id="dashboard" class="tab"></div>
      <div id="calculators" class="tab"></div>
      <div id="insurance" class="tab"></div>
      <div id="plan" class="tab"></div>
      <div id="esop" class="tab"></div>
      <div id="assistant" class="tab"></div>
    </div>
  `;

  // Initialize and render auth screen
  initAuthModule('auth-screen');
  renderAuthScreen();
}

// Auto-refresh dashboard when state changes
function setupDashboardAutoRefresh() {
  let renderQueued = false;
  const refreshDashboard = () => {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      const dashboardTab = document.querySelector('[data-tab="dashboard"]');
      if (dashboardTab && dashboardTab.classList.contains('active')) {
        void renderDashboard(featureContext);
      }
    });
  };

  const unsubscribe = portfolioSavedStore.subscribe(refreshDashboard);
  window.addEventListener('pagehide', unsubscribe, { once: true });
}

// Start app
document.addEventListener('DOMContentLoaded', initApp);

// Background NAV Auto-Refresh (Runs periodically)
function setupBackgroundNAVRefresh() {
  let refreshInProgress = false;
  setInterval(async () => {
    if (refreshInProgress || !navigator.onLine || document.visibilityState === 'hidden') return;
    refreshInProgress = true;
    console.debug('[API] Background auto-refreshing NAVs...');
    const uid = appState.currentUser?.uid ?? null;
    try {
      const sipsToFetch = Object.entries(appState.sip).filter(([, fund]) => fund.units && fund.units > 0);
      let updated = false;
      for (const [, fund] of sipsToFetch) {
        if ((appState.currentUser?.uid ?? null) !== uid) return;
        const schemeCode = fund.schemeCode || getFundSchemeCode(fund.name);
        if (schemeCode) {
          try {
            const oldNav = appState.nav[schemeCode]?.nav;
            const newNav = await fetchNAV(schemeCode);
            if ((appState.currentUser?.uid ?? null) !== uid) return;
            if (newNav !== oldNav && newNav !== null) {
              appState.nav[schemeCode] = {
                schemeCode,
                nav: newNav,
                timestamp: new Date().toISOString(),
                ttl: CONFIG.cacheTtl.nav,
              };
              updated = true;
            }
          } catch (e) {
            console.warn(`[Background Refresh] Failed for scheme ${schemeCode}:`, e);
          }
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (updated && (appState.currentUser?.uid ?? null) === uid) {
        persistPortfolioState(appState);
      }
    } finally {
      refreshInProgress = false;
    }
  }, CONFIG.cacheTtl.nav); // run at NAV cache TTL interval
}
