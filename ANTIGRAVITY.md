# ANTIGRAVITY.md

This file provides comprehensive guidance to Antigravity IDE when working with FIRE OS.

## Project Overview

**FIRE OS** is a personal finance dashboard for FIRE (Financial Independence, Retire Early) planning. Built with **Vite + TypeScript**, it features a modular architecture with clear separation of concerns across auth, API, calculations, UI, and state management modules.

**Live:** https://fire-os-dd6d6.web.app  
**Version:** v2.3.0  
**Repository:** https://github.com/Rohan0603/fire-os

## Technology Stack

| Layer         | Technology                                    |
|---------------|-----------------------------------------------|
| Language      | TypeScript (strict, `noImplicitAny`)          |
| Bundler       | Vite 5 (`src/` root, output → `dist/`)        |
| UI            | Vanilla HTML/CSS (no frameworks)              |
| Charts        | Chart.js v4.4.0 (CDN)                         |
| PDF Parsing   | PDF.js v3.11.174 (CDN)                         |
| Auth          | Firebase Authentication (email/password)       |
| Database      | Firebase Realtime Database                     |
| Hosting       | Firebase Hosting (primary), GitHub Pages (alt) |
| Testing       | Playwright (E2E) + Vitest (unit, unused)       |
| Fonts         | Google Fonts (Space Mono, Fraunces, DM Sans)   |

## Quick Commands

```bash
npm run dev           # Vite dev server → http://localhost:5173
npm run build         # tsc --noEmit && vite build → dist/
npm run preview       # Preview production build
npm run test          # Playwright headless
npm run test:ui       # Playwright interactive UI
npm run test:debug    # Single test with debugger
firebase deploy       # Deploy dist/ to Firebase Hosting
```

## File Structure

```
fire-os/
├── src/                          # Source root (Vite root)
│   ├── index.html                # HTML entry point
│   ├── main.ts                   # App bootstrap, Firebase init, auth listener, tab nav
│   ├── modules/
│   │   ├── api/                  # External API integrations
│   │   │   ├── index.ts          # API module init
│   │   │   ├── mfapi.ts          # Mutual Fund NAV fetching (4-hour cache)
│   │   │   ├── nifty.ts          # Nifty 50 data (Yahoo Finance + Gold ETF fallback)
│   │   │   ├── nifty-monitor.ts  # Real-time Nifty crash monitoring (5-min poll)
│   │   │   ├── eurInr.ts         # EUR/INR exchange rate (24-hour cache)
│   │   │   └── fallbacks.ts      # Cache retrieval + manual entry modals
│   │   ├── auth/                 # Firebase auth (signup, login, logout)
│   │   │   ├── index.ts          # Auth screen render + event handlers
│   │   │   ├── firebaseAuth.ts   # Firebase auth helpers
│   │   │   ├── validation.ts     # Email/password validation
│   │   │   └── styles.css        # Auth-specific styles
│   │   ├── dashboard/            # Portfolio dashboard
│   │   │   ├── index.ts          # Dashboard render + SIP P&L + crash alerts
│   │   │   ├── kpis.ts           # Net worth, FI progress, float calculations
│   │   │   ├── coorg-tracker.ts  # ₹2Cr Coorg goal widget
│   │   │   └── styles.css        # Dashboard styles
│   │   ├── profile/              # User portfolio input
│   │   │   ├── index.ts          # Profile form + import/export + CAS import
│   │   │   ├── pdf-parser.ts     # NSDL/CDSL CAS PDF extraction
│   │   │   └── styles.css        # Profile styles
│   │   ├── calculators/          # Financial calculators
│   │   │   ├── index.ts          # All calculators (Crash Protocol, SIP Pause, etc.)
│   │   │   ├── scenario-modeler.ts   # CAGR/SIP → FI age calculator
│   │   │   ├── portfolio-rebalancing.ts  # Allocation drift detector
│   │   │   └── styles.css        # Calculator styles
│   │   ├── watchdog/             # Fund health monitoring
│   │   │   ├── index.ts          # Alpha vs Benchmark tracker
│   │   │   ├── fund-manager-alerts.ts  # Automated fund watchdog rules
│   │   │   └── styles.css        # Watchdog styles
│   │   ├── plan/                 # Financial plan overview
│   │   │   ├── index.ts          # Plan render
│   │   │   └── styles.css        # Plan styles
│   │   └── ui/                   # Shared UI components
│   │       ├── index.ts          # UI module init + exports
│   │       ├── Card.ts           # Reusable card component
│   │       ├── Form.ts           # Form field generator
│   │       ├── Modal.ts          # Modal dialog
│   │       ├── Toast.ts          # Toast notifications
│   │       └── styles.css        # Shared component styles
│   ├── lib/                      # Core utilities
│   │   ├── calculations.ts       # XIRR (Newton-Raphson), SIP P&L, compound growth
│   │   ├── error-handler.ts      # Global error handling
│   │   ├── formatters.ts         # Currency (₹), percentage, date formatters
│   │   ├── fundMatcher.ts        # Scheme name → code mapping
│   │   ├── logger.ts             # Structured logging (warn/error only in prod)
│   │   ├── storage.ts            # localStorage + Firebase persistence
│   │   └── validators.ts         # Input validation utilities
│   ├── types/                    # TypeScript type definitions
│   │   ├── state.ts              # FireOSState interface + initializeState()
│   │   ├── portfolio.ts          # Holdings, SIP, Demat types
│   │   ├── api.ts                # API response types (NAV, Nifty, EUR/INR)
│   │   └── firebase.ts           # Firebase user, backup, sync types
│   ├── utils/
│   │   └── errors.ts             # Custom error classes
│   └── styles/                   # Global CSS
│       ├── tokens.css            # Design tokens (colors, spacing, typography)
│       ├── layout.css            # Layout (nav, tabs, grid)
│       └── global.css            # Reset + base styles
├── tests/                        # Playwright test suite (16 files, 100+ tests)
├── docs/
│   ├── ARCHITECTURE.md           # System architecture & module design
│   └── API.md                    # API integrations & response formats
├── firebase.json                 # Firebase Hosting config (public: dist/)
├── firebase-rules.json           # Realtime Database security rules
├── vite.config.ts                # Vite config (root: src/, outDir: dist/)
├── tsconfig.json                 # TypeScript strict mode config
├── playwright.config.ts          # Playwright config (baseURL: localhost:5173)
├── CLAUDE.md                     # Claude Code developer guide
└── ANTIGRAVITY.md                # This file
```

