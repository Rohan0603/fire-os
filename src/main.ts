import {
  loadData,
  persistPortfolioState,
} from './lib/storage';
import { CONFIG } from './lib/config';
import { getOptionalAuth } from './lib/firebase';
import { AuthCoordinator } from './lib/authCoordinator';
import { AuthSessionController } from './app/auth-session-controller';
import { configurePortfolioStorageScope } from './lib/storage';
import { initFirestore, loadPortfolio, onPortfolioChange, savePortfolio } from './modules/api/firestore';

// Import types
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/app';
import { createBootstrap } from './app/bootstrap';
import { registerLegacyTabActivator } from './app/legacy-bridge';
import type { AppBootstrapResult } from './app/bootstrap';
import { applyPersistedState, initializeState } from './types/state';
import type { FireOSState } from './types/state';
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
import { totalNetWorth } from './modules/dashboard/kpis';
import { checkNewMilestones } from './modules/plan/milestones';
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
// Imported last so the OKLCH theme outranks the legacy tokens.css above.
import './styles/tokens-oklch.css';

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
      initAssistantModule(container, context);
      initializedFeatures.add('assistant');
      return;
    }
    renderAssistant(context);
  },
});

function resetLiveAppState(): void {
  Object.assign(appState, initializeState());
  delete appState.niftyData;
}

/**
 * Production wiring for the bootstrap seam. Resolves once `sessionController.start()`
 * has run and a session kind is known; React mounts only after that.
 *
 * The React tree itself arrives in Task 6. Until `#app-root` exists in index.html
 * this is a no-op and the legacy compat bridge keeps owning tab rendering.
 */
export function bootstrapApp(): Promise<AppBootstrapResult> {
  return createBootstrap({
    startAuthSession: () => {
      // `sessionController.start()` already ran above in initApp. The seam owns the
      // ordering guarantee; re-starting here would double-register auth listeners.
    },
    createReactMount: (container) => {
      createRoot(container).render(createElement(App));
    },
    resolveMode: () => (sessionController.isGuestSessionActive ? 'guest' : 'authenticated'),
  })();
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
    setupTabNavigation();
    setupDashboardAutoRefresh();
    setupBackgroundNAVRefresh();
    setupOfflineNotification();
    setupTheme();
    void bootstrapApp().then((result) => {
      const appRoot = document.getElementById('app-root');
      if (appRoot) result.mountReact(appRoot);
    });
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
    <nav class="nav" id="legacy-nav" hidden>
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
        <button id="logout-btn" class="btn-logout" style="display: none;">Logout</button>
      </div>
    </nav>

    <div id="auth-screen"></div>

    <div class="tabs-container" id="legacy-tabs">
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

// Tab navigation
function setupTabNavigation() {
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const navTabs = document.querySelector('.nav-tabs');

  if (hamburgerBtn && navTabs) {
    hamburgerBtn.addEventListener('click', () => {
      hamburgerBtn.classList.toggle('open');
      navTabs.classList.toggle('open');
    });
  }

  const activateTab = (target: string): void => {
    const tabEl = document.getElementById(target);
    if (!tabEl || !featureRegistry.get(target)) return;

    const currentTab = document.querySelector<HTMLElement>('.tab.active');
    if (currentTab && currentTab.id !== target) {
      void featureRegistry.unmount(currentTab.id, currentTab).catch((error) => {
        console.warn(`Failed to unmount feature ${currentTab.id}:`, error);
      });
    }

    document.querySelectorAll('.nav-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.getAttribute('data-tab') === target);
    });
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
    tabEl.classList.add('active');

    void featureRegistry.mount(target, tabEl).catch((error) => {
      console.error(`Failed to load module for tab ${target}:`, error);
      tabEl.innerHTML = '<p style="padding: 20px; color: #d32f2f;">Error loading module. Please check your connection.</p>';
    });
  };

  const activateLocationTab = (): void => {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    const pathTarget = path.startsWith('/') ? path.slice(1) : path;
    const hashTarget = window.location.hash.slice(1);
    const target = featureRegistry.get(pathTarget)?.id ?? featureRegistry.get(hashTarget)?.id ?? 'profile';
    activateTab(target);
  };

  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      if (hamburgerBtn && navTabs) {
        hamburgerBtn.classList.remove('open');
        navTabs.classList.remove('open');
      }
      const target = tab.getAttribute('data-tab');
      if (target) {
        window.history.pushState({}, '', `/${target}`);
        activateTab(target);
      }
    });
  });
  window.addEventListener('popstate', activateLocationTab);
  window.addEventListener('hashchange', activateLocationTab);
  activateLocationTab();
  // React Router navigates without popstate, so hand it the same activator.
  registerLegacyTabActivator(activateTab);

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        if (sessionController.isGuestSessionActive) {
          await sessionController.requestSignIn();
          return;
        }
        await sessionController.signOut();
      } catch (e) {
        console.error('Logout failed:', e);
      }
    });
  }
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

