# FIRE OS Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize single-file HTML app to Vite + TypeScript modular architecture with production-ready Firebase integration, improved auth UI, and fixed Nifty data source.

**Architecture:** Migrate monolithic `index.html` into modular TypeScript codebase organized by feature (auth, dashboard, profile, calculators). Vite bundles modules into optimized output. Firebase remains primary backend; Realtime DB handles sync. State managed via typed `D` object (no Redux). Each module has clear boundary and exports clean interface.

**Tech Stack:** Vite 5, TypeScript 5, Firebase 11, Chart.js 4 (via CDN), Playwright 1.59+

---

## Phase 1: CLAUDE.md Cleanup + Vite Setup

### Task 1: Clean up CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (entire document)

**Instructions:** CLAUDE.md contains outdated information about the project. Update it to reflect v2.2 (Vite + TypeScript architecture). Specific changes needed:

1. Update intro to mention v2.2 + Vite (lines 1-10)
2. Replace "Architecture & File Structure" section (lines 27-70) with new modular structure
3. Delete "Common Development Tasks" section (lines 72-135), replace with new local dev instructions
4. Replace "API Dependencies" section with accurate descriptions (Nifty fetch currently uses mfapi.in ETF NAV, not Yahoo Finance)
5. Replace "Testing" section with Playwright setup instructions
6. Delete outdated "Git Workflow & Commits" commit history (replace with general commit style guide)
7. Replace "Performance Notes" section with v2.2 optimizations
8. Delete "Local Development Setup" (already covered in "Local Development")
9. Update "Deployment" section to reference `dist/` (Vite output, not root)
10. Replace "Redux of Codebase" section with new module-based understanding guide

**Completion criteria:**
- CLAUDE.md is accurate for v2.2 architecture
- No references to single-file HTML or outdated auth flows
- Nifty fetch documentation corrected (currently uses mfapi.in, not Yahoo Finance)
- Testing section mentions Playwright
- Git history removed, commit style guide added

**Commit message:** `docs(CLAUDE.md): modernize for v2.2 Vite + TypeScript architecture`

---

### Task 2: Initialize Vite + TypeScript project

**Files:**
- Modify: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `src/index.html`
- Create: `src/main.ts`

**Instructions:** Set up Vite + TypeScript build pipeline from scratch. This is the foundation for all subsequent modularization.

1. Update `package.json`:
   - Update version to 2.2.0
   - Add scripts: `dev`, `build`, `preview`, `test`, `test:ui`, `test:debug`
   - Add devDependencies: `vite@^5.0.8`, `typescript@^5.3.3`, `@types/node@^20.10.0`, `@playwright/test@^1.59.1`
   - Add dependencies: `firebase@^11.0.0`
   - Change `type: "module"` (ES modules)

2. Create `vite.config.ts`:
   - Root: `src/`
   - Build output: `dist/`
   - Dev server: port 5173
   - Minify: terser

3. Create `tsconfig.json`:
   - Target: ES2020
   - Lib: ES2020, DOM, DOM.Iterable
   - Strict mode: true
   - Module: ESNext
   - Resolve: bundler

