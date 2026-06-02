# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FIRE OS** is a personal finance dashboard for FIRE (Financial Independence, Retire Early) planning. Built with **Vite + TypeScript**, it features a modular architecture with clear separation of concerns: auth, API, calculations, UI, and state management.

The app features:
- Portfolio tracking (MF, FD, EPF, SIP, ESOP, Demat stocks)
- Live NAV fetching from public APIs
- **SIP P&L tracking with cost basis + XIRR (Newton-Raphson)**
- **Cost basis override fields (costBasis1–4) for actual-invested amounts**
- **Per-fund P&L rows (Invested / Current / P&L / XIRR) + Portfolio summary card**
- **MF Central CAS PDF import (NSDL/CDSL Consolidated Account Statement)**
- **Demat holdings auto-detection & tracking (stocks + quantities)**
- **Live EUR/INR auto-fetch for ESOP Tools**
- **Alpha vs Benchmark Tracker (auto-populated rolling 3-year returns)**
- **Live Nifty 52W high fetch via CORS proxy**
- **Firebase Authentication (email/password signup + login)**
- **Cross-device data sync via Firebase Realtime Database**
- Market crash simulations
- Tax optimization tools
- Financial calculators (XIRR, SIP Pause impact, emergency runway, etc.)
- Data persistence via Firebase (with localStorage fallback)

## Architecture & File Structure

### Modular TypeScript Design
**Build Output**: `dist/` (Vite output, minified & optimized for production)

**Module Organization** (`src/modules/`):
- **`auth/`**: Firebase authentication (signup, login, logout, session management)
- **`api/`**: External API integrations (NAV fetching, Nifty levels, EUR/INR rates, PDF parsing)
- **`dashboard/`**: Portfolio dashboard (KPI calculations, P&L tracking, XIRR)
- **`profile/`**: User settings, portfolio input forms, data import/export
- **`calculators/`**: Financial calculators (Crash Protocol, SIP Pause, Emergency Runway, etc.)
- **`ui/`**: Shared components (modals, charts, forms, navigation)
- **`state/`**: Typed state object (D) and persistence logic (Firebase + localStorage)

**State Management**:
- **D object** (TypeScript interface): Centralized portfolio state (profile, holdings, prices, user prefs)
- **updateProfile()**: Validates inputs, saves to D, triggers `updateDashboard()`
- **updateDashboard()**: Recalculates all KPIs, refreshes UI (debounced)
- **Firebase persistence**: Auto-sync to Realtime DB on authenticated session
- **localStorage fallback**: Offline-safe backup, merges on next login

**Module Boundaries**:
- No direct imports between modules (event delegation + D object coupling)
- Each module exports: `init()` (setup), `render()` (UI), `teardown()` (cleanup)
- Module registration in `main.ts`

## Common Development Tasks

### First-Time Setup
```bash
git clone https://github.com/Rohan0603/fire-os.git
cd fire-os
npm install
npm run dev
# Opens http://localhost:5173 in browser (Vite dev server)
```

### Available Scripts
- **`npm run dev`**: Start Vite dev server with HMR (hot module reload)
- **`npm run build`**: Production build to `dist/` (minified, tree-shaken)
- **`npm run preview`**: Preview production build locally
- **`npm run test`**: Run Playwright tests (headless)
- **`npm run test:ui`**: Run Playwright tests with interactive UI
- **`npm run test:debug`**: Run single test with debugger

### Making Changes to the App
1. **Edit TypeScript** in `src/` (modules auto-reload via HMR)
2. **Import from modules**: `import { functionName } from '../modules/auth'`
3. **Access state**: Import `D` object from `src/state`
4. **Browser auto-reloads** on file save (no manual refresh needed)
5. **Test changes** with sample data in the Profile tab

### Debugging
- **Open DevTools**: F12 (or Cmd+Option+I on Mac)
- **Console**: See error messages, type variables to inspect
- **Sources tab**: Set breakpoints in TypeScript (source maps included)
- **Network tab**: See API calls (NAV fetch, Nifty fetch, Firebase sync)
- **Application tab**: View localStorage/Firebase cached data

## Known Limitations & Future Improvements

**Current v2.2 Strengths:**
- ✅ Modular TypeScript architecture (Vite)
- ✅ Hot module reload during development
- ✅ Production minification + tree-shaking
- ✅ Firebase cloud sync + authentication
- ✅ SIP P&L with cost basis + XIRR
- ✅ PDF import (MF Central CAS + Demat)
- ✅ Cross-device data sync
- ✅ Comprehensive calculators
- ✅ Playwright test suite with UI runner