## Architecture & Patterns

### State Management — The `D` Object

The entire app revolves around a single global state object `D` of type `FireOSState`, exported from `src/main.ts`:

```typescript
export const D: FireOSState = initializeState();
```

**Key rules:**
- All portfolio data lives in `D` (profile, holdings, API caches, auth state)
- Modules read from `D` directly; mutations go through `D` then trigger `updateDashboard()`
- `D.currentUser` holds the Firebase auth user (or `null`)
- State definition: `src/types/state.ts` — **read this first** when adding new features

### Module System

Modules live in `src/modules/<name>/` and follow this pattern:
- `index.ts` — exports `init<Name>Module(containerId)`, `render<Name>()`, and any public functions
- `styles.css` — module-scoped CSS (imported in the module's `index.ts`)
- Additional `.ts` files for sub-features

**Module boundaries:**
- Modules do NOT import from each other directly
- Cross-module communication happens via the `D` object and event listeners in `main.ts`
- Each module's `init()` receives a container element ID and sets up its DOM + events

### Rendering Pattern

All UI is rendered via template literals injected into `element.innerHTML`. There is no virtual DOM or component framework. Pattern:

```typescript
export function renderProfile(container: HTMLElement): void {
  container.innerHTML = `<div class="...">...</div>`;
  // Attach event listeners after render
  document.getElementById('my-btn')?.addEventListener('click', handler);
}
```

### CSS Architecture

- **Design tokens** in `src/styles/tokens.css` (CSS custom properties)
- **Layout** in `src/styles/layout.css` (nav, tabs, grid)
- **Module styles** in each module's `styles.css`
- No CSS preprocessor, no Tailwind — all vanilla CSS
- Modules import their own CSS: `import './styles.css'`

## API Integrations

| API                 | Endpoint                                  | Cache TTL | Fallback                        |
|---------------------|-------------------------------------------|-----------|----------------------------------|
| Mutual Fund NAV     | `api.mfapi.in/mf/{schemeCode}`            | 4 hours   | Cached value → manual entry      |
| Nifty 50            | Yahoo Finance via `api.allorigins.win`    | 1 hour    | Gold ETF NAV approximation       |
| EUR/INR             | Yahoo Finance via `api.allorigins.win`    | 24 hours  | Cached rate → manual entry       |

**Scheme codes:** 122639 (Parag Parikh), 118668 (Nippon Growth), 118778 (Nippon Small), 135106 (Gold ETF)

**Error handling chain:** Real API → cached value → manual entry modal → null

## Firebase Configuration

```
Project ID:     fire-os-dd6d6
Database URL:   https://fire-os-dd6d6-default-rtdb.asia-southeast1.firebasedatabase.app
Region:         Asia Southeast 1 (India)
Auth Method:    Email/Password
```

**Data path:** `/users/{uid}/portfolio` (each user's data is isolated via security rules)

**Auth flow:** `main.ts` → `onAuthStateChanged()` → load Firebase data → merge with local → fetch NAVs → render

**Security rules** (in `firebase-rules.json`):
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

## Data Persistence

1. **Firebase Realtime Database** (primary): Auto-syncs on profile save, 1-second debounce
2. **localStorage** (fallback): `fireOS_v2` key, synchronous, offline-safe
3. **Export/Import**: JSON `fireOS_v2` envelope (profile + holdings + caches)

**Save flow:** User edits → `saveProfile()` → update `D` → `saveData()` (localStorage) → `savePortfolioToFirebase()` (debounced 1s)

**Load flow:** App start → `loadData()` (localStorage) → Firebase auth → `loadPortfolioFromFirebase()` → `mergeState()` → `fetchSIPNAVs()`

## Testing

### Playwright E2E Tests (16 files, 100+ tests)

```bash
npm run test          # Headless Chrome
npm run test:ui       # Interactive Playwright UI
npm run test:debug    # Debugger attached
```

**Config:** `playwright.config.ts` — runs `npm run dev` as webServer, baseURL `http://localhost:5173`

**Test categories:**
- `auth.e2e.ts` — Firebase auth flow (signup, login, logout)
- `dashboard.test.ts` — KPI calculations, rendering
- `calculations.test.ts` — XIRR, SIP P&L, compound growth
- `profile-handlers.test.ts` — Profile form handling, save/load
- `pdf-import.e2e.ts` — CAS PDF import flow
- `e2e.v2.3.test.ts` — Full v2.3 feature suite (35 tests)
- `scenario-modeler.test.ts` — FI age calculations
- `portfolio-rebalancing.test.ts` — Drift detection
- `fund-manager-alerts.test.ts` — Watchdog rules
- `validators.test.ts`, `formatters.test.ts`, `state.test.ts`, `errors.test.ts`, `ui.test.ts`

### Running Tests Before Changes

Always verify tests pass before and after changes:
```bash
npm run test
```

## Coding Conventions

### Commit Messages
```
type(scope): message
```
Types: `feat`, `fix`, `perf`, `test`, `docs`, `chore`, `refactor`  
Scope: Module name (e.g., `auth`, `dashboard`, `api`, `nifty`)

### TypeScript
- **Strict mode** enabled (`noImplicitAny: true`)
- Prefer interfaces over types for object shapes
- Use `as` casts sparingly; prefer type guards (`isFireOSState()`)
- Import types with `import type { ... }`

### Module Creation Checklist
When adding a new module:
1. Create `src/modules/<name>/index.ts` with `init<Name>Module(containerId)` and `render<Name>()`
2. Create `src/modules/<name>/styles.css` for module-specific styles
3. Import CSS in `index.ts`: `import './styles.css'`
4. Register in `main.ts`: add `<div id="<name>" class="tab"></div>` + nav tab + init call
5. Add tab navigation in `setupTabNavigation()` if needed
6. Update `FireOSState` in `src/types/state.ts` for new state fields
7. Write Playwright tests in `tests/<name>.test.ts`

### CSS Conventions
- Use CSS custom properties from `tokens.css` (e.g., `var(--color-primary)`)
- Module styles scoped via container class names
- No inline styles except for dynamic values computed in JS

## Known Gotchas & Critical Context

### 1. NAV Fetch Filtering
**Bug fix (v2.2.1):** Filter changed from `monthlyAmount > 0` to `units > 0`. Always fetch NAV for SIPs with holdings, even if no active monthly contribution.

### 2. Firebase Async Timing
Dashboard must wait for Firebase data before calculating KPIs. The auth listener in `main.ts` handles this sequence: auth → load Firebase → assign to `D` (preserving `currentUser`) → fetch NAVs → re-render.

### 3. `D.currentUser` Preservation
When loading Firebase data via `Object.assign(D, firebaseState)`, the `currentUser` is saved before and restored after the assign (Firebase data doesn't include auth state).

### 4. EUR/INR Type Inconsistency
`D.eurInr` is typed as `number`, but Firebase may store it as `{ rate, timestamp }`. The load/save code normalizes this. Always handle both shapes defensively.

### 5. Chart.js Canvas Size
Pie charts crash if canvas is too small (negative radius). Always validate canvas dimensions before drawing.

### 6. No Direct Module Cross-Imports
Modules communicate only through `D`. If you need data from another module, read it from `D`, don't import from another module's index.

### 7. Protected Files
- `package-lock.json` — Never edit directly; use `npm install`
- Firebase config in `main.ts` — Contains production credentials (apiKey, projectId)

## Financial Domain Context

This app tracks a specific FIRE plan:

- **FI Goal:** ₹5.5Cr corpus → 3% SWR → ₹122K/month at age 45
- **Coorg Goal:** ₹2Cr for Kerala home purchase by 2036
- **Portfolio:** 4 funds (PPFCF 40%, Nippon Growth 30%, Nippon SmallCap 20%, Gold ETF 10%)
- **SIP:** ₹30K/month with +10% annual step-up
- **Fund managers watched:** Rajeev Thakkar (PPFCF), Samir Rachh (Nippon SmallCap)
- **Crash protocol:** Deploy Wint Wealth cash at ₹20K/₹35K/₹60K tiers based on Nifty drawdown

## Development Roadmap

### v3.0 (Planned — Q4 2026)
- SWP Automation (withdrawal scheduler, FIFO unit redemption)
- Tax Optimization Engine (LTCG harvest calendar, 80C/80D hints)
- Advisor Integration (CFP review workflow)
- Custom Expense Tracking (SWP ↔ spending linkage)

### v2.2 Deferred Items
- CONFIG object extraction
- CSS utility classes (reduce inline styles)
- Loading states for API fetches
- Auto-refresh NAVs on timer
- Responsive mobile layout
- Dark/Light theme toggle

---

**Last Updated:** 2026-06-03 (v2.3.0)
