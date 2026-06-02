import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

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
import { initProfileModule } from './modules/profile';

// Import calculators module
import { initCalculatorsModule } from './modules/calculators';

// Import styles
import './styles/global.css';
import './styles/layout.css';
import './styles/tokens.css';

// Global state object - properly typed
export const D: FireOSState = initializeState();

// Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyDq0d3iQqKv-FzxH-0KiD8r8YqQ7Gv5cAo',
  authDomain: 'fire-os-dd6d6.firebaseapp.com',
  databaseURL: 'https://fire-os-dd6d6-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'fire-os-dd6d6',
  storageBucket: 'fire-os-dd6d6.appspot.com',
  messagingSenderId: '621640055556',
  appId: '1:621640055556:web:8c6a7e9b1f4d8a2c9e3f5b',
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
      Object.assign(D, data);
    } catch (e) {
      console.error('Failed to load localStorage:', e);
    }
  }
}

// Initialize app on startup
function initApp() {
  loadFromLocalStorage();
  initUIModule();
  initProfileModule('profile');
  initDashboardModule('dashboard');
  initCalculatorsModule('calculators');
  renderApp();
  setupAuthListener();
  setupTabNavigation();
  setupAutoSave();
  setupDashboardAutoRefresh();
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
        <button class="nav-tab" data-tab="esop">ESOP Tools</button>
        <button class="nav-tab" data-tab="watchdog">Watchdog</button>
      </div>
      <button id="logout-btn" class="btn-logout" style="display: none;">Logout</button>
    </nav>

    <div id="auth-screen"></div>

    <div class="tabs-container">
      <div id="profile" class="tab active"></div>
      <div id="dashboard" class="tab"></div>
      <div id="calculators" class="tab"></div>
      <div id="esop" class="tab"></div>
      <div id="watchdog" class="tab"></div>
    </div>
  `;

  // Initialize and render auth screen
  initAuthModule('auth-screen');
  renderAuthScreen();
}

// Firebase auth listener
function setupAuthListener() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      D.currentUser = user;
      hideAuthScreen();
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) logoutBtn.style.display = 'block';
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
  }, 5000);
}

// Start app
document.addEventListener('DOMContentLoaded', initApp);
