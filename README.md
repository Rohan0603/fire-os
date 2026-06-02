# FIRE OS — Financial Independence & Retirement Explorer

A comprehensive personal finance dashboard for FIRE (Financial Independence, Retire Early) planning. Track investments, simulate market crashes, calculate retirement timelines, and manage tax-efficient strategies.

**Live Demo:** https://fire-os-dd6d6.web.app ✨ (with cross-device data sync!)  
**Status:** Production-ready with Firebase cloud sync & authentication

---

## 🚀 Quick Start

### For Users — Cloud Sync Edition
1. Visit **https://fire-os-dd6d6.web.app**
2. **Sign up** with email & password (accounts stored securely)
3. Enter your financial profile in the **Profile** tab
4. Tap **⟳ NAV** to fetch live mutual fund prices
5. Tap **⚡ Fetch Live Nifty** to get current market level
6. View dashboard & open Crash Protocol modal for crash scenarios
7. **Cross-device sync**: Login on mobile/tablet with same email → all data appears instantly! 🔥

### For Users — Local/Offline (No Account Required)
1. Open `index.html` in a modern browser (Chrome, Firefox, Safari, Edge)
2. Enter your financial profile (data saved locally to browser)
3. Proceed as above (steps 3-6)
4. **Note**: Data stays on this device only; not synced elsewhere

### For Developers/Firebase Hosting Deployment (Recommended)

**Get cross-device data sync with Firebase Authentication & Realtime Database**

#### Prerequisites
- Google/Firebase account (free tier available)
- Node.js + npm (for Firebase CLI)
- Git

#### Step 1: Set Up Firebase Project
```bash
# Create/use Firebase project at https://console.firebase.google.com
# 1. Create new project or use existing one
# 2. Enable Realtime Database (Asia Southeast 1 region recommended for India)
# 3. Enable Authentication → Email/Password method
# 4. Note down your credentials (shown in Firebase Console)
```

#### Step 2: Initialize & Deploy
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase (opens browser)
firebase login

# Deploy to Firebase Hosting (from project root)
firebase deploy
```

#### Step 3: Access Your Deployment
Site will be live at: `https://<project-id>.web.app`

Users can now:
- Sign up with email/password
- Sync data across all devices
- Login from mobile/tablet → instant data access

#### Step 4: Verify Features
- [ ] Sign up works (create account with email)
- [ ] Login syncs data (open in another browser, login with same email)
- [ ] Nifty fetch works (tap ⚡ button)
- [ ] NAV prices load (tap ⟳ button)
- [ ] No console errors (open DevTools: F12)

---

### Alternative: GitHub Pages Deployment (No Cloud Sync)

**Deploy without Firebase — data stored locally in browser only**

#### Prerequisites
- GitHub account with a public repository
- Git CLI

#### Step 1: Push Code to GitHub
```bash
git clone https://github.com/yourusername/fire-os.git
cd fire-os
git add .
git commit -m "FIRE OS deployment"
git push origin main
```

#### Step 2: Enable GitHub Pages
1. Go to repo **Settings** → **Pages**
2. Select **GitHub Actions** as source
3. Save — workflow deploys automatically

#### Step 3: Access Your Deployment
Site will be live at: `https://yourusername.github.io/fire-os`

**Note**: No cross-device sync (data local to each browser)

---

## 📋 Features

### Dashboard
- **Net Worth KPI** — Total assets with breakdown (MF, FD, EPF, Wint, Buffer, ESOP)
- **SIP Status** — Live NAVs for 4 funds + **per-fund P&L rows (Invested / Current / P&L / XIRR)** + Portfolio summary card
- **Crash Protocol** — Market drawdown triggers with deployment plan
- **Float Indicator** — Current Nifty level vs live 52W high (auto-fetched)

### Calculators
- **Crash Protocol** — How much to deploy if Nifty crashes 10%/15%/25%
- **Bear Market Simulator** — 10-year compound growth under bad returns
- **Emergency Runway** — Months of survival on liquid assets
- **Insurance Requirement** — Coverage needed based on lifestyle gap
- **SIP Pause Impact** — Cost of missing SIP contributions during downturn
- **XIRR Tracker** — Track IRR of custom investments
- **Step-Up SIP** — Calculate corpus with annual SIP increases
- **Dual Goal Tracker** — Manage FI corpus + home fund simultaneously
- **Home Corpus** — Years to save for home down payment
- **Tax Estimator** — Income tax + LTCG harvest planning
- **FD Interest** — Track maturing FDs by rate & tenor
- **ESOP Tools** — Stock option value projections + **live EUR/INR exchange rate** + benchmark reference levels

