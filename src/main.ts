import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { loadPortfolioFromFirebase, savePortfolioToFirebase } from './lib/storage';

// Import types
import type { FireOSState } from './types/state';
import { initializeState } from './types/state';

// Import auth module
import { renderAuthScreen, hideAuthScreen, showAuthScreen, initAuthModule } from './modules/auth';

// Import UI module
import { initUIModule } from './modules/ui';

// Import dashboard module
import { initDashboardModule, renderDashboard } from './modules/dashboard';

// Import profile module
import { initProfileModule, saveProfile } from './modules/profile';

// Import calculators module
import { initCalculatorsModule } from './modules/calculators';

// Import watchdog module
import { initWatchdogModule } from './modules/watchdog';

// Import API module
import { initAPIModule } from './modules/api';

// Import error handling
import { setupErrorHandling, handleError } from './lib/error-handler';
import { showToast } from './modules/ui';

// Import styles
import './styles/global.css';
import './styles/layout.css';
import './styles/tokens.css';

// Global state object - properly typed
export const D: FireOSState = initializeState();

// Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyBD38ygGdv7IeAOh5V8tI5Ih0DpTk2niww',
  authDomain: 'fire-os-dd6d6.firebaseapp.com',
  databaseURL: 'https://fire-os-dd6d6-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'fire-os-dd6d6',
  storageBucket: 'fire-os-dd6d6.firebasestorage.app',
  messagingSenderId: '824527645307',
  appId: '1:824527645307:web:7dc209d225e8280d17d0de',
  measurementId: 'G-8JFDMMJ8QM',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// Load data from localStorage
function loadFromLocalStorage() {
  const stored = localStorage.getItem('fireOS_v2');
  if (stored) {
    try {
      const data = JSON.parse(stored);
      // Sanitize holdings fields: ensure they're objects, not primitives
      const sanitized = {
        ...data,
        fd: typeof data.fd === 'object' && data.fd !== null ? data.fd : {},
        epf: typeof data.epf === 'object' && data.epf !== null ? data.epf : {},
        esop: typeof data.esop === 'object' && data.esop !== null ? data.esop : {},
        mf: typeof data.mf === 'object' && data.mf !== null ? data.mf : {},
        sip: typeof data.sip === 'object' && data.sip !== null ? data.sip : {},
        demat: typeof data.demat === 'object' && data.demat !== null ? data.demat : {},
      };
      Object.assign(D, sanitized);
    } catch (e) {
      console.error('Failed to load localStorage:', e);
    }
  }
}

// Initialize app on startup
function initApp() {
  try {
    setupErrorHandling();
    loadFromLocalStorage();
    initAPIModule(D);
    renderApp();

    // Initialize UI module with error handling
    try {
      initUIModule();
    } catch (e) {
      console.error('Failed to initialize UI module:', e);
      handleError(e, 'UI module initialization failed');
    }

    // Initialize profile module with error handling
    try {
      initProfileModule('profile');
    } catch (e) {
      console.error('Failed to initialize Profile module:', e);
      handleError(e, 'Profile module initialization failed');
      const profileEl = document.getElementById('profile');
      if (profileEl) profileEl.innerHTML = '<p style="padding: 20px; color: #d32f2f;">Error loading Profile module. Please reload.</p>';
    }

    // Initialize dashboard module with error handling
    try {
      initDashboardModule('dashboard');
    } catch (e) {
      console.error('Failed to initialize Dashboard module:', e);
      handleError(e, 'Dashboard module initialization failed');
      const dashEl = document.getElementById('dashboard');
      if (dashEl) dashEl.innerHTML = '<p style="padding: 20px; color: #d32f2f;">Error loading Dashboard module. Please reload.</p>';
    }

    // Initialize calculators module with error handling
    try {
      initCalculatorsModule('calculators');
    } catch (e) {
      console.error('Failed to initialize Calculators module:', e);
      handleError(e, 'Calculators module initialization failed');
      const calcEl = document.getElementById('calculators');
      if (calcEl) calcEl.innerHTML = '<p style="padding: 20px; color: #d32f2f;">Error loading Calculators module. Please reload.</p>';
    }

    // Initialize watchdog module with error handling
    try {
      initWatchdogModule('watchdog');
    } catch (e) {
      console.error('Failed to initialize Watchdog module:', e);
      handleError(e, 'Watchdog module initialization failed');
      const watchEl = document.getElementById('watchdog');
      if (watchEl) watchEl.innerHTML = '<p style="padding: 20px; color: #d32f2f;">Error loading Watchdog module. Please reload.</p>';
    }

    setupAuthListener();
    setupTabNavigation();
    setupAutoSave();
    setupDashboardAutoRefresh();
    setupOfflineNotification();
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
      <div class="nav-tabs">
        <button class="nav-tab active" data-tab="profile">Profile</button>
        <button class="nav-tab" data-tab="dashboard">Dashboard</button>
        <button class="nav-tab" data-tab="calculators">Calculators</button>
        <button class="nav-tab" data-tab="watchdog">Watchdog</button>
      </div>
      <button id="logout-btn" class="btn-logout" style="display: none;">Logout</button>
    </nav>

    <div id="auth-screen"></div>

    <div class="tabs-container">
      <div id="profile" class="tab active"></div>
      <div id="dashboard" class="tab"></div>
      <div id="calculators" class="tab"></div>
      <div id="watchdog" class="tab"></div>
    </div>
  `;

  // Initialize and render auth screen
  initAuthModule('auth-screen');
  renderAuthScreen();
}

// Firebase auth listener
function setupAuthListener() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      D.currentUser = user;
      hideAuthScreen();
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) logoutBtn.style.display = 'block';

      // Load portfolio from Firebase on login
      try {
        const firebaseState = await loadPortfolioFromFirebase(user.uid);
        if (firebaseState) {
          Object.assign(D, firebaseState);
          console.debug('[Auth] Loaded portfolio from Firebase');
        }
      } catch (e) {
        console.warn('[Auth] Failed to load from Firebase:', e);
      }
    } else {
      D.currentUser = null;
      showAuthScreen();
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) logoutBtn.style.display = 'none';
    }
  });
}

// Tab navigation
function setupTabNavigation() {
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      // Save profile when leaving profile tab
      const currentTab = document.querySelector('.nav-tab.active')?.getAttribute('data-tab');
      if (currentTab === 'profile') {
        try {
          saveProfile();
        } catch (err) {
          console.warn('[Tab] Profile save failed on tab change:', err);
        }
      }

      const target = (e.target as HTMLElement).getAttribute('data-tab');
      if (target) {
        document.querySelectorAll('.nav-tab').forEach((t) => t.classList.remove('active'));
        (e.target as HTMLElement).classList.add('active');
        document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        const tabEl = document.getElementById(target);
        if (tabEl) tabEl.classList.add('active');

        // Render dashboard when tab is activated
        if (target === 'dashboard') {
          renderDashboard();
        }
      }
    });
  });

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth);
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

// Auto-save every 5 seconds
function setupAutoSave() {
  setInterval(() => {
    D._lastSavedAt = new Date().toISOString();
    localStorage.setItem('fireOS_v2', JSON.stringify(D));

    // Sync to Firebase if user is logged in
    if (D.currentUser?.uid) {
      savePortfolioToFirebase(D.currentUser.uid, D).catch((e) => {
        console.warn('[Storage] Firebase sync failed:', e);
      });
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

// Start app
document.addEventListener('DOMContentLoaded', initApp);
