# Quick Start Guide for Developers

Get up and running with FIRE OS in 5 minutes.

## Setup

### Prerequisites
- Git
- Node.js 16+ (for npm)
- A modern browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# Clone repository
git clone https://github.com/Rohan0603/fire-os.git
cd fire-os

# Install dependencies
npm install

# Start dev server
npm run dev

# Opens http://localhost:5173 in browser
# HMR auto-reloads on file changes
```

## Project Structure Overview

```
src/
├── main.ts              # App entry point (Firebase init, module registration)
├── types/               # TypeScript interfaces (state, portfolio, api, firebase)
├── lib/                 # Utility libraries (calculations, storage, validators)
├── utils/               # Error handling
└── modules/             # Feature modules
    ├── auth/            # Firebase authentication
    ├── ui/              # Shared UI components (Modal, Card, Form, Toast)
    ├── api/             # External API integrations (NAV, Nifty, EUR/INR)
    ├── dashboard/       # Portfolio dashboard (KPI calculations)
    ├── profile/         # Portfolio form (PDF import, data management)
    └── calculators/     # Financial calculators

docs/
├── ARCHITECTURE.md      # Detailed module structure & data flow
├── API.md               # API documentation & error handling
└── This file
```

## Architecture in 30 Seconds

1. **Modular Design:** Each feature is a module in `src/modules/` with init/render functions
2. **Centralized State:** All data flows through global `D` object (Firebase + localStorage persistence)
3. **Event Delegation:** Modules communicate via custom events, not direct imports
4. **Error Resilience:** Multi-layer error handling ensures app continues if one module fails
5. **API Caching:** Smart TTL caching prevents over-fetching (NAV: 4h, Nifty: 1h, EUR/INR: 24h)

## Common Tasks

### Add a New Field to Portfolio

1. Update type in `src/types/state.ts`:
```typescript
interface FireOSState {
  // ... existing fields
  myNewField: string | number;
}
```

2. Use in code:
```typescript
D.myNewField = 'value';
```

3. Persist automatically (Firebase + localStorage handle it)

### Create a New Calculator

1. Create module:
```bash
mkdir -p src/modules/mycalculator
touch src/modules/mycalculator/index.ts
```

2. Add init/render functions:
```typescript
export function initMyCalculatorModule(containerId: string) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  renderMyCalculator(container);
  attachHandlers(container);
}

export function renderMyCalculator(container: HTMLElement) {
  container.innerHTML = `
    <div class="calculator">
      <h2>My Calculator</h2>
      <input type="number" id="input" />
      <button id="calculate">Calculate</button>
      <div id="result"></div>
    </div>
  `;
  attachHandlers(container);
}

function attachHandlers(container: HTMLElement) {
  container.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'calculate') {
      const input = parseInt((container.querySelector('#input') as HTMLInputElement).value);
      const result = input * 2; // Example calculation
      (container.querySelector('#result') as HTMLElement).textContent = `Result: ${result}`;
    }
  });
}
```

3. Register in `src/main.ts`:
```typescript
import { initMyCalculatorModule } from './modules/mycalculator';

function initApp() {
  // ... existing inits
  initMyCalculatorModule('mycalculator-container');
}
```

4. Add HTML container in `index.html`:
```html
<div id="mycalculator-container"></div>
```

### Update Dashboard KPIs

KPI calculations are in `src/modules/dashboard/kpis.ts`:

```typescript
export function calculateKPIs(state: FireOSState) {
  return {
    netWorth: calculateNetWorth(state),
    fiProgress: calculateFIProgress(state),
    // ... other KPIs
  };
}
```

Update a KPI:
```typescript
export function calculateNetWorth(state: FireOSState): number {
  const { profile, sip, fd, epf, esop, demat } = state;
  
  // Add up all holdings
  const sipValue = calculateSIPValue(sip);
  const dematValue = Object.values(demat).reduce((sum, h) => sum + h.currentValue, 0);
  
  return sipValue + fd.amount + epf.amount + esop.amount + dematValue;
}
```

Then dashboard re-renders automatically when data changes.

### Add Tests

1. Create test file:
```typescript
// tests/mycalculator.test.ts
import { test, expect } from '@playwright/test';

test('my calculator works', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Interact with your calculator
  await page.fill('#input', '5');
  await page.click('#calculate');
  
  // Verify result
  const result = await page.locator('#result').textContent();
  expect(result).toBe('Result: 10');
});
```

2. Run tests:
```bash
# Run all tests
npm run test

# Run with interactive UI
npm run test:ui

