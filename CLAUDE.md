# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FIRE OS** is a personal finance dashboard for FIRE (Financial Independence, Retire Early) planning. It's a **single-file, all-in-one HTML application** with no framework dependencies—just vanilla JavaScript, HTML/CSS, and Chart.js.

The app features:
- Portfolio tracking (MF, FD, EPF, SIP, ESOP)
- Live NAV fetching from public APIs
- **SIP P&L tracking with cost basis + XIRR**
- **Live EUR/INR auto-fetch for ESOP Tools**
- **Alpha vs Benchmark Tracker (auto-populated rolling 3-year returns)**
- Market crash simulations
- Tax optimization tools
- Financial calculators (XIRR, SIP Pause impact, emergency runway, etc.)
- Data persistence via browser localStorage

## Architecture & File Structure

### Single-File Design
- **`index.html`** (~190 KB) contains:
  - All HTML (nav, modals, forms, cards, charts)
  - All CSS (design tokens, layout, typography, animations)
  - All JavaScript (DOM management, API calls, calculations, state)
  - Embedded Chart.js library via CDN

**Why monolithic:** Browser-based app, no build pipeline, no dependency management needed. GitHub Pages deployment is direct.

### Code Organization Within index.html
The JavaScript is organized by feature area (not file-based):

1. **Data Object (D)**
   - `D.profile`: User inputs (income, age, holdings, SIP amounts)
   - `D.mf`, `D.fd`, `D.epf`, etc.: Portfolio holdings
   - `D.nav`: Live mutual fund prices (fetched from API)
   - `D.niftyHigh`: Current market level

2. **Core Functions (no namespacing)**
   - `updateProfile()`: Parse form inputs, save to localStorage
   - `fetchNAV()`: Call mfapi.in API
   - `fetchNifty()`: CORS-proxied Yahoo Finance call
   - `updateDashboard()`: Recalculate all KPIs and re-render
   - Calculation functions: `sipCorpusYear()`, `emergencyRunway()`, `xirr()`, etc.

3. **UI Handlers**
   - Tab switching: `.nav-tab` click handlers
   - Modal open/close
   - Form field blur → `updateProfile()` → `updateDashboard()`
   - Button clicks for crash protocol, export, etc.

4. **Storage**
   - All data persists to `localStorage` with key `'fireOSProfile'`
   - No server communication

### DOM Structure
- **`.nav`**: Tab navigation (Profile, Dashboard, Crash Protocol, Calculators, Optimiser, Watchdog)
- **`.tabs-container`**: Content for each tab (hidden/shown via `display: none`)
- **`.modal`**: Overlays for detailed views (asset breakdown, crash protocol, etc.)
- **`.kpi-grid`**: Dashboard KPI cards
- **`.chart-container`**: Chart.js visualizations

## Common Development Tasks

### Running the App Locally
```bash
# Option 1: Python http.server (recommended for testing)
cd C:\Users\ponna\Project\fire-os
python -m http.server 3000
# Open http://localhost:3000 in browser

# Option 2: Node.js http-server
npm install -g http-server
http-server -p 3000

# Option 3: VS Code Live Server extension
# Right-click index.html → Open with Live Server
```

### Testing with Playwright
```bash
# The project includes a test suite in test-fixes.js
# It verifies:
# - Page loads and dashboard renders
# - NAV fetching works
# - Bug fixes (live MF values, FI goal progress)

npm install  # Installs @playwright/test and playwright

# Run tests (assumes server on localhost:3000)
node test-fixes.js
```

### Making Changes to the App
1. **Open `index.html` in editor** (VS Code, Sublime, etc.)
2. **Find the feature area** (use Ctrl+F):
   - Calculations: Search for function name (e.g., `sipCorpusYear`)
   - UI: Search for CSS class (e.g., `.sip-card`)
   - Data: Search for `D.` (the data object)
3. **Edit the code** (HTML, CSS, or JS)
4. **Reload browser** (Ctrl+R or Cmd+R)
5. **Test changes** with sample data in the Profile tab