### Optimiser
- **LTCG Harvest** — Tax-loss harvesting opportunities
- **Fund Switching** — Switch score between active & index funds
- **Alpha Tracker** — Fund performance vs benchmark

### Watchdog
- **30-Day Cooling Log** — Impulse purchase tracker (required cool-off before buy)
- **Annual Review** — Checklist for yearly portfolio rebalance
- **Fund Health Metrics** — Expense ratio, liquidity, category exposure
- **Alpha vs Benchmark Tracker** — **Auto-populated rolling 3-year performance data (fund vs benchmark)**

### Profile
- **MF Central CAS PDF Import** — Upload NSDL/CDSL Consolidated Account Statement; parser extracts fund/units/date and populates fields via confirmation modal
- **Demat Holdings Support** — Track stock holdings from Demat account directly in portfolio calculations
- **Cost Basis Override** — Optional `costBasis1–4` fields let you enter actual-invested amount instead of computed monthly-SIP × months

### Authentication & Cloud Sync (Firebase)
- **Email/Password Signup** — Create account securely with email + 6+ char password
- **Cross-Device Sync** — Login on desktop/mobile/tablet with same email → all portfolio data syncs instantly
- **Secure Cloud Storage** — Portfolio data stored in Firebase Realtime Database (encrypted in transit)
- **Offline Support** — Changes saved locally when offline; auto-sync when connection restored
- **Logout** — Securely sign out; data cleared from browser (saved safely in cloud)

---

## 🔒 Data & Privacy

### Storage
- **Firebase Realtime Database:** (Primary) Profile data stored securely in cloud; encrypted in transit; each user only accesses their own data
- **localStorage:** (Fallback) Local browser storage when offline or not authenticated
- **Backup:** Download from Profile tab → "Export" button (exports `fireOS_v2` JSON envelope)
- **Persistence:** Cloud data survives browser restart/clear; can access from any device after login

### API Calls
- **Live NAVs:** `api.mfapi.in` (MutualFunds.com API) — public, no auth needed; cached for 4 hours
- **Nifty Fetch:** Yahoo Finance (`^NSEI`) via `api.allorigins.win` CORS proxy — fetches current level + 52W high
- **EUR/INR:** `api.allorigins.win` proxy (Yahoo Finance `EURINR=X`)
- **PDF.js:** `cdnjs.cloudflare.com` — used for Paytm Money PDF import
- **SocGen Stock:** Manual entry (no API — use brokerage price)

All APIs are **CORS-friendly** and work from GitHub Pages (static hosting).

---

## 🛠 Development

### File Structure
```
fire-os/
├── index.html                      # Main app (258 KB, all-in-one)
├── README.md                       # This file
├── CLAUDE.md                       # Developer guide
├── firebase.json                   # Firebase Hosting config
├── .firebaserc                     # Firebase project alias
├── .gitignore                      # Git ignore rules
├── package.json                    # Playwright dependency
├── .github/
│   └── workflows/
│       └── static.yml              # GitHub Pages workflow (alternative)
└── docs/superpowers/specs/         # Design documentation
```

### Technology Stack
- **Frontend:** Vanilla JavaScript (no frameworks)
- **UI:** Hand-coded HTML/CSS (no Bootstrap/Tailwind)
- **Charts:** Chart.js v4.4.0 (via CDN)
- **Fonts:** Google Fonts (Space Mono, Fraunces, DM Sans)
- **Storage:** Firebase Realtime Database (primary) + browser localStorage (fallback)
- **Auth:** Firebase Authentication (email/password)
- **Hosting:** Firebase Hosting (recommended) or GitHub Pages (alternative)

### MF Central CAS Import
- **Trigger**: "Import CAS PDF" button in Profile tab
- **Parser**: PDF.js (`cdnjs.cloudflare.com`) extracts text from NSDL/CDSL Consolidated Account Statement
- **Flow**: Parse → confirmation modal (shows detected fund/units/date + demat holdings) → user confirms → updates Profile fields
- **Demat Support**: Automatically detects and includes demat stock holdings (quantity + current value)
- **Scheme Coverage**: Works with all NSDL/CDSL schemes (not limited to specific funds)

### Future Improvements
- **v2.2+:** Input validation, error handling boundaries, E2E test suite
- **v3.0:** Modularization (component-based architecture)

---

## 🚨 Troubleshooting

### NAV Fetch Returns "⚠"
**Problem:** `api.mfapi.in` may be rate-limited or down  
**Solution:** 
- Try again in a few seconds
- Check browser console (F12) for error message
- Manually enter NAV from your brokerage
- Verify internet connection