# Run specific test file
npm run test -- tests/mycalculator.test.ts
```

### Debug a Bug

1. Open DevTools: `F12`
2. Check **Console** tab for errors
3. Check **Network** tab for API calls
4. Set breakpoints in **Sources** tab (TypeScript available via source maps)
5. Type variables in console to inspect state:
```javascript
// Check current state
console.log(D);

// Check specific field
console.log(D.profile.age);

// Check cache
console.log(D.nav);
```

### Check API Data

Open browser console and test APIs:

```javascript
// Test NAV fetch
fetch('https://api.mfapi.in/mf/122639')
  .then(r => r.json())
  .then(d => console.log(d.data[0].nav));

// Test Nifty fetch
const url = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=^NSEI';
fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`)
  .then(r => r.text())
  .then(d => console.log(JSON.parse(d).quoteResponse.result[0]));

// Check cache
console.log(D.nav, D.niftyData, D.eurInr);
```

## Available Scripts

```bash
# Development
npm run dev          # Start Vite dev server with HMR (hot reload)
npm run build        # Build production bundle to dist/
npm run preview      # Preview production build locally

# Testing
npm run test         # Run all tests (headless)
npm run test:ui      # Run tests with interactive UI
npm run test:debug   # Debug single test with breakpoints

# Firebase (optional)
firebase login       # Login to Firebase
firebase deploy      # Deploy to Firebase Hosting
```

## Module Lifecycle Recap

Each module follows this pattern:

```typescript
// 1. Initialize (called once on app start)
export function initModule(containerId: string) {
  const container = document.getElementById(containerId);
  if (container) renderModule(container);
}

// 2. Render (called when data changes)
export function renderModule(container: HTMLElement) {
  container.innerHTML = buildHTML();
  attachHandlers(container);
}

// 3. Handle Events (user interactions)
function attachHandlers(container: HTMLElement) {
  container.addEventListener('click', (e) => {
    // Handle click
    updateState();
    renderModule(container); // Re-render on state change
  });
  
  // Listen for changes from other modules
  document.addEventListener('profileUpdated', () => {
    renderModule(container);
  });
}
```

## State Management Quick Reference

```typescript
// Read state
const age = D.profile.age;
const navPrice = D.nav['122639']?.nav;

// Write state
D.profile.age = 30;

// Persist to Firebase + localStorage
await savePortfolioToFirebase(D.currentUser.uid, D);

// Dispatch event (notify other modules)
document.dispatchEvent(new CustomEvent('profileUpdated'));

// Listen for changes
document.addEventListener('profileUpdated', () => {
  // Re-render, recalculate, etc.
});
```

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/main.ts` | App bootstrap, Firebase init, module registration |
| `src/types/state.ts` | Global state interface (D object) |
| `src/lib/calculations.ts` | Financial formulas (XIRR, SIP P&L, etc.) |
| `src/modules/auth/index.ts` | Firebase authentication |
| `src/modules/api/index.ts` | API integrations (NAV, Nifty, EUR/INR) |
| `src/modules/dashboard/index.ts` | Dashboard rendering & KPI display |
| `src/modules/profile/index.ts` | Portfolio form & PDF import |
| `index.html` | HTML entry point, module containers |
| `vite.config.ts` | Vite build configuration |
| `tsconfig.json` | TypeScript configuration |

## Common Issues & Fixes

### App won't start
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### API calls fail (NAV shows ⚠)
- Check browser console (F12 → Console)
- Try again (API might be rate-limited)
- Manually enter NAV in Profile tab
- Check internet connection

### Data not persisting
- Check if user is authenticated (login required for cloud sync)
- Check localStorage (DevTools → Application → Storage)
- Check Firebase console (fire-os-dd6d6.firebaseapp.com)

### Build fails
- Check TypeScript errors: `npm run build`
- Check console warnings during dev
- Ensure all imports are correct (no circular dependencies)

## Next Steps

1. **Read full docs:** [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed module structure
2. **Understand APIs:** [API.md](docs/API.md) for external integrations
3. **Explore code:** Start with `src/main.ts`, then follow imports
4. **Make a change:** Pick a simple task (add field, update KPI, new calculator)
5. **Test locally:** `npm run dev` and verify in browser
6. **Submit PR:** Follow conventional commit format (see CLAUDE.md)

## Getting Help

1. **Check DevTools Console:** Error messages appear there
2. **Read error boundaries:** Each module has try-catch, shows user-friendly toast
3. **Check Network tab:** See API calls and responses
4. **Review CLAUDE.md:** Development guide with more details
5. **Open an issue:** GitHub repo issues page

---

**Happy coding! 🚀**
