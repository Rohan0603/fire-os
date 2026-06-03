# FIRE OS Architecture

## Overview

FIRE OS is a personal finance dashboard for FIRE (Financial Independence, Retire Early) planning. Built with **Vite + TypeScript**, it features a **modular architecture** with clear separation of concerns: authentication, API integrations, calculations, UI components, and state management.

The app helps users:
- Track portfolio holdings (Mutual Funds, FDs, EPF, SIPs, ESOPs, Demat stocks)
- Fetch live NAV prices and market indices
- Calculate SIP P&L with XIRR (Newton-Raphson method)
- Import portfolio data from CAS PDFs
- Simulate market crashes and run financial calculators
- Sync data across devices via Firebase

## Project Structure

```
fire-os/
├── src/
│   ├── main.ts                 # App bootstrap, Firebase init, module registration
│   ├── types/                  # TypeScript interfaces & types
│   │   ├── state.ts           # Global FireOSState interface
│   │   ├── portfolio.ts       # Portfolio data types
│   │   ├── api.ts             # API response types
│   │   └── firebase.ts        # Firebase types
│   ├── lib/                    # Utility libraries (no UI)
│   │   ├── calculations.ts    # Financial calculations (XIRR, SIP P&L, FI)
│   │   ├── storage.ts         # Firebase + localStorage sync
│   │   ├── validators.ts      # Input validation rules
│   │   ├── formatters.ts      # Number/currency/date formatting
│   │   ├── logger.ts          # Logging utilities (dev vs prod)
│   │   └── error-handler.ts   # Global error handling
│   ├── utils/
│   │   └── errors.ts          # Custom error types
│   ├── modules/                # Feature modules (each with UI + logic)
│   │   ├── auth/              # Firebase authentication (signup, login, logout)
│   │   │   ├── index.ts       # Module entry point
│   │   │   ├── firebaseAuth.ts # Firebase config & handlers
│   │   │   └── validation.ts  # Auth validation rules
│   │   ├── ui/                # Shared UI components
│   │   │   ├── Modal.ts       # Modal component
│   │   │   ├── Card.ts        # Card component
│   │   │   ├── Form.ts        # Form component
│   │   │   ├── Toast.ts       # Toast notification
│   │   │   └── index.ts       # Component exports
│   │   ├── api/               # External API integrations
│   │   │   ├── mfapi.ts       # Mutual Fund NAV fetching
│   │   │   ├── nifty.ts       # Nifty index + 52W high
│   │   │   ├── eurInr.ts      # EUR/INR exchange rate
│   │   │   ├── fallbacks.ts   # Fallback & cache utilities
│   │   │   ├── pdf-parser.ts  # CAS PDF parsing (PDF.js)
│   │   │   └── index.ts       # API module initialization
│   │   ├── dashboard/         # Portfolio dashboard
│   │   │   ├── index.ts       # Dashboard rendering & initialization
│   │   │   └── kpis.ts        # KPI calculation functions
│   │   ├── profile/           # Portfolio form & data management
│   │   │   ├── index.ts       # Profile tab rendering
│   │   │   └── pdf-parser.ts  # CAS PDF import handlers
│   │   └── calculators/       # Financial calculators
│   │       └── index.ts       # Calculators tab rendering
│   └── styles/                # Global CSS
│       ├── global.css
│       └── layout.css
├── dist/                       # Build output (Vite) — dist/index.html
├── tests/                      # Playwright E2E + Unit tests
│   ├── auth.e2e.ts           # Firebase auth flow
│   ├── dashboard.test.ts     # Dashboard KPI calculations
│   ├── calculations.test.ts  # Financial calculators (XIRR, SIP P&L)
│   ├── api.test.ts           # API integrations
│   └── state.test.ts         # State management
├── docs/                       # Documentation
│   ├── ARCHITECTURE.md        # This file
│   └── API.md                 # API endpoints & response schemas
├── index.html                 # Entry point HTML
├── vite.config.ts             # Vite configuration
├── tsconfig.json              # TypeScript configuration
├── playwright.config.ts       # Playwright test configuration
├── package.json               # Dependencies & scripts
├── README.md                  # User-facing overview
├── CLAUDE.md                  # Developer guide for Claude Code
├── QUICKSTART.md              # Quick reference for developers
└── .gitignore
```

## Module Lifecycle