/**
 * Setup offline notification banner
 */
function setupOfflineNotification() {
  const updateBannerStatus = () => {
    const app = document.getElementById('app');
    if (!app) return;

    if (!navigator.onLine) {
      let banner = document.getElementById('offline-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: #ff9800;
          color: white;
          padding: 10px;
          text-align: center;
          font-weight: 500;
          z-index: 2000;
        `;
        banner.textContent = '📡 You are offline - changes will sync when you reconnect';
        document.body.insertBefore(banner, document.body.firstChild);
      }
    } else {
      const banner = document.getElementById('offline-banner');
      if (banner) banner.remove();
    }
  };

  updateBannerStatus();
  window.addEventListener('online', updateBannerStatus);
  window.addEventListener('offline', updateBannerStatus);
}

// Theme toggle logic
//
// Applies the stored preference, or the system preference when nothing is stored.
// The initial application deliberately does NOT write localStorage: only a real
// user toggle persists a choice, so an unset preference stays unset and the CSS
// `@media (prefers-color-scheme)` rule remains authoritative (the spec's
// system-default behaviour). The React ThemeToggle in src/app/components owns the
// control itself and reads the same key.
function setupTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('fire-os-theme');
  const isDark = savedTheme === 'dark' || (savedTheme === null && prefersDark);

  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
}

// Start app
document.addEventListener('DOMContentLoaded', initApp);

// Daily background tasks (snapshots, milestones)
function checkDailyTasks(state: FireOSState) {
  try {
    const nw = totalNetWorth(state);
    const today = new Date().toISOString().substring(0, 10);
    let stateChanged = false;
    
    // Net worth history snapshot (only if we actually have data to record)
    if (nw.netWorth > 0) {
      const hasToday = state.netWorthHistory.some(s => s.date === today);
      if (!hasToday) {
        state.netWorthHistory.push({ date: today, value: nw.netWorth });
        state.netWorthHistory.sort((a, b) => a.date.localeCompare(b.date));
        stateChanged = true;
      }
    }
    
    // Milestones check
    const newMilestones = checkNewMilestones(state);
    const newIds = Object.keys(newMilestones);
    if (newIds.length > 0) {
      newIds.forEach(id => {
        if (!state.achievedMilestones.includes(id)) {
          state.achievedMilestones.push(id);
          stateChanged = true;
        }
      });
      showToast('🏆 Milestone Reached!', 5000, 'success');
    }

    // SWP monthly execution check
    if (state.swpSchedule && state.swpSchedule.enabled) {
      const currentYearMonth = today.substring(0, 7);
      const startYearMonth = state.swpSchedule.startDate ? state.swpSchedule.startDate.substring(0, 7) : '';
      
      if (startYearMonth && currentYearMonth >= startYearMonth) {
        const hasSwpThisMonth = state.expenses?.some(e => e.category === 'SWP' && e.date.substring(0, 7) === currentYearMonth);
        if (!hasSwpThisMonth) {
          stateChanged = true;
          executeMonthlyWithdrawal(state).then(() => {
            persistPortfolioState(state);
            showToast('✓ Automatic monthly SWP executed', 4000, 'success');
            const dashboardTab = document.querySelector('[data-tab="dashboard"]');
            if (dashboardTab && dashboardTab.classList.contains('active')) {
              renderDashboard();
            }
          }).catch(e => {
            console.error('[SWP Auto] Failed to execute withdrawal:', e);
          });
        }
      }
    }

    if (stateChanged) {
      persistPortfolioState(state);
    }
  } catch (e) {
    console.warn('[main] Failed to run daily tasks:', e);
  }
}

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
