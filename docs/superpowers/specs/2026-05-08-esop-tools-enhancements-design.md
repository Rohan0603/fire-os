# ESOP Tools Enhancements Design Spec

**Date:** 2026-05-08  
**Scope:** SIP P&L Hybrid Display, Live EUR/INR Auto-Load, Alpha vs Benchmark Tracker Population

---

## Overview

Three interconnected enhancements to the FIRE OS dashboard:

1. Add **SIP Profit/Loss (Hybrid)** display in Dashboard → SIP Status section
2. Auto-load **Live EUR/INR** when ESOP Tools tab opens
3. Auto-populate **Alpha vs Benchmark Tracker** in Watchdog tab with rolling 3-year performance data

---

## Feature 1: SIP P&L Hybrid Display (Dashboard Tab)

### What It Shows
For each tracked SIP (PPFCF Direct, Nippon Growth Direct, Nippon Small Cap Direct):

**Cost Basis P&L:**
- Total Invested = sum of all monthly SIP contributions to date
- Current Value = current units × current NAV
- P&L Amount = Current Value - Total Invested
- P&L % = (P&L Amount / Total Invested) × 100

**XIRR:**
- Annualized return rate (reuse existing `xirr()` function)

### Display Format
Each SIP card in the "SIP Status" section shows:
```
Fund Name (e.g., PPFCF Direct)
Units: 500 | Current NAV: ₹250
Cost Basis P&L: +₹15,000 (+30%)  |  XIRR: 12.5% p.a.
```

Positive P&L shown in green, negative in red. XIRR always shown for context.

### Data Requirements
- **Total Invested per SIP:** Sum of all monthly SIP contributions (already in `D.profile.sips` or similar)
- **Current Units:** Already tracked in `D.mf`, `D.nipponGrowth`, `D.nipponSmallCap`, etc.
- **Current NAV:** Already fetched via `fetchNAV()` and stored in `D.nav`

### Implementation Details
- Calculation function: `calculateSIPPL(fundName)` returns `{ plAmount, plPercent, xirr }`
- Called in `updateDashboard()` when SIP Status section is rendered
- No new data storage needed; reuse existing structures

---

## Feature 2: Live EUR/INR Auto-Load (ESOP Tools Tab)

### What It Does
When user opens the **ESOP Tools** tab, automatically fetch and display the current EUR/INR exchange rate.

### Display Location
In the "Current SocGen Price (EUR)" section at the top of ESOP Tools tab.

### Display Format
```
EUR/INR Exchange Rate: ₹104.35
Last Updated: 2 mins ago
```

Show both the rate and a timestamp. If rate is older than 1 hour, flag as "stale" or refresh automatically.

### API & Data Flow
- **Endpoint:** Yahoo Finance EUR/INR via CORS proxy (`api.allorigins.win`)
- **Existing Function:** Reuse/adapt the `fetchNifty()` pattern (already works with proxy)
- **Trigger:** Tab click event on `.nav-tab[data-tab="esopTools"]`
- **Storage:** `D.eurInr = { rate: 104.35, timestamp: 1715167200000 }`
- **Fallback:** If fetch fails, show last cached rate or allow manual entry

### Error Handling
- If API fails: Show error message + allow manual entry
- If rate is stale (>1 hour): Show warning badge, offer refresh button
- Retry logic: Auto-retry once if initial fetch fails

---

## Feature 3: Alpha vs Benchmark Tracker Population (Watchdog Tab)

### What It Does
When user opens the **ESOP Tools** tab, populate the existing "Alpha vs Benchmark Tracker" section in the **Watchdog** tab with rolling 3-year performance data.

### Benchmark Pairs (Fixed Mapping)
| Fund | Benchmark |
|------|-----------|
| PPFCF Direct | Nifty 500 TRI |
| Nippon Growth Direct | Nifty Midcap 150 TRI |
| Nippon Small Cap Direct | Nifty Smallcap 250 TRI |

### Data Source
**Historical rolling returns** (updated manually each April):
- Fetched from Value Research or Morningstar India
- Stored in code as a JSON object: `D.alphaTracker.historicalReturns`
- Format:
```json
{
  "historicalReturns": {
    "2024": { // April 2023 - April 2024
      "ppfcf": { "fund": 11.2, "benchmark": 9.5 },
      "nipponGrowth": { "fund": 16.8, "benchmark": 14.2 },
      "nipponSmallCap": { "fund": 20.5, "benchmark": 18.9 }
    },
    "2025": { // April 2024 - April 2025
      "ppfcf": { "fund": 12.1, "benchmark": 10.3 },
      "nipponGrowth": { "fund": 17.5, "benchmark": 15.1 },
      "nipponSmallCap": { "fund": 21.2, "benchmark": 19.6 }
    },
    "2026": { // April 2025 - April 2026 (complete)
      "ppfcf": { "fund": 12.5, "benchmark": 10.2 },
      "nipponGrowth": { "fund": 18.2, "benchmark": 15.8 },
      "nipponSmallCap": { "fund": 22.1, "benchmark": 20.5 }
    }
  }
}
```