4. Create `src/index.html`:
   - Minimal entry point (just div#app + script)
   - Embed Chart.js and PDF.js via CDN
   - Reference `main.ts`

5. Create `src/main.ts`:
   - Bootstrap app
   - Initialize Firebase
   - Set up global state `D`
   - Render app container (nav, tabs)
   - Set up auth listener
   - Initialize modules (auth, dashboard, profile, calculators)
   - Set up tab navigation
   - Periodic save every 5 seconds

6. Run `npm install` and verify `npm run dev` starts server on 5173

**Completion criteria:**
- `npm run dev` starts Vite server without errors
- Browser opens to http://localhost:5173
- No console errors (auth not initialized yet, expected)
- `npm run build` creates dist/ directory
- TypeScript compiles without errors

**Commit message:** `setup: initialize Vite + TypeScript project structure`

---

## Phase 2: Core Types & Libraries

### Task 3: Create type definitions

**Files:**
- Create: `src/types/portfolio.ts` (SIPFund, Holding, DematHolding, AlphaTrackerData types)
- Create: `src/types/api.ts` (MFAPIResponse, NiftyData, EURINRData, NAVCache types)
- Create: `src/types/firebase.ts` (FirebaseUser, FireOSBackup, SyncMetadata types)
- Create: `src/types/state.ts` (FireOSState type + initializeState function)

**Instructions:** Create centralized type definitions for the entire app. Each file groups types by domain (portfolio data, API responses, Firebase models, global state).

**Completion criteria:**
- All types compile without errors
- FireOSState type represents entire app state
- initializeState() returns default state
- Types are imported correctly in main.ts
- No `any` types (strict TypeScript)

**Commit message:** `types: add TypeScript type definitions for portfolio, API, Firebase, state`

---

### Task 4: Create calculation library with tests

**Files:**
- Create: `src/lib/calculations.ts` (XIRR, SIP corpus, P&L, metrics functions)
- Create: `tests/calculations.test.ts` (Playwright tests for calculations)

**Instructions:** Implement core financial calculation functions. Use TDD: write tests first, then implementation.

**Functions to implement:**
1. `xirr(cashFlows, guessRate)` - Newton-Raphson annualized return calculation
2. `sipCorpusYear(monthlyAmount, annualRate, years)` - Future value of annuity
3. `sipCostBasis(monthlyAmount, monthsSinceStart)` - Total invested amount
4. `emergencyRunway(liquidAssets, monthlyExpenses)` - Months of survival
5. `crashProtocol(niftyHigh, niftyLevel)` - Market drawdown %, deploy amounts
6. `fiGoalProgress(currentCorpus, annualExpenses)` - FI timeline
7. `sipPauseImpact(monthlyAmount, pauseMonths, annualRate)` - Cost of pausing SIP

**Completion criteria:**
- All tests pass: `npm run test -- tests/calculations.test.ts`
- XIRR converges within 1e-6 tolerance
- SIP corpus matches financial calculator benchmarks
- No console errors
- Edge cases handled (0 expenses, negative values)

**Commit message:** `feat(lib): add calculations library with XIRR, SIP corpus, FI metrics`

---

### Task 5: Create storage library (localStorage + Firebase sync)

**Files:**
- Create: `src/lib/storage.ts` (loadData, saveData, loadPortfolioFromFirebase, savePortfolioToFirebase, exportPortfolio, importPortfolio)
- Modify: `firebase.json` (change public to `dist/`, add database rules reference)
- Create: `firebase-rules.json` (Realtime DB security rules)

**Instructions:** Implement data persistence layer with offline-first support.

**Functions to implement:**
1. `loadData()` - Load from localStorage, validate NAV cache TTL
2. `saveData(state)` - Save to localStorage (synchronous, debounce at call site)
3. `loadPortfolioFromFirebase(uid)` - Fetch from Realtime DB on login
4. `savePortfolioToFirebase(uid, state)` - Debounced save (1 second)
5. `exportPortfolio(state)` - Download JSON backup
6. `importPortfolio(file)` - Load JSON backup (support v1 and v2 formats)

**Firebase Rules:**
- Users can only read/write their own portfolio
- Portfolio must have version, timestamp, profile, holdings fields
- Database path: `/users/{uid}/portfolio`

**Completion criteria:**
- `loadData()` returns cached data with valid TTL
- `savePortfolioToFirebase()` debounces correctly (check with 2+ rapid calls)
- Export creates valid JSON file
- Import parses both v1 and v2 formats
- Firebase rules are syntactically valid

**Commit message:** `feat(lib): add storage library with Firebase sync + offline support`

---

### Task 6: Create validators, formatters, logger utilities

**Files:**
- Create: `src/lib/validators.ts` (Validators.email, .password, .positiveNumber, .dateYYYYMM, .isin)
- Create: `src/lib/formatters.ts` (Formatters.currency, .number, .percentage, .dateISO, .timeAgo)
- Create: `src/lib/logger.ts` (initLogger, logger.log/warn/error/debug)
- Create: `src/utils/errors.ts` (FireOSError class, handleError function)
- Create: `tests/validators.test.ts` (unit tests for validators)

**Instructions:** Create helper libraries for validation, formatting, and error handling.

**Validators:**
- `email(email)` - RFC 5322 basic format
- `password(password)` - Min 6 chars, uppercase + number required
- `positiveNumber(value)` - Non-negative integer
- `dateYYYYMM(value)` - YYYY-MM format, month 01-12
- `isin(value)` - 12-char code (2 letters + 9 alphanumeric + 1 digit)

**Formatters:**
- `currency(value, decimals)` - ₹ symbol, Indian locale (e.g., ₹1,00,000)
- `number(value, decimals)` - Comma-separated Indian style
- `percentage(value, decimals)` - Multiply by 100, % suffix
- `dateISO(value)` - Parse ISO string, format as DD/MM/YYYY
- `timeAgo(isoString)` - "5m ago", "2h ago", etc.

**Logger:**
- `initLogger()` - Detect dev vs prod (based on hostname)
- `logger.log/warn/error/debug()` - Prefix with [FIRE OS], silent in prod
- Global error handlers for uncaught exceptions

**Completion criteria:**
- All validator tests pass
- Formatter output matches expected format
- Logger detects dev vs prod correctly
- No console errors
- Edge cases handled (empty strings, null values)

**Commit message:** `feat(lib): add validators, formatters, logger utilities`

---

## Phase 3: Auth Module + Login/Signup

### Task 7: Create Firebase auth module with redesigned UI

**Files:**
- Create: `src/modules/auth/firebaseAuth.ts` (showLoginScreen, hideLoginScreen, initAuth)
- Create: `src/modules/auth/validation.ts` (validateSignup, validateLogin)
- Create: `tests/auth.e2e.ts` (Playwright E2E tests for auth flow)

**Instructions:** Implement complete Firebase authentication with redesigned login/signup screen.

**UI Requirements:**
- Dark theme matching dashboard (--surface, --accent, --gold colors)
- Login form: email + password + "Forgot password" link
- Signup form: email + password + confirm password
- Tab switching between login/signup
- Inline validation errors (red text below fields)
- Loading states (button text "Logging in...", disabled)
- Success redirects to dashboard
- Error messages: "Invalid email or password", "Email already registered", etc.
- Mobile responsive (full-width, touch-friendly)
- Password reset flow via Firebase auth

**Firebase Integration:**
- Use `firebase.auth().createUserWithEmailAndPassword()`
- Use `firebase.auth().signInWithEmailAndPassword()`
- Use `firebase.auth().sendPasswordResetEmail()`
- Integrate with `onAuthStateChanged()` listener from main.ts

**E2E Tests (Playwright):**
1. Signup flow: Enter email + password → verify account created
2. Login flow: Enter credentials → verify logged in
3. Logout flow: Click logout → verify auth screen shown
4. Validation: Submit empty form → verify errors
5. Forgot password: Click link → verify email sent

**Completion criteria:**
- Auth screen renders on page load (no auth state)
- Signup validates email, password strength, confirm match
- Login validates format
- Errors display inline below fields
- All E2E tests pass: `npm run test -- tests/auth.e2e.ts`
- No console errors
- Password reset email sent successfully (check Firebase console)

**Commit message:** `feat(auth): implement Firebase authentication with login/signup redesign`

---

## Phase 4: Core Feature Modules

### Task 8: Create shared UI components module

**Files:**
- Create: `src/modules/ui/Modal.ts` (generic modal component)
- Create: `src/modules/ui/Card.ts` (KPI/asset card component)
- Create: `src/modules/ui/Form.ts` (form helper functions)
- Create: `src/modules/ui/Toast.ts` (toast notification)
- Create: `src/modules/ui/styles.css` (component styles)

**Instructions:** Create reusable UI components used across modules.

**Modal.ts:**
- `createModal(title, content, buttons)` - Generic modal overlay
- Auto-dismiss on button click
- Close button (X)
- Keyboard support (Escape closes)

**Card.ts:**
- `createCard(title, values)` - KPI card template
- Display metric + value + trend
- Support for negative values (red color)

**Form.ts:**
- `createFormField(label, type, value, onchange)` - Single form field
- `createForm(fields)` - Multiple fields
- Validation error display

**Toast.ts:**
- `showToast(message, duration, type)` - Show notification (info/success/error/warning)
- Auto-dismiss after duration
- Multiple toasts stack

**Completion criteria:**
- All components render without errors
- Modal closes on Escape key
- Toast auto-dismisses after 3s
- Form validation displays errors inline
- Styles match dashboard theme
- No console errors

**Commit message:** `feat(ui): create shared modal, card, form, toast components`

---

### Task 9: Create API module (NAV fetching, Nifty fix)

**Files:**
- Create: `src/modules/api/mfapi.ts` (MF NAV fetching from api.mfapi.in)
- Create: `src/modules/api/nifty.ts` (Nifty level + 52W high fetch, with FIX)
- Create: `src/modules/api/eurInr.ts` (EUR/INR rate from Yahoo Finance)
- Create: `src/modules/api/fallbacks.ts` (manual entry, cached values)

**Instructions:** Implement external API calls with fallback mechanisms. **IMPORTANT: Fix Nifty 52W high to use correct data source.**

**mfapi.ts:**
- `fetchNAV(schemeCode)` - Fetch latest NAV from api.mfapi.in
- Cache with 4-hour TTL
- Return null on error (fallback to manual entry)
- Log to console on success

**nifty.ts (FIX THIS):**
- **Current broken approach:** Uses MF NAV (scheme 135106) to estimate Nifty
- **New approach:** Try to fetch real Nifty 50 index data:
  1. First try: Use NSE public API (if available, check https://www.nseindia.com/)
  2. Fallback: Use ETF NAV approach but document it's an approximation
  3. Cache 1-hour TTL
  4. Show disclaimer in UI if using approximation
- Return Nifty level + 52W high
- Handle network errors gracefully

**eurInr.ts:**
- Fetch EUR/INR from Yahoo Finance (EURINR=X) via api.allorigins.win CORS proxy
- Cache with 24-hour TTL
- Validate rate between 80-150
- Return cached value if fetch fails

**fallbacks.ts:**
- `showManualNiftyEntry()` - Modal to manually enter Nifty level + 52W high
- `getCachedNAV(schemeCode)` - Return previously cached NAV
- `getCachedNifty()` - Return last known Nifty level

**Completion criteria:**
- `fetchNAV()` returns valid NAV or null
- `fetchNifty()` attempts real data source first, falls back to approximation
- EUR/INR rate validates correctly
- All cache TTLs respected
- Manual entry works when API fails
- No console errors on network failures
- Documentation updated with Nifty fix details

**Commit message:** `feat(api): implement NAV fetching, fix Nifty 52W high data source`

---

### Task 10: Create Dashboard module

**Files:**
- Create: `src/modules/dashboard/Dashboard.ts` (render KPI cards, charts)
- Create: `src/modules/dashboard/kpis.ts` (KPI calculations: net worth, SIP status, FI progress, float indicator)
- Create: `src/modules/dashboard/styles.css`

**Instructions:** Implement dashboard tab with KPI cards and charts.

**KPIs to display:**
1. **Total Net Worth** - Sum of all holdings (MF current value, FD, EPF, Wint, Buffer, ESOP, Demat value)
2. **SIP Status** - Live NAV × units for 4 tracked funds, P&L (cost basis), XIRR
3. **FI Goal Progress** - Current corpus / (25 × annual expenses) × 100%
4. **Float Indicator** - (Nifty 52W high - current level) / 52W high × 100% (market drawdown)

**Charts:**
- Portfolio allocation pie chart (MF, FD, EPF, Wint, Buffer, ESOP, Demat)
- SIP performance chart (invested vs current value over time)
- Market level chart (historical Nifty levels if available)

**Completion criteria:**
- All KPIs display correctly
- Portfolio pie chart renders
- SIP chart shows invested + current value
- No NaN or undefined values
- Responsive on mobile
- Updates when data changes
- No console errors

**Commit message:** `feat(dashboard): create KPI cards, portfolio charts, FI progress display`

---

### Task 11: Create Profile module (form + PDF import)

**Files:**
- Create: `src/modules/profile/Profile.ts` (form rendering, field handlers)
- Create: `src/modules/profile/pdf-parser.ts` (CAS PDF parsing)
- Create: `src/modules/profile/styles.css`

**Instructions:** Implement Profile tab with holdings form and CAS PDF import.

**Form fields:**
- Profile: income, expenses, age, niftyHigh
- MF SIP (mf1-4): name, schemeCode, units, startDate (YYYY-MM), monthlyAmount, costBasis (optional)
- FD, EPF, Wint, Buffer, ESOP, SocGen: amount input
- Demat: list with add/remove buttons (ISIN, quantity, currentValue)

**PDF Parser:**
- Accept NSDL/CDSL Consolidated Account Statement PDF
- Extract fund names, scheme codes, units, dates
- Detect demat holdings (stocks) with ISIN, quantity
- Show confirmation modal with extracted data
- User can edit before confirming
- Populate form fields on confirm

**Completion criteria:**
- All form fields render and save correctly
- Blur event triggers `updateProfile()` → `updateDashboard()`
- PDF parser extracts fund data correctly
- Demat holdings detected and stored
- Confirmation modal shows all extracted data
- Round-trip export/import maintains data fidelity
- No console errors

**Commit message:** `feat(profile): create holdings form with CAS PDF import and demat tracking`

---

### Task 12: Create Calculators module

**Files:**
- Create: `src/modules/calculators/Calculators.ts` (container)
- Create: `src/modules/calculators/crashProtocol.ts` (crash protocol calculator)
- Create: `src/modules/calculators/emergency.ts` (emergency runway calculator)
- Create: `src/modules/calculators/sipPause.ts` (SIP pause impact calculator)
- Create: `src/modules/calculators/esopTools.ts` (ESOP tools + alpha tracker)
- Create: `src/modules/calculators/styles.css`

**Instructions:** Implement all financial calculators.

**Crash Protocol:**
- Input: Nifty level, crash percentages (10%, 15%, 25%)
- Output: Deploy amount from Wint buffer for each scenario
- Display: "Deploy ₹X from Wint if market crashes 15%"

**Emergency Runway:**
- Input: Liquid assets (MF + FD + Buffer), monthly expenses
- Output: Months of survival
- Display: "You can survive 18 months on liquid assets"

**SIP Pause Impact:**
- Input: Monthly SIP amount, pause duration (months), assumed return rate
- Output: Cost of pausing (missed contributions + lost growth)
- Display: "Cost of 6-month pause: ₹75,000"

**ESOP Tools:**
- Input: Stock quantity, grant price, current price, vesting schedule, EUR/INR (auto-fetch)
- Output: Current value, gain/loss, tax implications
- Display: Auto-fetch EUR/INR when tab opens
- Manual entry for benchmark reference levels (April 2026 baselines)

**Completion criteria:**
- All calculators compute correctly
- Inputs validate (positive numbers, valid ranges)
- Outputs display with proper formatting (₹ symbol)
- Edge cases handled (zero inputs, extreme values)
- No console errors
- Auto-fetch EUR/INR works
- Alpha tracker data pre-populated

**Commit message:** `feat(calculators): add crash protocol, emergency runway, SIP pause, ESOP tools`

---

## Phase 5: Firebase Optimization & Production Hardening

### Task 13: Add error handling + input validation

**Files:**
- Modify: `src/main.ts` (add try-catch boundaries)
- Modify: All modules (add error boundaries)
- Create: `src/lib/errors.ts` (error handling utilities - may already exist)

**Instructions:** Add production-ready error handling.

**Requirements:**
- Try-catch around async functions (API calls, Firebase operations)
- User-facing error messages via Toast (not console.error)
- Graceful degradation (fallback to manual input if API fails)
- Network error detection (show offline indicator in UI)
- Validation at form boundaries (before save)
- No exposing technical errors to user (generic "Something went wrong" message)
- Server errors logged (optional: Firebase Crashlytics)

**Error scenarios to handle:**
1. API fetch fails → show Toast, fallback to manual entry
2. Firebase auth fails → show error message in auth form
3. localStorage quota exceeded → show Toast, continue with memory-only
4. PDF parsing fails → show error, allow retry
5. Network disconnected → show offline banner
6. Invalid user input → inline validation errors
7. Firebase write fails → retry on next sync, show warning

**Completion criteria:**
- No unhandled Promise rejections
- No console.error without user-facing feedback
- All API calls have error handlers
- Offline mode works (reads from localStorage)
- Invalid input blocked before save
- No console errors on error paths

**Commit message:** `feat(error-handling): add graceful error recovery, input validation, user feedback`

---

### Task 14: Set up test suite (Playwright E2E)

**Files:**
- Create: `playwright.config.ts` (test configuration)
- Create: `tests/auth.e2e.ts` (auth flow tests - may already exist)
- Create: `tests/dashboard.e2e.ts` (dashboard render tests)
- Create: `tests/profile.e2e.ts` (profile form + PDF import tests)
- Create: `tests/calculations.test.ts` (unit tests - may already exist)

**Instructions:** Set up comprehensive test suite covering auth, UI, and calculations.

**Auth E2E:**
1. Signup with valid credentials → verify account created
2. Login with valid credentials → verify dashboard loads
3. Logout → verify auth screen shown
4. Signup with existing email → verify error message
5. Login with wrong password → verify error message
6. Password reset → verify email sent

**Dashboard E2E:**
1. Load app after login → verify KPI cards render
2. Click NAV fetch → verify prices update
3. Click Nifty fetch → verify level + 52W high update
4. Switch tabs → verify all tabs render
5. Reload page → verify data persists

**Profile E2E:**
1. Enter portfolio data → verify save
2. Upload CAS PDF → verify confirmation modal
3. Confirm PDF import → verify form fields populated
4. Export JSON → verify file contains correct data
5. Import JSON → verify portfolio loads

**Unit Tests:**
- Calculations: XIRR, SIP corpus, FI progress
- Validators: Email, password, date formats
- Formatters: Currency, date, percentage

**Completion criteria:**
- All tests pass: `npm run test`
- Coverage > 70% (optional: use Istanbul)
- Tests run in CI (optional: GitHub Actions)
- No flaky tests (deterministic results)
- Tests complete in < 60 seconds

**Commit message:** `test: add Playwright E2E + unit test suite for auth, dashboard, profile`

---

### Task 15: Optimize performance + add caching

**Files:**
- Modify: `src/lib/storage.ts` (add cache TTL management)
- Modify: `src/modules/api/` (add cache validation)
- Modify: `src/main.ts` (debounce form updates)
- Modify: All modules (lazy-load non-critical components)

**Instructions:** Implement performance optimizations for production.

**Optimizations:**
1. Debounce form input handlers (500ms delay before save)
2. Lazy-load Chart.js only when dashboard tab opens
3. Lazy-load PDF.js only when profile PDF import button clicked
4. Cache API responses with TTL:
   - NAV: 4 hours
   - Nifty: 1 hour
   - EUR/INR: 24 hours
5. Code splitting: Bundle modules separately (Vite handles this)
6. Minify + gzip: Vite build handles this
7. Remove console logs in production (use logger module)

**Completion criteria:**
- Form debounce works (verify with multiple rapid inputs)
- Charts lazy-load (check network tab)
- API caches respected
- Bundle size < 200 KB gzipped
- No performance degradation
- Page load time < 2 seconds

**Commit message:** `perf: add debouncing, lazy-loading, cache TTL, production optimizations`

---

## Phase 6: Documentation & Finalization

### Task 16: Update documentation

**Files:**
- Modify: `CLAUDE.md` (verify v2.2 content is complete)
- Create: `ARCHITECTURE.md` (detailed module breakdown)
- Modify: `README.md` (update build instructions, link to ARCHITECTURE)
- Create: `API.md` (document Nifty fix, API endpoints, fallbacks)

**Instructions:** Create comprehensive documentation for developers.

**ARCHITECTURE.md:**
- Module structure diagram
- Data flow (auth → profile → dashboard)
- Firebase integration details
- State management explanation
- How to add new feature/calculator
- Module interfaces

**API.md:**
- All endpoints (MF NAV, Nifty, EUR/INR)
- Response formats (types)
- Error handling
- Nifty 52W high fix: current approach + future plans
- Rate limits
- CORS proxy note

**README.md:**
- Quick start (`npm install`, `npm run dev`)
- Build & deploy (`npm run build`, Firebase deploy)
- Testing (`npm run test`)
- Contributing guidelines
- Link to ARCHITECTURE.md

**Completion criteria:**
- All documentation is accurate
- Code examples are runnable
- No broken links
- Clear instructions for new contributors
- Nifty fix clearly documented

**Commit message:** `docs: add ARCHITECTURE.md and API.md, update README and CLAUDE.md`

---

## Execution Checklist

- [ ] Task 1: Clean up CLAUDE.md
- [ ] Task 2: Initialize Vite + TypeScript
- [ ] Task 3: Create type definitions
- [ ] Task 4: Create calculation library + tests
- [ ] Task 5: Create storage library
- [ ] Task 6: Create validators, formatters, logger
- [ ] Task 7: Create Firebase auth module
- [ ] Task 8: Create shared UI components
- [ ] Task 9: Create API module (with Nifty fix)
- [ ] Task 10: Create Dashboard module
- [ ] Task 11: Create Profile module with PDF import
- [ ] Task 12: Create Calculators module
- [ ] Task 13: Add error handling + validation
- [ ] Task 14: Set up test suite
- [ ] Task 15: Performance optimization
- [ ] Task 16: Update documentation

---

**Next:** Dispatch implementer subagent for Task 1 (CLAUDE.md cleanup).
