# FIRE OS — Code Audit & Improvement Plan
**Date:** May 7, 2026 | **File Size:** 190.9 KB | **Lines:** 4,654 | **Functions:** 76
**Deployment:** GitHub Pages (static hosting) | **Strategy:** Progressive enhancement, backward-compatible changes

---

## 🚀 GitHub Pages Deployment Strategy

### Build & Deploy
- **Host:** GitHub Pages (static, no backend)
- **CI/CD:** GitHub Actions workflow (`.github/workflows/deploy.yml`)
- **Asset pipeline:** Minify CSS/JS before deploy
- **Source map:** Keep source maps for debugging, exclude from deploy

### Compatibility Requirements
1. **No Node.js dependencies** — all code must be vanilla JS or CDN-loaded
2. **No build step for runtime** — entry point is single `index.html` (current approach ✓)
3. **CORS-safe APIs only** — all data fetches must work from `github.io` domain
4. **localStorage persistence** — survives page reloads (already implemented ✓)
5. **Offline fallback** — cached data works if network fails

### Current Status (GitHub Pages Ready)
✅ No backend dependencies  
✅ All external APIs use CORS proxies  
✅ localStorage for data persistence  
✅ Single entry point  
✅ CSS/JS all inline or CDN

### Before Deploying (Checklist)
- [ ] Verify `allorigins.in` CORS proxy is reliable (used for Nifty fetch)
- [ ] Test on `yourusername.github.io` domain (may have different CORS headers)
- [ ] Add 404 redirect rule for deep links (if using client-side routing)
- [ ] Cache-busting strategy for CSS/JS updates (append `?v=YYYYMMDD` to imports)
- [ ] Remove any local file:// API calls (all should be HTTPS)
- [ ] Test localStorage in incognito/private browsing mode

### Continuous Deployment Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy FIRE OS to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Minify CSS/JS
        run: |
          npm install -g csso-cli terser
          csso index.html -o index.min.html
          # Or keep as-is if <190KB is acceptable
      - name: Deploy to Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
```

### File Structure for GitHub Pages
```
fire-os/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── index.html ← main entry point
├── FIRE_OS_AUDIT_REPORT.md
├── README.md (add usage + deployment docs)
├── uploads/
│   └── fireOS_backup_2026-05-06.json
└── .gitignore (ignore node_modules, .DS_Store)
```

### Optimization for GitHub Pages
**Current:** 190 KB single HTML file  
**After split (future):**
```
index.html (50 KB, structure only)
js/main.js (40 KB, bundled & minified)
css/main.css (10 KB, minified)
```
**Gzip-compressed on deploy:** ~50 KB total

### Migration Path (No Breaking Changes)
1. **Phase 1 (now):** Deploy current monolithic file as-is
2. **Phase 2 (v2.1):** Add CONFIG object, keep sip1/2/3/4 for backward compat
3. **Phase 3 (v2.2):** Split into modular files, use bundler (webpack/esbuild)
4. **Phase 4 (v3.0):** Full refactor (optional, only if needed)

---


| Metric | Value | Status |
|--------|-------|--------|
| File size | 190.9 KB | 🔴 Too large for single file |
| Functions | 76 | ✓ Good count, but some >50 lines |
| Event listeners | 130 | 🟡 High (mostly onclick handlers) |
| Inline styles | 248 | 🔴 Should be CSS classes |
| Fetch calls | 4 (Nifty, EUR/INR, NAVs, SocGen) | ✓ Good |
| localStorage refs | 18 | ✓ Reasonable |

### Function Categories
- **Data/Storage:** 8 (loadData, saveProfile, etc.)
- **UI/Rendering:** 11 (renderDashboard, switchTab, etc.)
- **Calculations:** 13 (calcCrash, calcBear, calcXIRR, etc.)
- **API/Fetch:** 6 (fetchLiveNavs, fetchLiveNifty, etc.)
- **Utilities:** 12+ helper functions

---

## 🔴 CRITICAL Issues (Fix First)

### 1. Single Monolithic File
**Problem:** 190 KB HTML file is hard to maintain, debug, and test.
**Impact:** Any change requires reloading entire page; impossible to unit test.
**Solution:** Split into:
```
index.html (entry point + HTML structure)
js/
  ├── config.js (scheme codes, defaults, constants)
  ├── data.js (loadData, saveProfile, data migrations)
  ├── ui.js (renderDashboard, switchTab, modals)
  ├── calcs.js (all calculation functions)
  ├── api.js (fetch functions)
  └── utils.js (fmt, pct, helpers)