### Nifty Fetch Fails
**Problem:** `api.allorigins.win` CORS proxy may be overloaded  
**Solution:**
- Manually enter Nifty level in Crash Protocol modal
- Check [allorigins.win status](https://allorigins.win)
- Use a direct API (requires CORS headers — may not work from GitHub Pages)

### Data Lost After Refresh
**Problem:** localStorage disabled or quota exceeded  
**Solution:**
- Check browser privacy settings (allow cookies/storage for github.io)
- Clear some storage (DevTools → Application → Storage)
- Export profile before clearing cache

### Mobile Layout Broken
**Problem:** Screen too narrow for full UI  
**Solution:**
- Open in landscape mode
- Use desktop view (DevTools → toggle device toolbar)
- Wait for responsive redesign (v3.0)

---

## 📞 Support & Feedback

### Reporting Bugs
1. Open issue in GitHub repo
2. Include: browser + version, steps to reproduce, console errors (F12)
3. Attach `fireOS_backup_*.json` if data-related

### Feature Requests
Open GitHub issue with:
- Use case (why you need this)
- Example or mockup
- Priority (critical/high/nice-to-have)

### Contributions
- Fork repo
- Create feature branch (`git checkout -b feature/xyz`)
- Test thoroughly (especially on mobile)
- Submit PR with description

---

## 📊 Data Format

### Profile Object (localStorage)
```json
{
  "income": 55000,
  "expenses": 25000,
  "age": 25,
  "niftyHigh": 26000,
  "mf": 28499,
  "fd": 540000,
  "epf": 137471,
  "wint": 70900,
  "buffer": 20000,
  "esop": 695500,
  "home": 0,
  "sip1": 12000,
  "sip2": 9000,
  "sip3": 3000,
  "sip4": 3000,
  "ppfAum": 128966,
  "ngEr": 0.78,
  "scEr": 0.67,
  "ngLiq": 7,
  "esop_shares": 95,
  "esop_price": 65.72,
  "units1": 131.49,
  "units2": 1.882,
  "units3": 30.965488,
  "units4": 18.987
}
```

### Mutual Fund Scheme Codes (mfapi.in)
| Fund | Code | NAV (approx) |
|------|------|---|
| Parag Parikh Flexi Cap Direct | 122639 | ₹80 |
| Nippon India Growth Mid Cap Direct | 118668 | ₹4776 |
| Nippon India Small Cap Direct | 118778 | ₹171 |
| ICICI Prudential Gold ETF | 113076 | ₹125 |

---

## 📝 License

FIRE OS is open-source and provided as-is for personal finance planning. Use at your own discretion — not a substitute for professional financial advice.

**Disclaimer:** All calculations are based on assumptions you provide. Past performance ≠ future results. Consult a qualified financial advisor before making investment decisions.

---

## 🎯 Roadmap

### v2.1 (Current)
- ✅ Live NAV fetching + auto-calculation (4-hour cache)
- ✅ Crash Protocol auto-open
- ✅ Input validation
- ✅ Better error messages
- ✅ GitHub Pages ready
- ✅ **SIP P&L tracking with cost basis + Newton-Raphson XIRR**
- ✅ **Per-fund P&L rows (Invested / Current / P&L / XIRR) + Portfolio summary card**
- ✅ **Cost basis override (costBasis1–4) for actual-invested amounts**
- ✅ **MF Central CAS PDF import (PDF.js parser + confirmation modal)**
- ✅ **Demat holdings support (automatic detection in CAS import)**
- ✅ **Live Nifty 52W high fetch**
- ✅ **Live EUR/INR auto-fetch for ESOP Tools**
- ✅ **Alpha vs Benchmark Tracker auto-population (rolling 3-year returns)**
- ✅ **Export/Import v2 envelope (includes watchdog data)**

### v2.2 (Next)
- ⏳ CONFIG object extraction
- ⏳ Data migration strategy
- ⏳ CSS utility classes (reduce inline styles)
- ⏳ Loading states for fetches
- ⏳ Auto-refresh NAVs on timer

### v2.3 (Future)
- ⏳ Responsive mobile layout
- ⏳ Dark/Light theme toggle
- ⏳ CSV/JSON export
- ⏳ Keyboard shortcuts
- ⏳ Growth visualization

### v3.0 (Major Refactor)
- ⏳ Modular JS files
- ⏳ Test suite (Jest)
- ⏳ Build pipeline (Webpack)
- ⏳ TypeScript types
- ⏳ Component framework (if needed)

---

**Happy FIRE planning! 🔥💰**

*Last updated: May 15, 2026*