Each module follows a standard lifecycle pattern:

### Module Initialization (main.ts)

```typescript
// src/main.ts
async function initApp() {
  // 1. Initialize Firebase
  initFirebase();
  
  // 2. Check authentication status
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // User logged in
      D.currentUser = user;
      await loadPortfolioFromFirebase(user.uid);
      renderApp(); // Render main dashboard
    } else {
      // User not logged in
      renderAuthScreen(); // Show login/signup
    }
  });
  
  // 3. Register modules
  initAuthModule('auth-container');
  initDashboardModule('dashboard-container');
  initProfileModule('profile-container');
  initCalculatorsModule('calculators-container');
}
```

### Module Pattern

Each module exports standard lifecycle functions:

```typescript
// src/modules/feature/index.ts

// 1. Initialize: Setup event listeners, fetch initial data
export function initFeatureModule(containerId: string) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  renderFeature(container);
  attachEventHandlers(container);
}

// 2. Render: Update UI based on current state (D object)
export function renderFeature(container: HTMLElement) {
  const html = buildFeatureHTML();
  container.innerHTML = html;
  attachEventHandlers(container);
}

// 3. Attach Handlers: Setup user interaction listeners
function attachEventHandlers(container: HTMLElement) {
  container.addEventListener('click', handleFeatureClick);
  document.addEventListener('profileUpdated', () => {
    renderFeature(container); // Re-render on data change
  });
}

// 4. Expose render function for external updates
export { renderFeature };
```

### Module Communication Pattern

Modules are **decoupled** and communicate through:

1. **Shared State (D object)**
   - All modules read/write to global `D` (FireOSState)
   - Example: Dashboard reads `D.portfolio`, profile writes to `D.profile`

2. **Custom Events**
   - Modules dispatch events: `document.dispatchEvent(new CustomEvent('profileUpdated'))`
   - Other modules listen: `document.addEventListener('profileUpdated', ...)`

3. **Module Functions**
   - One module calls another's exported function directly
   - Example: Dashboard calls `calculateSIPPL()` from calculations.ts

## State Management (D Object)

The global state object `D` (type: `FireOSState`) represents the **entire app state**.

### Core Structure

```typescript
interface FireOSState {
  // User authentication
  currentUser: {
    uid: string;
    email: string;
    lastLogin: string;
  } | null;
  
  // Portfolio data
  profile: {
    name: string;
    age: number;
    annualExpenses: number;
    fiTarget: number; // Target corpus (25x annual expenses)
    // ... other fields
  };
  
  // Holdings
  sip: {
    sip1: { units: number; amount: number; sipStart: string; ... };
    sip2: { ... };
    // ... sip3, sip4
  };
  fd: { amount: number };
  epf: { amount: number };
  esop: { amount: number; shares: number; price: number };
  demat: {
    [isin: string]: {
      name: string;
      quantity: number;
      currentValue: number;
    };
  };
  
  // Cached API data
  nav: {
    [schemeCode: string]: {
      nav: number;
      timestamp: number;
    };
  };
  niftyData: {
    level: number;
    high52w: number;
    source: 'Yahoo Finance' | 'ETF Approximation' | 'cached' | 'manual';
    timestamp: number;
  };
  eurInr: {
    rate: number;
    timestamp: number;
  };
  
  // Metadata
  _lastSavedAt: string; // ISO timestamp
  _version: 'fireOS_v2'; // Data format version
}
```

### State Updates

```typescript
// 1. Direct mutation (not recommended for complex updates)
D.profile.age = 30;

// 2. Structured update (recommended)
function updateProfile(updates: Partial<FireOSState['profile']>) {
  // Validate inputs
  const errors = validateProfileInputs(updates);
  if (errors.length > 0) {
    showErrorToast(errors[0]);
    return false;
  }
  
  // Update state
  D.profile = { ...D.profile, ...updates };
  
  // Persist
  localStorage.setItem('fireOS_state', JSON.stringify(D));
  if (D.currentUser) {
    savePortfolioToFirebase(D.currentUser.uid, D);
  }
  
  // Notify other modules
  document.dispatchEvent(new CustomEvent('profileUpdated', { detail: D }));
  
  return true;
}

// 3. Dashboard recalculation (debounced)
function updateDashboard() {
  // Recalculate all KPIs
  const kpis = calculateKPIs(D);
  
  // Render updated dashboard
  const dashboardContainer = document.getElementById('dashboard');
  if (dashboardContainer) {
    renderDashboard(dashboardContainer, kpis);
  }
}
```

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│  User Interaction (Form Input, Button Click)            │
└────────────────────┬────────────────────────────────────┘
                     │
                     v