### Current Year Rolling Return (Auto-Calculated)
For the current partial rolling period (April 2026 → May 2026 and ongoing):
- Calculate fund return: `(currentNAV - aprilNAV) / aprilNAV × 100`
- Fetch benchmark index levels for April 2026 and current date
- Calculate benchmark return using same formula
- Store in: `D.alphaTracker.currentYearRolling`

### Display Format (Watchdog Tab)
Table showing for each fund:
```
| Fund | 3-Yr Return | Benchmark Return | Outperformance |
|------|-------------|------------------|-----------------|
| PPFCF Direct | 12.5% | 10.2% | +2.3% |
| Nippon Growth | 18.2% | 15.8% | +2.4% |
| Nippon Small Cap | 22.1% | 20.5% | +1.6% |
```

Color coding:
- Green if outperformance > 0%
- Red if outperformance < 0%
- Neutral if equal

### Implementation Details
- **Trigger:** When ESOP Tools tab opens, call `populateAlphaTracker()`
- **Function:** `populateAlphaTracker()` merges historical + current year data, renders to Watchdog tab
- **Benchmark NAV Storage:** Store April 2026 NAVs in code (fetched once, not real-time)
- **Auto-refresh:** On subsequent ESOP Tools opens, recalculate current year rolling return with latest NAVs

---

## Data Structure Summary

### New/Modified Objects in `D`
```javascript
D.alphaTracker = {
  historicalReturns: { // Updated manually each April
    "2024": { "ppfcf": { fund: 11.2, benchmark: 9.5 }, ... },
    "2025": { ... },
    "2026": { ... }
  },
  currentYearRolling: { // Auto-calculated
    "ppfcf": { fund: 5.2, benchmark: 4.1 },
    "nipponGrowth": { ... },
    "nipponSmallCap": { ... }
  },
  benchmarkNAVApril: { // Stored for current year calculation
    "ppfcf": 250.5,
    "nipponGrowth": 180.2,
    "nipponSmallCap": 95.8,
    "nifty500": 21500,
    "niftyMC150": 15200,
    "niftySC250": 8900
  }
};

D.eurInr = {
  rate: 104.35,
  timestamp: 1715167200000
};
```

---

## Event Flow

1. **User clicks ESOP Tools tab**
   - Trigger: `document.querySelector('[data-tab="esopTools"]').click()`
   - Action 1: `fetchEURINR()` → fetch live rate, update `D.eurInr`, display in ESOP Tools
   - Action 2: `populateAlphaTracker()` → merge historical + current year data, render to Watchdog tab

2. **User opens Watchdog tab**
   - Display: Pre-populated Alpha vs Benchmark Tracker (data already loaded from ESOP Tools open)

3. **User opens Dashboard tab**
   - Display: SIP Status section shows Cost Basis P&L + XIRR for each SIP

---

## Edge Cases & Fallbacks

### EUR/INR Fetch Fails
- Show: "EUR/INR unavailable. Last rate: ₹104.35 (24 hours ago)"
- Offer manual entry field

### Benchmark NAV Fetch Fails (April baseline)
- Use last known benchmark level or require manual input
- Flag in Watchdog tab: "Benchmark data incomplete"

### NAV Data Missing
- If current NAV missing, show: "Awaiting NAV update"
- P&L calculation waits until NAV available

### First-time Setup (No Historical Data)
- Show: "Waiting for data. Update annually in April."
- Display only current year rolling return once available

---

## Testing Checklist

- [ ] SIP P&L displays correctly in Dashboard SIP Status
- [ ] Cost Basis P&L calculation correct (test with known investments)
- [ ] XIRR displays alongside P&L
- [ ] EUR/INR fetches on ESOP Tools tab open
- [ ] EUR/INR timestamp updates correctly
- [ ] Alpha vs Benchmark Tracker populates on ESOP Tools open
- [ ] Rolling 3-year returns display correctly in Watchdog
- [ ] Outperformance % calculated correctly
- [ ] Color coding (green/red) works
- [ ] Stale data warnings appear when appropriate
- [ ] Fallbacks work (API failures, missing data)
- [ ] Data persists across tab switches

---

## Implementation Notes

- No database or server needed; all data stored in code + localStorage
- Reuse existing patterns (CORS proxy for EUR/INR, fetchNAV for NAV structure)
- Keep single-file design intact (no new files or dependencies)
- Historical data updated manually each April (document in CLAUDE.md)