### Debugging
- **Open DevTools**: F12 (or Cmd+Option+I on Mac)
- **Console**: See error messages, log custom messages
- **Application tab**: View localStorage contents
- **Network tab**: See API calls (NAV fetch, Nifty fetch, CORS proxy)

### Adding a New Calculator
1. **Add form in HTML** (within the Calculators tab section)
2. **Add JavaScript function** to calculate values
3. **Update DOM** with results (use `document.getElementById()` or query selectors)
4. **Add validation** for inputs (check for negative values, empty fields)
5. **Test edge cases** (zero values, extreme inputs)

## Known Issues & Audit

See `FIRE_OS_AUDIT_REPORT.md` for:
- **5 Critical Issues**: Monolithic file structure, no input validation, error handling, test coverage
- **5 High-Priority Improvements**: Data migration, refactoring, modals, API resilience, state management
- **Roadmap**: v2.1 → v2.2 → v2.3 → v3.0 (eventual modularization)

## API Dependencies

### Live NAV Fetching
- **Endpoint**: `https://api.mfapi.in/mf/{schemeCode}`
- **Schemes**: 122639 (Parag Parikh), 118668 (Nippon Growth), 118778 (Nippon Small), 113076 (Gold ETF)
- **Rate limit**: Check browser console if fails
- **Fallback**: Manually enter NAV in Profile tab

### Nifty Level Fetching
- **Endpoint**: Yahoo Finance via `api.allorigins.win` CORS proxy
- **Reason for proxy**: GitHub Pages cannot make direct cross-origin requests
- **Fallback**: Manually enter Nifty level in Crash Protocol modal

### EUR/INR Exchange Rate Fetching
- **Endpoint**: Yahoo Finance (`EURINR=X`) via `api.allorigins.win` CORS proxy
- **Auto-fetch**: Triggered when ESOP Tools tab opens
- **Caching**: Stores rate with timestamp in D.eurInr, persists to localStorage
- **Fallback**: Shows cached rate if fetch fails; displays timestamp of last fetch
- **Validation**: Validates rate is between 80-150 (sanity check)

### SIP P&L Tracking
- **Calculation**: `calculateSIPPL(sipKey)` computes cost basis P&L
- **Cost Basis**: Total invested = monthly SIP × months since start date
- **P&L Display**: Shows in Dashboard SIP Status cards (green for positive, red for negative)
- **XIRR**: Time-weighted annualized return calculated from start date to current NAV
- **Data**: Requires SIP start date (sipStart1-4) stored in D object (YYYY-MM format)

### Alpha vs Benchmark Tracker
- **Auto-Population**: Triggered when ESOP Tools tab opens, populates Watchdog tab
- **Historical Data**: Pre-loaded rolling 3-year returns (2024-2026) from Value Research/Morningstar
- **Current Year**: Auto-calculated from live NAVs vs April 2026 baseline
- **Benchmark Pairs**: PPFCF vs Nifty 500 TRI, Nippon Growth vs Nifty MC150 TRI, Nippon Small Cap vs Nifty SC250 TRI
- **Data Source**: D.alphaTrackerData stores historical returns and benchmark NAV baselines
- **Manual Input**: Benchmark index levels for April 2026 can be manually entered in ESOP Tools

### SocGen Stock
- **SocGen**: Manual entry only (no API)

## Testing

### Manual Testing Checklist
- [ ] Load `index.html` in browser
- [ ] Enter profile data in Profile tab
- [ ] Click ⟳ NAV → Verify prices load (₹ values)
- [ ] Click ⚡ Nifty → Verify Nifty level appears
- [ ] Switch tabs → Verify all content renders
- [ ] Reload page → Verify data persists (localStorage)
- [ ] Open DevTools Console → Verify no errors
- [ ] Mobile test → Open DevTools device toolbar

### Automated Testing (Playwright)
```bash
# Prerequisites: Local server running on http://localhost:3000
node test-fixes.js
```
Tests verify:
- Page loads and renders
- SIP cards display
- NAV prices fetch
- Net worth KPI updates
- FI goal progress uses live MF value (bug fix verification)