┌─────────────────────────────────────────────────────────┐
│  Input Validation (ValidationRules)                     │
│  - Check type, length, range                            │
│  - Show inline errors if invalid                        │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴────────────┐
         │ Valid                  │ Invalid
         v                        v
    ┌────────────┐          ┌──────────────┐
    │ Save to D  │          │ Show Error   │
    └─────┬──────┘          │ Toast        │
          │                 └──────────────┘
          v
┌─────────────────────────────────────────────────────────┐
│  Persist Data                                           │
│  - localStorage (immediate, offline-safe)              │
│  - Firebase Realtime DB (if authenticated)             │
│  - Set D._lastSavedAt = ISO timestamp                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     v
┌─────────────────────────────────────────────────────────┐
│  Dispatch Event (profileUpdated, etc.)                  │
└────────────────────┬────────────────────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
    v                v                v
┌──────────┐  ┌──────────────┐  ┌──────────────┐
│ Dashboard│  │ Calculators  │  │ Other Module │
│ Listener │  │ Listener     │  │ Listener     │
└────┬─────┘  └────┬─────────┘  └────┬─────────┘
     │             │                 │
     v             v                 v
┌────────────────────────────────────────────┐
│ Recalculate KPIs (Dashboard)               │
│ - calculateKPIs(D)                        │
│ - calculateSIPPL(sipKey)                  │
│ - calculateXIRR(cashFlows)                │
└────┬───────────────────────────────────────┘
     │
     v
┌────────────────────────────────────────────┐
│ Render Updated UI                          │
│ - renderDashboard(container, kpis)        │
│ - Chart.js re-render if visible           │
│ - Update DOM with new values               │
└────────────────────────────────────────────┘
```

## Authentication Flow

### Initial Page Load

```
1. Page loads → main.ts calls initFirebase()
2. Firebase checks localStorage for cached auth token
3. If token exists → Firebase validates token server-side
4. onAuthStateChanged() fires with user object (or null)
5. If authenticated:
   - Set D.currentUser = { uid, email, ... }
   - Call loadPortfolioFromFirebase(uid)
   - Render main dashboard
6. If not authenticated:
   - Show login/signup modal
   - Block dashboard content
```

### Sign Up Flow

```
1. User enters email + password on signup screen
2. Form validation checks:
   - Email is valid format
   - Password is 6+ characters
3. On submit → signupUser(email, password)
4. Firebase creates account + session
5. onAuthStateChanged() fires with new user
6. Set D.currentUser
7. Create empty portfolio in Firebase: /users/{uid}/portfolio
8. Render main dashboard
```

### Login Flow

```
1. User enters email + password on login screen
2. Form validation
3. On submit → loginUser(email, password)
4. Firebase validates credentials server-side
5. onAuthStateChanged() fires with user
6. Set D.currentUser
7. Call loadPortfolioFromFirebase(uid)
   - Fetch from /users/{uid}/portfolio
   - Merge with localStorage (resolve conflicts)
   - Update D object
