# Design: Bug Fixes + SIP P&L Enhancement
**Date:** 2026-05-08  
**Status:** Approved  
**Scope:** 4 confirmed bug fixes + true XIRR replacement + costBasis fields + SIP P&L UI + Portfolio P&L summary card

---

## Context

A council audit of `index.html` identified 4 confirmed bugs causing data loss and stale data. In parallel, the existing SIP P&L feature has two correctness gaps: (1) the XIRR calculation is actually CAGR, not XIRR, and (2) there is no way for users to enter their actual invested amount from a broker statement, so P&L is always approximated from `months × SIP amount`. This design fixes all bugs and extends the P&L feature.

---

## Section 1: Bug Fixes

### 1.1 Import data loss
**File:** `index.html`  
**Location:** `importData()`, line 4288  
**Problem:** `importData()` writes to `localStorage.setItem('fireOS_v1', ...)` but `loadData()` reads `fireOS_v2` first. Imported data is silently ignored on next reload — the old v2 data is used instead.  
**Fix:** Change the setItem key from `'fireOS_v1'` to `'fireOS_v2'`.

### 1.2 Dead DEFAULTS object
**File:** `index.html`  
**Location:** `const DEFAULTS = { ... }`, line 2723 (~20 lines)  
**Problem:** `DEFAULTS` is never referenced — `loadData()` uses `CONFIG.defaults` (line 5292). The two objects are similar but differ on `sipStart1..4` fields. Dead code that diverges silently.  
**Fix:** Delete the entire `DEFAULTS` const block.

### 1.3 NAV cache TTL too long
**File:** `index.html`  
**Location:** `const _CACHE_TTL`, line 4984  
**Problem:** TTL is 30 days. A user who opens the app once and returns two weeks later sees 2-week-old NAVs presented as live. All P&L calculations are silently wrong.  
**Fix:** Change to `4 * 60 * 60 * 1000` (4 hours). Verified: `_CACHE_TTL` is read on line 4986 inside `_cacheGet()` which is the actual NAV cache path — the constant change takes effect.

### 1.4 Export misses watchdog data
**File:** `index.html`  
**Location:** `exportData()`, line 4264  
**Problem:** Export only serializes `D` (profile data). Three localStorage keys — `fireOS_alpha`, `fireOS_review`, `fireOS_log` — are persisted separately and not included in the backup. A user who exports and re-imports loses all watchdog history.  
**Fix:** Export bundles all four stores into a versioned envelope:
```json
{ "version": 2, "data": D, "alpha": [...], "review": [...], "log": [...] }
```
Import unpacks the envelope and restores all four stores. Import also handles the old bare-D format for backwards compatibility (treats the whole object as `D`, leaves alpha/review/log untouched).

---

## Section 2: True XIRR

**File:** `index.html`  
**Location:** `calculateSIPXIRR()`, lines 3812–3884  
**Problem:** Current formula is `(currentValue / totalInvested)^(1/years) - 1` — this is CAGR, treating all invested capital as if deposited on Day 1. Understates returns for older SIPs, overstates for newer ones.

**Replacement:** Newton-Raphson IRR on monthly cashflow array.

**Algorithm:**
1. Build cashflow array: one `{ date, amount: -sipAmount }` per calendar month from `sipStart` to today, plus one `{ date: today, amount: +currentValue }`.
2. Solve `Σ amount_i / (1+rate)^(t_i) = 0` where `t_i = days_since_first_cashflow / 365.25`.
3. Newton-Raphson: `rate_new = rate - NPV(rate) / NPV'(rate)`, iterate until `|delta| < 1e-7` or 100 iterations.
4. Return `rate * 100` (percent). Return `null` if not converged.

**Starting rate:** Use `rate = 0.1` (10%). If null (non-convergence), retry with `rate = -0.05` seed to catch negative-return funds. Return null only if both seeds fail.

**Edge cases:**
- SIP < 1 month old → `null` (show `—`)
- `currentValue = 0` (NAV not loaded) → `null` (show `—`)
- Non-convergence after both seeds → `null` (show `—`)

No signature change to `calculateSIPXIRR()`. Callers are unaffected.

---