**Future Improvements (v2.3+):**
- Client-side input validation layer
- Enhanced error handling boundaries (API resilience)
- Virtual scrolling for long lists
- Service Worker for offline API caching

## API Dependencies

### Live NAV Fetching
- **Endpoint**: `https://api.mfapi.in/mf/{schemeCode}`
- **Schemes**: 122639 (Parag Parikh), 118668 (Nippon Growth), 118778 (Nippon Small), 113076 (Gold ETF)
- **Rate limit**: Check browser console if fails
- **Fallback**: Manually enter NAV in Profile tab

### Nifty Level & 52W High Fetching
- **Current approach**: ETF NAV approximation from `api.mfapi.in` (uses Gold ETF as Nifty proxy)
- **Data fetched**: Current level (used by Float Indicator KPI), 52-week high
- **Known limitation**: ETF NAV does not reflect true NSE Nifty50 index; ideally would use direct NSE/BSE API
- **Fallback**: Manually enter Nifty level in Crash Protocol modal
- **Future**: Integrate NSE/BSE direct API if available

### EUR/INR Exchange Rate Fetching
- **Endpoint**: Yahoo Finance (`EURINR=X`) via `api.allorigins.win` CORS proxy
- **Auto-fetch**: Triggered when ESOP Tools tab opens
- **Caching**: Stores rate with timestamp in D.eurInr, persists to localStorage
- **Fallback**: Shows cached rate if fetch fails; displays timestamp of last fetch
- **Validation**: Validates rate is between 80-150 (sanity check)

### SIP P&L Tracking
- **Calculation**: `calculateSIPPL(sipKey)` computes cost basis P&L
- **Cost Basis**: Total invested = monthly SIP × months since start date; overridden by `costBasis1–4` if set in Profile
- **P&L Display**: Per-fund rows (Invested / Current / P&L / XIRR) shown in Dashboard SIP cards; Portfolio summary card shown when NAV data is available
- **XIRR**: Newton-Raphson annualized return from start date to current NAV; plausibility guard skips calculation when units predate SIP start
- **Data**: Requires SIP start date (sipStart1-4) in D object (YYYY-MM format); corrupted dates (e.g., 0001-05) normalized to undefined on load

### Alpha vs Benchmark Tracker
- **Auto-Population**: Triggered when ESOP Tools tab opens, populates Watchdog tab
- **Historical Data**: Pre-loaded rolling 3-year returns (2024-2026) from Value Research/Morningstar
- **Current Year**: Auto-calculated from live NAVs vs April 2026 baseline
- **Benchmark Pairs**: PPFCF vs Nifty 500 TRI, Nippon Growth vs Nifty MC150 TRI, Nippon Small Cap vs Nifty SC250 TRI
- **Data Source**: D.alphaTrackerData stores historical returns and benchmark NAV baselines
- **Manual Input**: Benchmark index levels for April 2026 can be manually entered in ESOP Tools

### MF Central CAS PDF Import
- **Trigger**: "Import CAS PDF" button in Profile tab
- **Parser**: PDF.js (`cdnjs.cloudflare.com`) extracts text from NSDL/CDSL Consolidated Account Statement
- **Flow**: Parse → confirmation modal (shows detected fund/units/date + demat holdings) → user confirms → updates Profile fields
- **Demat Support**: Automatically detects and includes demat stock holdings (ISIN, quantity, current value)
- **Scheme Coverage**: Works with all NSDL/CDSL schemes and stock exchanges, not limited to specific funds
- **Quirk**: Handles various CAS formatting quirks (doubled characters, encoding variations)

### SocGen Stock
- **SocGen**: Manual entry only (no API)

### Export / Import Data Format
- **Format**: `fireOS_v2` JSON envelope bundles profile + watchdog data
- **Export**: Downloads `fireOS_backup_<date>.json` from Profile tab
- **Import**: Reads v2 envelope; falls back gracefully to legacy v1 format
- **NAV cache TTL**: 4 hours (reduced from 30 days to keep prices fresh)

### Firebase Authentication & Cloud Sync
- **Service**: Firebase Authentication (email/password) + Realtime Database
- **Project**: fire-os-dd6d6 (Google Cloud project)
- **Auth Flow**:
  1. New users sign up with email + password (6+ chars minimum)
  2. Login screen shows until authenticated
  3. `onAuthStateChanged()` listener tracks auth state
  4. Logout button appears in nav when authenticated