8. Render main dashboard with loaded data
```

### Logout Flow

```
1. User clicks logout button
2. Call logoutUser()
3. Firebase clears session
4. Clear D.currentUser = null
5. Clear sensitive data from D
6. Clear browser auth tokens
7. Show login/signup modal
8. Render auth screen
```

## API Caching Strategy

All external APIs use intelligent caching with TTL (time-to-live) validation:

| API | Endpoint | TTL | Source | Fallback |
|-----|----------|-----|--------|----------|
| **NAV** | api.mfapi.in | 4 hours | Mutual Funds API | Manual entry |
| **Nifty** | Yahoo Finance | 1 hour | Yahoo Finance CORS proxy | ETF approx → Manual |
| **EUR/INR** | Yahoo Finance | 24 hours | Yahoo Finance CORS proxy | Cached rate → Manual |

### Cache Flow

```typescript
async function fetchNAV(schemeCode: string): Promise<number | null> {
  // 1. Check if cache exists and is fresh
  const cached = getCachedNAV(schemeCode);
  if (cached && !isExpired(cached.timestamp, 4 * 60 * 60 * 1000)) {
    return cached.nav;
  }
  
  // 2. Try fresh fetch (with 5-second timeout)
  try {
    const response = await fetch(`https://api.mfapi.in/mf/${schemeCode}`, {
      signal: AbortSignal.timeout(5000)
    });
    const data = await response.json();
    const nav = parseFloat(data.data[0].nav);
    
    // 3. Update cache
    setCachedNAV(schemeCode, { nav, timestamp: Date.now() });
    
    return nav;
  } catch (error) {
    logger.error(`NAV fetch failed for ${schemeCode}:`, error);
    
    // 4. Fallback to stale cache (even if expired)
    if (cached) {
      return cached.nav; // Use stale data
    }
    
    // 5. Show manual entry modal if no cache
    return await showManualNAVModal(schemeCode);
  }
}
```

## Error Handling

FIRE OS uses a **multi-layer error handling** approach:

### Layer 1: Global Error Handlers

```typescript
// Catch unhandled exceptions
window.addEventListener('error', (event) => {
  logger.error('Uncaught error:', event.error);
  showErrorToast('An unexpected error occurred');
});

// Catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled rejection:', event.reason);
  showErrorToast('An unexpected error occurred');
});
```

### Layer 2: Module-Level Try-Catch

```typescript
export function initDashboardModule(containerId: string) {
  try {
    const container = document.getElementById(containerId);
    if (!container) throw new Error('Dashboard container not found');
    
    const kpis = calculateKPIs(D);
    renderDashboard(container, kpis);
  } catch (error) {
    logger.error('Dashboard init failed:', error);
    showErrorToast('Dashboard failed to load');
    // App continues, other modules still work
  }
}
```

### Layer 3: API Error Handling

```typescript
// All API calls have timeout + fallback
try {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(5000) // 5-second timeout
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.json();
} catch (error) {
  if (error instanceof TypeError) {
    // Network error
    showErrorToast('Network error. Check your internet connection.');
  } else if (error.name === 'AbortError') {
    // Timeout
    showErrorToast('Request timed out. Try again.');
  } else {
    // API error
    showErrorToast('Unable to fetch data. Using cached value.');
  }
  return null; // Caller handles null
}
```

### Layer 4: Form Validation

```typescript
function handleProfileSave() {
  const updates = {
    name: document.getElementById('name').value,
    age: parseInt(document.getElementById('age').value),
    // ...
  };
  
  // Validate before saving
  const errors = validateProfileInputs(updates);
  if (errors.length > 0) {
    showInlineError('name', errors[0]);
    return false; // Don't save
  }
  
  // Save if valid
  updateProfile(updates);
  showSuccessToast('Profile saved');
  return true;
}
```

### Layer 5: Offline Detection

```typescript
window.addEventListener('online', () => {
  showSuccessToast('You are online. Syncing data...');
  if (D.currentUser) {
    syncPortfolioToFirebase();
  }
});

window.addEventListener('offline', () => {
  showWarningToast('You are offline. Changes saved locally.');
});
```

## Adding New Features

Follow this checklist to add a new feature:

### 1. Plan the Feature

- Define state changes (what gets added to D?)
- Define UI (new tab, modal, or existing tab update?)
- Define interactions (what events trigger updates?)

### 2. Update Types

```typescript
// src/types/state.ts
interface FireOSState {
  // ... existing fields
  newFeature: {
    // new field schema
  };
}
```

### 3. Create Module

```typescript
// src/modules/newfeature/index.ts
export function initNewFeatureModule(containerId: string) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  renderNewFeature(container);
  attachHandlers(container);
}

export function renderNewFeature(container: HTMLElement) {
  // Build and render UI
  container.innerHTML = buildHTML();
  attachHandlers(container);
}

function attachHandlers(container: HTMLElement) {
  // Attach event listeners
  container.addEventListener('click', handleClick);
  document.addEventListener('profileUpdated', () => {
    renderNewFeature(container);
  });
}
```

### 4. Register in main.ts

```typescript
// src/main.ts
import { initNewFeatureModule } from './modules/newfeature';

function initApp() {
  // ... existing inits
  initNewFeatureModule('newfeature-container');
}
```

### 5. Add Tests

```typescript
// tests/newfeature.test.ts
import { test, expect } from '@playwright/test';