## Git Workflow & Commits

Recent changes (as of May 8, 2026) - ESOP Tools Enhancements:
- **66a3749**: test: verify all ESOP Tools enhancements work end-to-end
- **a518e2b**: feat: add manual entry fields for benchmark reference levels in ESOP Tools
- **69932c9**: feat: auto-populate Alpha vs Benchmark Tracker with rolling 3-year data
- **f5164c2**: feat: auto-fetch and display live EUR/INR rate when ESOP Tools tab opens
- **93003b3**: feat: display SIP P&L (cost basis) and XIRR on Dashboard SIP cards
- **dd89a7e**: feat: add calculateSIPPL function to compute cost basis P&L for each SIP
- **ac7a2a7**: feat: add SIP start date fields to track cost basis for P&L calculation

Earlier changes:
- **8df63dc**: Fixed 3 critical bugs (live data, asset breakdown, portfolio calculations)
- **15e1f0d**: Added Playwright e2e test suite
- **cf83493**: Added Playwright to devDependencies
- **96147c2**: Optimized `sipCorpusMissYear` using geometric series formula

When committing changes:
- Use clear messages: "fix: ...", "feat: ...", "perf: ...", "test: ..."
- Reference the issue or bug being fixed if applicable
- Run `node test-fixes.js` before pushing to verify no regressions

## Performance Notes

### Current
- Single file (~190 KB minified, uncompressed)
- No minification or bundling
- All calculations run on client (no server calls except NAV/Nifty)
- localStorage is synchronous (blocks on large data saves)

### Optimizations Made
- **sipCorpusMissYear**: Converted to geometric series formula (was iterative)
- **updateDashboard**: Called on all form changes (potential bottleneck)

### Future Optimizations
- Debounce form input handlers
- Lazy-load charts (only render visible charts)
- Virtual scrolling for long calculator lists
- Service Worker for offline API caching

## Local Development Setup

### Prerequisites
- Git
- Node.js (for `npm install` and Playwright)
- A modern browser (Chrome, Firefox, Safari, Edge)
- Python 3 or Node.js (for local server)

### First-Time Setup
```bash
git clone https://github.com/Rohan0603/fire-os.git
cd fire-os
npm install
python -m http.server 3000
# Open http://localhost:3000 in browser
```

### Useful VS Code Extensions
- **Prettier**: Auto-format HTML/CSS/JS
- **Live Server**: Right-click index.html → Open with Live Server
- **Thunder Client** or **REST Client**: Test API calls

## Deployment

### GitHub Pages (Automatic)
1. Push to `main` branch
2. GitHub Actions workflow (`.github/workflows/deploy.yml`) auto-deploys
3. Site live at `https://yourusername.github.io/fire-os`

### Manual Deploy
1. Push to repo
2. Go to repo **Settings** → **Pages**
3. Select **GitHub Actions** as source
4. Save — workflow runs on next push

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

## Redux of Codebase for New Contributors

The entire app logic is in `index.html`. To contribute:

1. **Understand the data flow**:
   - User fills Profile tab → Form blur events → `updateProfile()` saves to D & localStorage
   - `updateProfile()` calls `updateDashboard()`
   - `updateDashboard()` recalculates all KPIs and refreshes UI

2. **Understand the API flow**:
   - User clicks ⟳ or ⚡ button
   - Triggers `fetchNAV()` or `fetchNifty()` (async, Promise-based)
   - Updates `D.nav` and `D.niftyHigh`
   - Calls `updateDashboard()` to refresh UI

3. **Understand the UI flow**:
   - Tab clicks hide/show sections (`.tabs-container > .tab` divs)
   - Modals overlay on Dashboard (`.modal` divs, show/hide via `display: none` or class toggle)
   - Forms in Profile tab update on blur and input

4. **Testing**: Always run `node test-fixes.js` after changes to catch regressions.

---

**Happy coding! 🔥💰**