## Section 3: P&L Feature

### 3.1 costBasis fields in Profile

**Four new optional number inputs** added to the SIP section of the Profile tab:
- `costBasisInput1` through `costBasisInput4`
- Label: "Actual Invested (₹)" — sub-label: "From broker statement — overrides auto-calc"
- Stored in `D.costBasis1..4`
- Added to `populateProfileFields()` field map **AND** the `fields` array in `saveProfile()` (lines 2799–2803) — both must be updated or the values won't save
- If blank/zero: `calculateSIPPL()` uses `months × sipAmount` as before
- If filled: `calculateSIPPL()` uses the entered value instead

### 3.2 SIP card per-fund P&L display

Each SIP card is updated to show below the existing NAV/units/value line:

```
Invested:  ₹X,XXX  (N months × ₹Y/mo)   ← shows "from statement" if costBasis used
Current:   ₹X,XXX
P&L:       +₹XXX (+X.X%)                 ← green text if positive, red if negative
XIRR:      X.X% p.a.                      ← or — if null (NAV not loaded, < 1mo, no convergence)
```

**Before NAVs load:** Invested always shows a number (no NAV needed — uses `months × sipAmount` or `costBasis`). Current, P&L, and XIRR show `—` until NAV is fetched.

**Zero-months edge case:** If `sipStart` is not set or `months <= 0`, show `—` for Invested, Current, P&L, and XIRR — all four rows. Avoids `+₹0 (+0%)` display for brand-new/unconfigured funds.

**CSS:** Use inline `style="color:var(--green)"` / `style="color:var(--red)"` for P&L color — consistent with existing P&L render code that already uses this pattern. No new CSS classes needed.

### 3.3 Portfolio P&L summary card

A new card rendered in `renderDashboard()` just before the SIP cards section. Uses the existing `.kpi-card` CSS class — no new styles.

```
SIP Portfolio Summary
Total Invested   ₹XX,XXX
Current Value    ₹XX,XXX
Overall P&L      +₹X,XXX (+X.X%)   ← green/red
```

No portfolio-level XIRR (mixing funds with different start dates is ambiguous).

**Calculation function** (`calcPortfolioPL()`):
```js
function calcPortfolioPL() {
  let totalInvested = 0, totalCurrent = 0;
  [1, 2, 3, 4].forEach(i => {
    const pl = calculateSIPPL('sip' + i);
    if (pl) {
      totalInvested += pl.totalInvested;
      totalCurrent  += pl.currentValue;
    }
  });
  const pl = totalCurrent - totalInvested;
  const plPct = totalInvested ? (pl / totalInvested) * 100 : 0;
  return { totalInvested, totalCurrent, pl, plPct };
}
```

---

## Files Modified

| File | Sections Changed |
|------|-----------------|
| `index.html` | 1.1 importData (line 4288), 1.2 delete DEFAULTS (line 2723), 1.3 _CACHE_TTL (line 4984), 1.4 exportData + importData envelope, 2.0 calculateSIPXIRR body (lines 3812–3884), 3.1 Profile HTML + populateProfileFields, 3.2 SIP card render in renderDashboard, 3.3 new calcPortfolioPL + summary card render |

No new files created.

---

## Verification

1. **Bug 1.1:** Export data → reimport → reload page → confirm imported values appear (not old values)
2. **Bug 1.2:** Search `index.html` for `DEFAULTS` — should return zero results
3. **Bug 1.3:** Open DevTools → Application → localStorage — after NAV fetch, check cached timestamp. Reload after 5 hours → verify re-fetch occurs
4. **Bug 1.4:** Export → open JSON — confirm `alpha`, `review`, `log` keys present alongside `data`
5. **XIRR:** For a 12-month SIP, XIRR should be slightly different from CAGR (higher if recent months underperformed, lower if outperformed). Verify NR converges in console log
6. **P&L UI:** Enter costBasis1 in Profile → Dashboard SIP card 1 shows "from statement" source label
7. **P&L loading:** Clear localStorage → reload → confirm SIP cards show `—` for P&L before clicking ⟳ NAV
8. **Portfolio card:** Verify sum matches manual addition of 4 fund P&Ls