- **Data Sync**:
  - On login: `loadPortfolioFromFirebase()` fetches user's portfolio from `/users/{uid}/portfolio`
  - On profile save: `savePortfolioToFirebase()` syncs changes to Realtime Database
  - Last saved timestamp: `D._lastSavedAt` (ISO format)
  - Offline: Changes saved to localStorage; auto-sync on next login
- **Cross-Device**: Same email login on different devices → instant data sync
- **Database Rules**: Public read/write disabled; only authenticated users can access their own data

## Testing

### Manual Testing Checklist
- [ ] `npm run dev` → Verify app loads at http://localhost:5173
- [ ] Sign up/login with email (Firebase auth)
- [ ] Enter profile data in Profile tab
- [ ] Click ⟳ NAV → Verify prices load (₹ values)
- [ ] Click ⚡ Nifty → Verify Nifty level appears
- [ ] Switch tabs → Verify all content renders
- [ ] Reload page → Verify data persists (localStorage)
- [ ] Open DevTools Console → Verify no errors
- [ ] Mobile test → Open DevTools device toolbar
- [ ] Upload a CAS PDF → Verify confirmation modal shows MF holdings + demat stocks
- [ ] Confirm CAS import → Verify MF units and demat stocks populate Profile fields
- [ ] Enter costBasis override in Profile → Verify P&L uses override instead of computed basis
- [ ] Export JSON → Verify `fireOS_v2` envelope; re-import → Verify round-trip fidelity including demat data

### Automated Testing (Playwright)
```bash
# Run all tests (headless)
npm run test

# Run tests with interactive UI
npm run test:ui

# Run single test with debugger
npm run test:debug tests/auth.e2e.ts

# Test file locations
tests/
  ├── auth.e2e.ts           # Firebase auth flow
  ├── dashboard.test.ts     # Dashboard KPI calculations
  ├── calculations.test.ts  # Financial calculators (XIRR, SIP P&L)
  ├── api.test.ts           # API integrations (NAV, Nifty, EUR/INR)
  └── state.test.ts         # State management (D object, persistence)
```

## Git Workflow & Commits

### Commit Message Format
Use conventional commits for clear, semantic messaging:
```
type(scope): message
```

**Types**: `feat`, `fix`, `perf`, `test`, `docs`, `chore`, `refactor`
**Scope**: Module name or area (e.g., `auth`, `dashboard`, `api`, `nifty`)

**Examples**:
```
feat(auth): add password reset via email
fix(dashboard): correct XIRR calculation for negative flows
perf(dashboard): debounce updateDashboard on form input
test(calculations): add edge cases for SIP P&L
docs(CLAUDE.md): update v2.2 architecture overview
chore(deps): upgrade Vite to 4.2
```

**Best Practices**:
- One logical change per commit
- Reference related issue if applicable
- Test manually before pushing: `npm run dev`, verify in browser, cross-device sync if applicable
- Ensure `npm run test` passes (or skip with valid reason in commit body)

## Performance Notes

### Current (v2.2)
- Vite bundled production build (~80-120 KB gzipped)
- Minified + tree-shaken (unused code removed)
- All calculations run on client (no server calls except NAV/EUR-INR)
- localStorage synchronous but small (portfolio data only ~10-50 KB)

### Optimizations Made
- **sipCorpusMissYear**: Geometric series formula (was iterative)
- **updateDashboard**: Debounced on form input (was recalculating on every keystroke)
- **Lazy-loaded charts**: Only render visible chart sections
- **Firebase offline persistence**: Automatic offline-safe caching + auto-sync on reconnect

### Future Optimizations
- Virtual scrolling for long calculator lists
- Service Worker for API response caching
- Module-level code splitting (lazy-load heavy features)

## Local Development Setup

### Prerequisites
- Git
- Node.js 16+ (for npm, Vite, Playwright)
- A modern browser (Chrome, Firefox, Safari, Edge)

### Recommended VS Code Extensions
- **Prettier**: Auto-format TypeScript/CSS
- **ESLint**: Catch code quality issues
- **Vitest**: Test runner UI (if using Vitest alongside Playwright)
- **Thunder Client** or **REST Client**: Test API calls

## Deployment

### Firebase Hosting (Primary)
**Live at: https://fire-os-dd6d6.web.app**

Setup:
```bash
npm run build              # Builds to dist/
npm install -g firebase-tools
firebase login             # Opens browser for OAuth
firebase deploy --only hosting
```

