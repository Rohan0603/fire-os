import {
  clearPortfolioStorageScope,
  configurePortfolioStorageScope,
  configurePortfolioSync,
  loadData,
  persistPortfolioState,
} from './lib/storage';
import { CONFIG } from './lib/config';
import { getFirebaseServices } from './lib/firebase';
import { AuthCoordinator } from './lib/authCoordinator';
import { applyEnvelopeToState, buildEnvelopeFromState, mergeEnvelopes } from './lib/merge';
import { SyncCoordinator } from './lib/syncCoordinator';
import { initFirestore, loadPortfolio, onPortfolioChange, savePortfolio } from './modules/api/firestore';

// Import types
import { initializeState } from './types/state';
import type { FireOSState } from './types/state';
import type { PortfolioEnvelope } from './types/firebase';
import { appState } from './lib/appState';
import { createFeatureContext } from './core/feature-context';
import { FeatureRegistry } from './app/feature-registry';

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
import { initDashboardModule, renderDashboard, fetchSIPNAVs, updateCrashAlert } from './modules/dashboard';
import { initCalculatorsModule, renderCalculators } from './modules/calculators';
import { initInsuranceModule, renderInsurance } from './modules/insurance';
import { initPlanModule, renderPlan } from './modules/plan';
import { initEsopModule, renderEsop } from './modules/esop';
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

// Global state object - properly typed
// Firebase configuration
const firebaseConfig = CONFIG.firebaseConfig;

// Initialize Firebase
export const auth = getFirebaseServices(firebaseConfig).auth;
const authCoordinator = new AuthCoordinator(auth);

