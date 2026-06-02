import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Import types
import type { FireOSState } from './types/state';
import { initializeState } from './types/state';

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
  renderApp();
  setupAuthListener();
  setupTabNavigation();
  setupAutoSave();
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

    <div id="login-screen" class="login-screen">
      <div class="login-container">
        <h1>FIRE OS</h1>
        <p>Sign up or login to get started</p>
        <form id="auth-form">
          <input type="email" id="auth-email" placeholder="Email" required>
          <input type="password" id="auth-password" placeholder="Password (6+ chars)" required>
          <button type="button" id="signup-btn">Sign Up</button>
          <button type="button" id="login-btn">Login</button>
        </form>
        <p id="auth-error" class="error" style="display: none;"></p>
      </div>
    </div>

    <div class="tabs-container">
      <div id="profile" class="tab active"></div>
      <div id="dashboard" class="tab"></div>
      <div id="calculators" class="tab"></div>
      <div id="esop" class="tab"></div>
      <div id="watchdog" class="tab"></div>
    </div>
  `;
}

// Firebase auth listener
function setupAuthListener() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      D.currentUser = user;
      hideLoginScreen();
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) logoutBtn.style.display = 'block';
    } else {
      D.currentUser = null;
      showLoginScreen();
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) logoutBtn.style.display = 'none';
    }
  });
}

// Show/hide auth screens
function showLoginScreen() {
  const screen = document.getElementById('login-screen');
  if (screen) screen.style.display = 'flex';
}

function hideLoginScreen() {
  const screen = document.getElementById('login-screen');
  if (screen) screen.style.display = 'none';
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
      }
    });
  });

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      signOut(auth).catch((e) => console.error('Logout failed:', e));
    });
  }
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