Configuration:
- `firebase.json`: Public directory = `dist/` (Vite build output), ignores src/tests/docs/node_modules
- `.firebaserc`: Project ID = `fire-os-dd6d6`
- Rewrites: All routes → `index.html` (SPA support)
- Database: Asia Southeast 1 region (india-based)
- **Security Rules** (Realtime Database):
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

**Cross-Device Sync**: Users sign up → data stored in Firebase Realtime DB → login on any device with same email → instant sync via `onValue()` listeners

## Key Metrics & Health Checks

### Dashboard KPIs
- **Total Net Worth**: Sum of all holdings (MF, FD, EPF, Wint, Buffer, ESOP)
- **SIP Status**: Live NAVs × units for 4 tracked funds + **P&L (cost basis) + XIRR** 
- **FI Goal Progress**: Current corpus vs. target (target = 25× annual expenses)
- **Float Indicator**: Nifty level vs. 52-week high (shows market drawdown %)

### Calculators
- **Crash Protocol**: Deploy amount if market crashes 10%/15%/25%
- **Bear Market Simulator**: 10-year portfolio growth under adverse returns
- **Emergency Runway**: Months of survival on liquid assets (MF + FD + Buffer)
- **SIP Pause Impact**: Cost of missing contributions for N months during downturn
- **ESOP Tools**: Stock option valuation + **EUR/INR auto-fetch** + **Benchmark reference levels**

## Understanding the Codebase (v2.2)

### Auth Flow
1. **Page load**: `src/modules/auth/index.ts` → `onAuthStateChanged()` checks if user logged in
2. **If authenticated**: Render main app, show logout button, load portfolio via `loadPortfolioFromFirebase()`
3. **If not authenticated**: Show login/signup modal, block main app content
4. **On login/signup**: Firebase validates credentials → creates user session → app auto-loads portfolio from Realtime DB

**Key exports** from `src/modules/auth/`:
- `loginUser(email, password)`: Email/password login
- `signupUser(email, password)`: Create account
- `logoutUser()`: Sign out + clear session
- `getCurrentUser()`: Returns authenticated user (or null)

### Data Management Flow
1. **User edits Profile tab**: Form inputs → blur event handler
2. **`updateProfile()`**: Validates inputs, updates D object, calls `updateDashboard()`
3. **`updateDashboard()`**: Recalculates KPIs (P&L, XIRR, net worth), re-renders UI
4. **Persistence**:
   - Save to localStorage immediately (offline-safe)
   - If authenticated: Sync to Firebase Realtime DB (`savePortfolioToFirebase()`)
5. **Cross-device**: Firebase `onValue()` listener auto-syncs portfolio changes across devices/tabs in real-time

### Module Communication
- **No direct imports between modules** (decoupled design)
- **Shared state**: All modules read/write to `D` object (from `src/state/`)
- **Event delegation**: Modules dispatch custom events or use callbacks
- **Example**: Auth module sets `D.currentUser` on login → Dashboard module listens for changes, re-renders

### API Integration
Location: `src/modules/api/`

- **NAV fetching** (`fetchNAV.ts`): Calls `api.mfapi.in/{schemeCode}`, caches for 4 hours
- **Nifty fetching** (`fetchNifty.ts`): Uses ETF NAV approximation, fallback to manual entry
- **EUR/INR fetching** (`fetchExchangeRate.ts`): Yahoo Finance via CORS proxy, validates 80-150 range
- **PDF parsing** (`parsePDF.ts`): PDF.js library extracts text from CAS statements, auto-detects funds + demat holdings

All API modules implement retry logic + fallback gracefully on network errors.

### Adding New Features
1. **Create module**: `src/modules/feature-name/index.ts`
2. **Export interface**: `{ init(), render(), teardown() }`
3. **Register in `main.ts`**: Import + call `moduleInit()`
4. **Access state**: Import `D` object, update directly or via `updateProfile()` / `updateDashboard()`
5. **Test**: `npm run test` → add test file to `tests/feature-name.test.ts`

### Testing
- **Unit tests** (`tests/*.test.ts`): Test calculations, parsing, state logic (Vitest)
- **E2E tests** (`tests/*.e2e.ts`): Test auth flow, UI interactions, cross-device sync (Playwright)
- **Run locally**: `npm run test` (headless) or `npm run test:ui` (interactive)

---

See `/docs/ARCHITECTURE.md` for detailed module APIs and state schema.