css/
  ├── main.css (global styles)
  ├── components.css (reusable classes)
  └── dark-theme.css (color vars)
```

### 2. No Input Validation
**Problem:** User enters `-5000` for income, invalid dates, negative returns — all accepted silently.
**Impact:** Calculations produce garbage output without warning.
**Solution:** Add validators:
```js
const validate = {
  positive: (v, min=0) => v >= min ? v : null,
  percent: (v) => v >= -100 && v <= 100 ? v : null,
  age: (v) => v >= 18 && v <= 100 ? v : null,
  date: (v) => !isNaN(Date.parse(v)) ? v : null,
};
```
Show inline error messages on invalid input.

### 3. Silent Error Handling
**Problem:** All fetch/calc errors caught with empty `catch {}` blocks.
**Impact:** User doesn't know if Nifty fetch failed; receives stale data.
**Solution:** Implement proper error handling:
```js
try {
  const result = await _fetchNiftyData();
  if (!result) throw new Error('API returned null');
  return result;
} catch (e) {
  console.error('Nifty fetch failed:', e);
  showToast('⚠ Nifty fetch failed: ' + e.message, 5000, 'warning');
  return D.niftyHigh ? { cached: true } : null;
}
```

### 4. Hardcoded Magic Numbers
**Problem:** Constants like `26000`, `28499`, `10000`, `0.78`, `0.67` scattered throughout.
**Impact:** Hard to find and update; breaks calculations if changed.
**Solution:** Create config object:
```js
const CONFIG = {
  defaults: {
    income: 55000,
    expenses: 25000,
    age: 25,
    niftyHigh: 26000,
    mf: 28499,
  },
  funds: {
    ppfcf: { code: '122639', name: 'Parag Parikh Flexi Cap', categoryExp: 0.78 },
    growth: { code: '118668', name: 'Nippon India Growth MC', categoryExp: 0.78 },
    smallCap: { code: '118778', name: 'Nippon India Small Cap', categoryExp: 0.67 },
    gold: { code: '113076', name: 'ICICI Prudential Gold ETF', categoryExp: 0.05 },
  },
  triggers: {
    level1: 10,   // 10% drawdown
    level2: 15,   // 15% drawdown
    level3: 25,   // 25% drawdown
  },
};
```

### 5. 248 Inline Styles
**Problem:** `style="color:var(--text-dim);font-family:'Space Mono',monospace;font-size:11px;"` repeated everywhere.
**Impact:** Hard to maintain; inconsistent spacing/colors; bloats HTML.
**Solution:** Create CSS utility classes:
```css
.mono-xs { font-family: 'Space Mono', monospace; font-size: 11px; }
.text-dim { color: var(--text-dim); }
.flex-center { display: flex; align-items: center; justify-content: center; }
.badge-gold { background: var(--gold); color: #000; padding: 4px 8px; border-radius: 3px; }
```
Replace all inline styles with class names.

---

## 🟡 HIGH Priority (Next Sprint)

### 6. No Data Migration Strategy
**Problem:** If you change D schema (e.g., rename `sip1` → `fund_ppfcf`), old users' localStorage breaks.
**Solution:** Add schema versioning:
```js
const SCHEMA_VERSION = 2;
function loadData() {
  let data = localStorage.getItem('fireOS_v2');
  if (!data) {
    // Migrate from v1
    const oldData = localStorage.getItem('fireOS_v1');
    if (oldData) data = migrateV1ToV2(JSON.parse(oldData));
  }
  D = data ? JSON.parse(data) : { ...DEFAULTS };
}
function migrateV1ToV2(oldD) {
  return {
    ...oldD,
    fund_ppfcf: oldD.units1, // rename sip1 → units in fund object
    fund_growth: oldD.units2,
    // ... etc
  };
}
```

### 7. Large Functions (>50 lines)
**Functions to refactor:**
- `renderDashboard()` — split into `renderKPICards()`, `renderSIPGrid()`, `renderCharts()`
- `calcCrash()` — split into `_calcCrashLevels()`, `_calcWintDeployment()`, `_renderCrashResults()`
- `saveProfile()` — use generic form validator instead of hard-coding all fields
- `calcHome()` — extract projection logic into separate function

### 8. Fetch Error Handling
**Problem:** `fetchLiveNavs()` silently fails if API is down.
**Solution:** Add retry logic + user notification:
```js
async function fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return await res.json();
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1))); // exponential backoff
    }
  }
}
```

### 9. Modal State Management
**Problem:** Modals opened/closed imperatively with `display: 'block'/'none'` scattered in multiple places.
**Solution:** Use a state machine:
```js
const modals = {
  crash: { visible: false, autofocus: 'niftyCurrent' },
  profile: { visible: false },
  // ...
};
function openModal(name) {
  modals[name].visible = true;
  document.getElementById(name + 'Modal').style.display = 'block';
  const el = document.getElementById(modals[name].autofocus);
  if (el) el.focus();
}
```

### 10. Chart.js Initialization
**Problem:** Chart creation scattered in `renderDashboard()` with duplicate code.
**Solution:** Extract into utility:
```js
function createChart(elementId, type, labels, datasets) {
  const ctx = document.getElementById(elementId).getContext('2d');
  return new Chart(ctx, {
    type,
    data: { labels, datasets },
    options: { responsive: true, maintainAspectRatio: false, ... }
  });
}
```

---

## 🟢 MEDIUM Priority (Nice-to-have)

### 11. Loading States
Add spinners when fetching:
```js
function showLoading(elementId, show = true) {
  const el = document.getElementById(elementId);
  if (show) {
    el.innerHTML = '<div style="text-align:center;padding:20px;"><div class="spinner"></div></div>';
  }
}
```

### 12. Inconsistent Naming
Rename:
- `sip1/2/3/4` → `fund_ppfcf`, `fund_growth`, `fund_smallcap`, `fund_gold`
- `units1/2/3/4` → same pattern
- `ngEr`, `scEr` → `growth_expenseRatio`, `smallCap_expenseRatio`
- `ppfAum` → `ppf_currentValue`

### 13. Magic Numbers → Named Constants
```js
const CRASH_LEVELS = {
  level1: { threshold: 0.10, deployAmount: 20000 },
  level2: { threshold: 0.15, deployAmount: 35000 },
  level3: { threshold: 0.25, deployAmount: 'all_wint_minus_buffer' },
};
```

### 14. Undo/Redo for Profile
Add confirmation before save:
```js
function saveProfile() {
  if (!confirm('Save changes to profile?')) return;
  // ... save logic
}
```

### 15. Auto-refresh Live NAVs on Timer
```js
setInterval(() => {
  if (document.getElementById('tab-dashboard').classList.contains('active')) {
    fetchLiveNavs();
  }
}, 300000); // 5 minutes
```

---

## 🔵 Nice-to-Have (Future)

### 16. Light Theme Toggle
Add CSS variable override:
```css
body.light-mode {
  --bg: #ffffff;
  --text: #1a1a1a;
  --surface: #f5f5f5;
  /* ... etc */
}
```

### 17. Keyboard Shortcuts
```js
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'd') switchTab('dashboard');
  if (e.ctrlKey && e.key === 'p') switchTab('profile');
  if (e.key === 'Escape') closeModal();
});
```

### 18. CSV/JSON Export
Add export buttons to save data outside localStorage:
```js
function exportProfile() {
  const json = JSON.stringify(D, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fireOS_backup_${new Date().toISOString()}.json`;
  a.click();
}
```

### 19. Growth Visualization
Enhance Bear Market simulator with curve graph (already uses Chart.js, just need data).

### 20. Calculator Assumptions
Add tooltips/help text explaining each calculation's assumptions.

---

## 🎯 Recommended Implementation Order (GitHub Pages Optimized)

### Phase 1: Deploy (This Week)
**Goal:** Get current code live on GitHub Pages with zero breaking changes
- [ ] Create `.github/workflows/deploy.yml` (GitHub Actions workflow)
- [ ] Test Nifty fetch from `github.io` domain (verify CORS proxy works)
- [ ] Verify localStorage persists across page reloads
- [ ] Add README.md with setup + deployment instructions
- [ ] Deploy to `yourusername.github.io/fire-os` (or custom domain)

**Outcome:** FIRE OS is live, no user-facing changes.

### Phase 2: Hardening (Week 2–3)
**Goal:** Make code reliable for production users
- [ ] Add input validation (Issue #2) — prevent garbage data
- [ ] Improve fetch error handling (Issue #6) — show user messages, not silent fails
- [ ] Create CONFIG object (Issue #4) — centralize scheme codes, defaults, constants
- [ ] Add data schema versioning (Issue #7) — handle localStorage migrations

**Why first:** These fixes prevent bad calculations without requiring refactoring.  
**Impact:** User gets accurate results, can debug failures.

### Phase 3: Maintainability (Week 4–5)
**Goal:** Make code easier to update without breaking things
- [ ] Create CSS utility classes (Issue #5) — reduce inline styles from 248 to ~20
- [ ] Extract CONFIG object fully (Issue #4) — make scheme codes/defaults editable
- [ ] Refactor 8 large functions (Issue #8) — break into smaller testable pieces
- [ ] Improve modals (Issue #9) — use state machine instead of imperative `display` toggles

**Why next:** These changes are backwards-compatible; can deploy incrementally.  
**Impact:** Easier to add features, less bug-prone when changing code.

### Phase 4: UX Polish (Week 6+)
**Goal:** Improve user experience
- [ ] Add loading states (Issue #11) — spinners during fetch
- [ ] Auto-refresh NAVs on timer (Issue #15) — keep portfolio value fresh
- [ ] Add undo/confirm on save (Issue #14) — prevent accidental overwrites
- [ ] Rename variables (Issue #12) — use `fund_ppfcf` instead of `sip1` (backwards-compat layer)

**Why last:** Nice-to-have but not critical for functionality.  
**Impact:** Users see better feedback, can't accidentally lose data.

### Phase 5: Future (v3.0+, Optional)
- Light theme toggle (Issue #16)
- Keyboard shortcuts (Issue #17)
- CSV/JSON export (Issue #18)
- Growth curve visualization (Issue #19)
- Split into modular JS files (Issue #1) — only if file grows >300 KB

---

## 📋 Quick Start for GitHub Pages

### Step 1: Create `.github/workflows/deploy.yml`
```yaml
name: Deploy FIRE OS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
```

### Step 2: Push to GitHub
```bash
git add .
git commit -m "FIRE OS v2.1 — ready for GitHub Pages"
git push origin main
```

### Step 3: Enable GitHub Pages
In repo settings → Pages → Source: `gh-pages` branch

### Step 4: Verify Deployment
- Site will be live at: `https://yourusername.github.io/fire-os`
- Nifty fetch will work (uses CORS proxy)
- localStorage will persist across sessions

---

## 🔄 Iterative Deployment (Backward Compatible)

**Key principle:** Each change must not break existing user data in localStorage.

**Safe changes:**
- ✅ Add new fields to CONFIG
- ✅ Improve error messages
- ✅ Refactor functions without changing logic
- ✅ Add new CSS classes (don't remove old ones)
- ✅ Rename internal variables (D.sip1 → D.fund_ppfcf, but support both)

**Dangerous changes:**
- ❌ Rename localStorage keys without migration
- ❌ Change calculation formulas without user consent
- ❌ Remove CSS classes (breaks inline style overrides)
- ❌ Change API response format

**Migration example (safe):**
```js
function loadData() {
  let data = localStorage.getItem('fireOS_v2');
  if (!data) {
    const oldData = localStorage.getItem('fireOS_v1');
    if (oldData) {
      // Migrate old schema to new
      const old = JSON.parse(oldData);
      data = {
        ...old,
        fund_ppfcf: old.sip1, // rename, keep D.sip1 as alias
        fund_growth: old.sip2,
      };
    }
  }
  D = data ? JSON.parse(data) : { ...DEFAULTS };
  // Support both old and new names
  D.sip1 = D.sip1 || D.fund_ppfcf;
  D.sip2 = D.sip2 || D.fund_growth;
}
```

---