let activePortfolioUnsubscribe: (() => void) | null = null;
let activeSyncCoordinator: SyncCoordinator | null = null;
let activePortfolioEnvelope: PortfolioEnvelope | null = null;
let activeNiftyMonitorCleanup: (() => void) | null = null;
let guestSessionActive = false;
let authPromptRequested = false;
const featureContext = createFeatureContext(appState);
const featureRegistry = new FeatureRegistry(featureContext);
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
});
featureRegistry.register({
  id: 'calculators',
  label: 'Calculators',
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

function resetLiveAppState(): void {
  Object.assign(appState, initializeState());
  appState.niftyData = undefined;
  appState.eurInrData = undefined;
}

async function teardownAuthSession(): Promise<void> {
  activePortfolioUnsubscribe?.();
  activePortfolioUnsubscribe = null;

  const coordinator = activeSyncCoordinator;
  activeSyncCoordinator = null;
  if (coordinator) {
    coordinator.pause();
    try {
      await coordinator.flush({ timeoutMs: 5000 });
    } catch (error) {
      console.warn('[Auth] Failed to flush pending portfolio changes:', error);
    }
    coordinator.dispose();
  }

  activeNiftyMonitorCleanup?.();
  activeNiftyMonitorCleanup = null;
  activePortfolioEnvelope = null;
  configurePortfolioSync(null, null);
  clearPortfolioStorageScope();
  resetLiveAppState();
}

function hasLocalPortfolioData(state: FireOSState): boolean {
  return Boolean(
    state.profile.name.trim()
    || state.profile.age
    || state.profile.annualExpenses
    || state.profile.fiTarget
    || state.profile.monthlyIncome
    || Object.keys(state.mf).length
    || Object.keys(state.sip).length
    || Object.keys(state.fd).length
    || Object.keys(state.epf).length
    || Object.keys(state.esop).length
    || Object.keys(state.bonds).length
    || Object.keys(state.demat).length
    || state.niftyData
    || state.netWorthHistory.length
    || state.achievedMilestones.length
  );
}


// Initialize app on startup
function initApp() {
  try {
    setupErrorHandling();
    initAPIModule(appState);
    const cachedState = loadData();
    if (cachedState) Object.assign(appState, cachedState);
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

    setupAuthListener();
    setupTabNavigation();
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
        <button class="nav-tab active" data-tab="profile">Profile</button>
        <button class="nav-tab" data-tab="dashboard">Dashboard</button>
        <button class="nav-tab" data-tab="calculators">Calculators</button>
        <button class="nav-tab" data-tab="insurance">Insurance</button>
        <button class="nav-tab" data-tab="plan">Plan</button>
        <button class="nav-tab" data-tab="esop">ESOP Tools</button>
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
    </div>
  `;

  // Initialize and render auth screen
  initAuthModule('auth-screen');
  renderAuthScreen();
}

async function startGuestSession(): Promise<void> {
  if (authCoordinator.getCurrentUser() || guestSessionActive) return;

  authPromptRequested = false;
  await teardownAuthSession();
  configurePortfolioStorageScope(null);
  const cachedState = loadData();
  if (cachedState) Object.assign(appState, cachedState);
  appState.currentUser = null;
  guestSessionActive = true;

  hideAuthScreen();
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.textContent = 'Sign in';
    logoutBtn.style.display = 'block';
  }

  const saveCloudBtn = document.getElementById('save-cloud-btn') as HTMLButtonElement;
  if (saveCloudBtn) {
    saveCloudBtn.disabled = true;
    saveCloudBtn.classList.add('btn-disabled');
  }

  const profileTab = document.getElementById('profile');
  if (profileTab) renderProfile(profileTab, featureContext);
}

// Firebase auth listener
function setupAuthListener() {
  authCoordinator.start(async ({ generation: sessionGeneration, user }) => {
    if (guestSessionActive && !user) return;
    if (!user && authPromptRequested) {
      showAuthScreen();
      return;
    }
    await teardownAuthSession();
    if (!authCoordinator.isCurrent({ generation: sessionGeneration, user })) return;

    if (user) {
      guestSessionActive = false;
      authPromptRequested = false;
      configurePortfolioStorageScope(user.uid);
      const scopedState = loadData();
      if (scopedState) Object.assign(appState, scopedState);
      appState.currentUser = user;
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) logoutBtn.style.display = 'block';

      try {
        await initFirestore(firebaseConfig);
        const localEnvelope = hasLocalPortfolioData(appState)
          ? buildEnvelopeFromState(appState, { clientId: 'browser', appVersion: '2.2.0', platform: 'web' }, appState._lastSavedAt)
          : null;
        const remoteEnvelope = await loadPortfolio(user.uid);
        if (!authCoordinator.isCurrent({ generation: sessionGeneration, user })) return;

        const merged = remoteEnvelope && localEnvelope
          ? mergeEnvelopes(localEnvelope, remoteEnvelope)
          : {
            envelope: remoteEnvelope ?? localEnvelope ?? buildEnvelopeFromState(appState),
            conflicts: [],
            dirtySections: [],
          };
        applyEnvelopeToState(appState, merged.envelope);
        appState.currentUser = user;
        activePortfolioEnvelope = merged.envelope;
          persistPortfolioState(appState, { sync: false });
        hideAuthScreen();
        activeSyncCoordinator = new SyncCoordinator({
          uid: user.uid,
          save: savePortfolio,
          onStatusChange: (status) => document.dispatchEvent(new CustomEvent('syncStatusChanged', { detail: status })),
        });
        configurePortfolioSync(activeSyncCoordinator, merged.envelope);
        activePortfolioUnsubscribe?.();
        activePortfolioUnsubscribe = onPortfolioChange(user.uid, (remote) => {
          if (!authCoordinator.isCurrent({ generation: sessionGeneration, user })) return;
          const current = buildEnvelopeFromState(
            appState,
            { clientId: 'browser', appVersion: '2.2.0', platform: 'web' },
            appState._lastSavedAt,
            activePortfolioEnvelope ?? undefined,
          );
          const mergedSnapshot = mergeEnvelopes(current, remote).envelope;
          applyEnvelopeToState(appState, mergedSnapshot);
          appState.currentUser = user;
          activePortfolioEnvelope = mergedSnapshot;
          configurePortfolioSync(activeSyncCoordinator, mergedSnapshot);
          persistPortfolioState(appState, { sync: false });
          document.dispatchEvent(new CustomEvent('profileUpdated', { detail: appState }));
        }, (error) => console.warn('[Auth] Firestore snapshot failed:', error));

        fetchSIPNAVs().catch(e => console.warn('[Auth] Failed to fetch SIP NAVs:', e));
        const profileTab = document.getElementById('profile');
        const profileNavTab = document.querySelector('[data-tab="profile"]');
        if (profileTab && profileNavTab?.classList.contains('active')) renderProfile(profileTab, featureContext);
          checkDailyTasks(appState);
      } catch (e) {
        console.warn('[Auth] Failed to load from Firebase:', e);
        hideAuthScreen();
      }

      // Update Save button state if profile tab is visible
      const saveCloudBtn = document.getElementById('save-cloud-btn') as HTMLButtonElement;
      if (saveCloudBtn) {
        saveCloudBtn.disabled = false;
        saveCloudBtn.classList.remove('btn-disabled');
        const hint = document.querySelector('.save-cloud-hint') as HTMLElement;
        if (hint) hint.style.display = 'none';
      }

      // Start Nifty monitoring when user logs in
      try {
        activeNiftyMonitorCleanup = monitorNiftyLevel((alert) => {
          if (!authCoordinator.isCurrent({ generation: sessionGeneration, user })) return;
          if (alert) {
            // Calculate dynamic deploy amount based on Bonds
            const totalBonds = Object.values(appState.bonds || {}).reduce((sum, b) => sum + b.amount, 0);
            if (alert.severity === 'medium') alert.deployAmount = totalBonds * 0.10;
            else if (alert.severity === 'high') alert.deployAmount = totalBonds * 0.15;
            else if (alert.severity === 'critical') alert.deployAmount = totalBonds * 0.25;

            console.info('Crash alert detected:', {
              crashPercentage: alert.crashPercentage,
              severity: alert.severity,
              deployAmount: alert.deployAmount,
            });
            // Update dashboard with alert (dashboard will re-render if visible)
            updateCrashAlert(alert);
          } else {
            // Alert cleared
            updateCrashAlert(null);
          }
        });
      } catch (e) {
        console.warn('Failed to start Nifty monitoring:', e);
      }

    } else {
      if (!authPromptRequested) {
        await startGuestSession();
        return;
      }

      guestSessionActive = false;
      appState.currentUser = null;
      showAuthScreen();
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) logoutBtn.style.display = 'none';

      // Update Save button state if profile tab is visible
      const saveCloudBtn = document.getElementById('save-cloud-btn') as HTMLButtonElement;
      if (saveCloudBtn) {
        saveCloudBtn.disabled = true;
        saveCloudBtn.classList.add('btn-disabled');
        const hint = document.querySelector('.save-cloud-hint') as HTMLElement;
        if (hint) hint.style.display = '';
      }
    }
  });
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

  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      if (hamburgerBtn && navTabs) {
        hamburgerBtn.classList.remove('open');
        navTabs.classList.remove('open');
      }

      const target = (e.target as HTMLElement).getAttribute('data-tab');
      if (target) {
        document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
        (e.target as HTMLElement).classList.add('active');
        document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        const tabEl = document.getElementById(target);
        if (tabEl) tabEl.classList.add('active');

        if (tabEl) {
          void featureRegistry.mount(target, tabEl).catch((error) => {
            console.error(`Failed to load module for tab ${target}:`, error);
            tabEl.innerHTML = '<p style="padding: 20px; color: #d32f2f;">Error loading module. Please check your connection.</p>';
          });
        }
      }
    });
  });

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        if (guestSessionActive) {
          guestSessionActive = false;
          authPromptRequested = true;
          await teardownAuthSession();
          showAuthScreen();
          logoutBtn.style.display = 'none';
          return;
        }
        await teardownAuthSession();
        await authCoordinator.signOut();
      } catch (e) {
        console.error('Logout failed:', e);
      }
    });
  }
}

// Auto-refresh dashboard when state changes
function setupDashboardAutoRefresh() {
  setInterval(() => {
    const dashboardTab = document.querySelector('[data-tab="dashboard"]');
    if (dashboardTab && dashboardTab.classList.contains('active')) {
      renderDashboard();
    }
  }, 5000);
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
function setupTheme() {
  const toggleInput = document.getElementById('theme-toggle') as HTMLInputElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('fire-os-theme');

  const setDarkTheme = (isDark: boolean) => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    localStorage.setItem('fire-os-theme', isDark ? 'dark' : 'light');
    if (toggleInput) toggleInput.checked = isDark;
    window.dispatchEvent(new Event('themeChanged'));
  };

  // Initial setup
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    setDarkTheme(true);
  } else {
    setDarkTheme(false);
  }

  if (toggleInput) {
    toggleInput.addEventListener('change', (e) => {
      setDarkTheme((e.target as HTMLInputElement).checked);
    });
  }
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
  setInterval(async () => {
    console.debug('[API] Background auto-refreshing NAVs...');
    const sipsToFetch = Object.entries(appState.sip).filter(([, fund]) => fund.units && fund.units > 0);
    let updated = false;
    for (const [, fund] of sipsToFetch) {
      const schemeCode = fund.schemeCode || getFundSchemeCode(fund.name);
      if (schemeCode) {
        try {
          const oldNav = appState.nav[schemeCode]?.nav;
          const newNav = await fetchNAV(schemeCode);
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
    if (updated) {
          persistPortfolioState(appState);
      const dashboardTab = document.querySelector('[data-tab="dashboard"]');
      if (dashboardTab && dashboardTab.classList.contains('active')) {
        renderDashboard();
      }
    }
  }, CONFIG.cacheTtl.nav); // run at NAV cache TTL interval
}