test('new feature works correctly', async ({ page }) => {
  await page.goto('http://localhost:5173');
  // ... test steps
  expect(await page.locator('.newfeature').isVisible()).toBe(true);
});
```

### 6. Update Documentation

- Add description to CLAUDE.md or API.md
- Update README.md features list if user-visible
- Add code comments for complex logic

## Performance Optimizations

### Current Optimizations (v2.2)

1. **Debounced Dashboard Recalculation**
   - Profile form input triggers updateDashboard after 500ms delay
   - Prevents recalculating on every keystroke

2. **API Caching with TTL**
   - NAV: 4 hours (updated daily)
   - Nifty: 1 hour (updates frequently for crash simulations)
   - EUR/INR: 24 hours (daily forex update)

3. **Lazy-Loaded Charts**
   - Chart.js only renders when tab is visible
   - Saves CPU on page load

4. **Production Build Optimization**
   - Vite tree-shakes unused code
   - Minification (~89 KB gzipped)
   - CSS autoprefixer for browser compatibility

5. **Firebase Offline Persistence**
   - Changes auto-saved to localStorage
   - Auto-synced to Firebase when online
   - No data loss on network interruption

### Future Optimizations (v2.3+)

- Virtual scrolling for long calculator lists
- Service Worker for API response caching
- Module-level code splitting (lazy-load heavy features)
- Image optimization & WebP format

## Testing Strategy

### Unit Tests (Vitest)

Located in `tests/` with `.test.ts` extension.

Test financial calculations in isolation:

```typescript
// tests/calculations.test.ts
import { calculateXIRR, calculateSIPPL } from '../src/lib/calculations';
import { expect, test } from 'vitest';

test('calculateXIRR returns correct value for simple cash flows', () => {
  const cashFlows = [
    { date: new Date('2020-01-01'), amount: -1000 },
    { date: new Date('2021-01-01'), amount: 1100 }
  ];
  
  const xirr = calculateXIRR(cashFlows);
  expect(xirr).toBeCloseTo(0.10, 2); // ~10% return
});
```

### E2E Tests (Playwright)

Located in `tests/` with `.e2e.ts` extension.

Test user workflows:

```typescript
// tests/auth.e2e.ts
import { test, expect } from '@playwright/test';

test('user can sign up and login', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Sign up
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button:has-text("Sign Up")');
  
  // Verify dashboard loads
  await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
  
  // Verify data synced across tab
  const page2 = await browser.newPage();
  await page2.goto('http://localhost:5173');
  await page2.fill('input[type="email"]', 'test@example.com');
  await page2.fill('input[type="password"]', 'password123');
  await page2.click('button:has-text("Log In")');
  
  // Verify same data appears
  await expect(page2.locator('[data-testid="dashboard"]')).toBeVisible();
});
```

### Running Tests

```bash
# Run all tests (headless)
npm run test

# Run tests with interactive UI
npm run test:ui

# Run single test with debugger
npm run test:debug tests/auth.e2e.ts

# Run tests on specific file pattern
npm run test -- calculations.test.ts
```

## Deployment

### Development

```bash
# Start dev server with HMR
npm run dev

# Opens http://localhost:5173 in browser
# Auto-refreshes on file changes
```

### Production Build

```bash
# Build to dist/
npm run build

# Preview build locally (production-like)
npm run preview
```

### Firebase Hosting

```bash
# Deploy to Firebase Hosting
npm run build
firebase deploy --only hosting

# Live at: https://fire-os-dd6d6.web.app
```

## Key Takeaways

1. **Modular Design**: Each feature is isolated in `src/modules/`, with clear init/render/teardown lifecycle
2. **Centralized State**: All data flows through global `D` object (Firebase + localStorage persistence)
3. **Decoupled Modules**: No direct imports between modules; use event delegation and shared state
4. **Error Resilience**: Multi-layer error handling ensures app continues even if one module fails
5. **API Caching**: Intelligent TTL caching prevents over-fetching and supports offline usage
6. **Cross-Device Sync**: Firebase Realtime DB syncs portfolio changes instantly across devices
7. **Developer Experience**: HMR during development, clear file structure, comprehensive tests

## See Also

- [API.md](API.md) — External API documentation
- [CLAUDE.md](../CLAUDE.md) — Development guide for Claude Code
- [QUICKSTART.md](../QUICKSTART.md) — Quick reference for developers
