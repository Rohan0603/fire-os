# CLAUDE.md Documentation Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update CLAUDE.md with comprehensive financial plan context, missing features (Coorg goal, Watchdog rules), development roadmap, and user guide to eliminate ambiguities and document critical decisions.

**Architecture:** Five-section surgical expansion: (1) Financial Plan Overview at top clarifies dual goals + allocation; (2) Watchdog Rules documents fund manager exits + AUM triggers; (3) Coorg Goal Tracker feature section; (4) Development Roadmap (v2.3, v3.0); (5) User Guide per-tab walkthrough. Plus immediate FI target fix in Key Metrics section.

**Tech Stack:** Plain markdown; no code changes required.

---

## File Structure

- **Modify:** `C:\Users\ponna\Project\fire-os\CLAUDE.md`
  - Insert "Financial Plan Overview" section (before "App Features")
  - Update "App Features" to include Coorg Goal Tracker
  - Add "Portfolio Watchdog Rules" subsection (under "App Features")
  - Add "Development Roadmap" section (after "Performance Notes")
  - Add "User Guide" section (before "Development Workflow")
  - Fix "Key Metrics & Health Checks" section (correct FI target math)

---

## Task 1: Read Current CLAUDE.md and Identify Insertion Points

- [ ] **Step 1: Read CLAUDE.md to current state**

Read the file to understand structure and identify exact line numbers where new sections should go.

- [ ] **Step 2: Identify section insertion points**

Note exact locations:
- Where "## App Features" starts
- Where "## Architecture & File Structure" ends
- Where "## Performance Notes" section is
- Where "## Development Workflow" section starts
- Where "Key Metrics & Health Checks" is located

---

## Task 2: Add "Financial Plan Overview" Section

**Files:**
- Modify: `C:\Users\ponna\Project\fire-os\CLAUDE.md`

- [ ] **Step 1: Insert "Financial Plan Overview" section before "App Features"**

Insert this entire section between "## Current Version: v2.2.1 (Latest)" and "## App Features":

```markdown
## Financial Plan Overview

**Dual Goals:**
1. **FI**: ₹5.5Cr corpus by age 43–44 (₹122K/month expense at 45, 3% SWR, 17% CAGR needed)
2. **Coorg**: ₹2Cr by 2036 (1 acre + nalukettu build, land cost inflation 12–15%/year)

**Portfolio Allocation** (40/30/20/10):
- **PPFCF** ₹12K/mo (40%): Defensive core, Beta 0.55, downside capture 34–42%, managed by Rajeev Thakkar
- **Nippon Growth** ₹9K/mo (30%): Mid-cap, 7-day liquidity vs HDFC's 23-day, managed by Samir Rachh
- **Nippon Small Cap** ₹6K/mo (20%): High-beta growth, small-cap exposure
- **Gold ETF** ₹3K/mo (10%): Volatility dampener, inflation hedge

**SIP Strategy:**
- Current: ₹30K/mo starting May 2026
- Annual step-up: +10% each April 1st
- Projected: ₹1.28L/mo by 2041

**Withdrawal Plan** (at FI, age 45):
- Safe Withdrawal Rate: 3% annually (₹122K/month from ₹5.5Cr)
- Redemption priority: PPFCF first → Nippon Growth → Small Cap last
- LTCG harvesting: ₹1.25L/year gains from Year 6 onwards

**Timeline Scenarios:**
- **17% CAGR**: FI by age 43–44 (optimal)
- **14% CAGR**: FI by age 47–48 (realistic market)
- **13% CAGR**: FI by age 49–50 (conservative stress test)
```

- [ ] **Step 2: Verify section is readable and all links intact**

Open CLAUDE.md in text editor, scroll to new section, check formatting is clean.

---

## Task 3: Add Coorg Goal Tracker to App Features

**Files:**
- Modify: `C:\Users\ponna\Project\fire-os\CLAUDE.md` (in "## App Features" section)

- [ ] **Step 1: Locate "## App Features" and add Coorg Goal Tracker bullet**

Find the line starting with "## App Features" and add this bullet **after the first bullet point** (Portfolio tracking):

```markdown
-   **Coorg Goal Tracker** (v2.3+, currently in planning)
    - Separate corpus goal: ₹2Cr by 2036
    - Dedicated SIP: ₹10K/mo starting 2031 (allocation: Nifty 50 50% + Debt 30% + SGB 20%)
    - ESOP liquidation trigger: When ESOP unlocks for Coorg construction (2035–2036)
    - Progress widget: Real-time current corpus vs. ₹2Cr target display
    - Independent from FI goal tracking
```

- [ ] **Step 2: Verify Coorg bullet integrates smoothly with existing bullets**

Check that the bullet formatting matches surrounding items (indentation, dash type, etc.).

---

## Task 4: Add "Portfolio Watchdog Rules" Subsection

**Files:**
- Modify: `C:\Users\ponna\Project\fire-os\CLAUDE.md`

- [ ] **Step 1: Add Watchdog Rules subsection after "Live Nifty 52W high fetch" bullet**

Find the bullet "**Live Nifty 52W high fetch**..." and add this new subsection immediately after it, before the closing of the App Features list:

```markdown
-   **Portfolio Watchdog & Critical Alerts** (Fund manager exit monitoring, AUM triggers, liquidity monitoring)
    - **Fund Manager Exits:**
      - Rajeev Thakkar (PPFCF): If exits → pause lump-sum investments 6 months, continue SIP only
      - Samir Rachh (Nippon Small Cap): If exits → pause lump-sum investments 6 months, continue SIP only
    - **Fund AUM Breaches:**
      - PPFCF corpus exceeds ₹1.75L Cr → trigger review, Plan B = Mirae Asset Flexi Cap Direct
      - Nippon Growth blocked > 14 days → trigger review, Plan B = Motilal Oswal Midcap Direct
      - Nippon Small Cap blocked > 60 days → temporary switch to SBI/Bandhan Small Cap Direct
    - **Annual Triggers:**
      - April 1: Auto-execute SIP step-up (+10% monthly amount)
      - April 1 (Year 6+): LTCG harvest reminder (₹1.25L gains target)
      - When corpus hits ₹5.5Cr: Begin SWP evaluation workflow
    - **Implementation:** Real-time monitoring of fund AUM/liquidity; email + dashboard alerts on trigger events
```

- [ ] **Step 2: Verify Watchdog section is clearly nested and formatted**

Check indentation (should match other feature sub-bullets), verify all manager names and AUM limits are exact.

---

## Task 5: Add "Development Roadmap" Section

**Files:**
- Modify: `C:\Users\ponna\Project\fire-os\CLAUDE.md`

- [ ] **Step 1: Locate "## Performance Notes" section and add Roadmap before it**

Insert this new section **immediately before "## Performance Notes"**:

```markdown
## Development Roadmap

### v2.3 (Next Release, Q3 2026)
- **Scenario Modeler**: CAGR sliders (11–20%), SIP amount sliders, salary jump sliders → real-time FI age output (e.g., "FI at age 45.2 with 15% CAGR")
- **Crash Alerts**: Real-time Nifty level monitoring, automated email/dashboard alerts at 10% / 15% / 25% market falls
- **Coorg Goal Tracker**: Separate corpus progress widget, independent target display vs. ₹2Cr by 2036
- **Portfolio Rebalancing Tool**: Show current vs. target allocation (40/30/20/10), highlight drift >5%, suggest rebalancing trades
- **Fund Manager Alert Integration**: Watchdog rules automated (manager exits → pause lump sums; AUM breach → alert user)

### v3.0 (Q4 2026)
- **SWP Automation**: Withdrawal scheduler, FIFO unit redemption logic, automatic LTCG harvesting integration
- **Tax Optimization Engine**: LTCG harvest calendar, SIP vs. lump-sum tax comparison, Section 80C/80D filing hints
- **Advisor Integration**: Link to Certified Financial Planner review workflow (optional integration)
- **Custom Expense Tracking**: Link SWP withdrawals to actual spending, FI target validation
```

- [ ] **Step 2: Verify Roadmap section is positioned correctly**

Check that Performance Notes section immediately follows Roadmap.

---

## Task 6: Add "User Guide" Section

**Files:**
- Modify: `C:\Users\ponna\Project\fire-os\CLAUDE.md`

- [ ] **Step 1: Locate "## Development Workflow" and insert User Guide section before it**

Add this new section **immediately before "## Development Workflow"**:

```markdown
## User Guide

### Dashboard Tab
**Purpose:** Real-time portfolio snapshot, FI/Coorg goal progress, market health.

**Key Metrics:**
- **Total Net Worth**: Sum of all holdings (MF units × NAV + FD balance + EPF balance + ESOP value + demat stocks + Wint cash)
- **SIP Portfolio P&L**: Per-fund rows display (Invested / Current Value / P&L % / XIRR %)
  - Example: "Parag Parikh: ₹1.2L invested → ₹1.45L current → +20.8% P&L → 14.3% XIRR"
- **FI Goal Progress**: Current corpus vs. ₹5.5Cr target, age-to-FI estimate (e.g., "On track for FI at 43.5 years")
- **Coorg Goal Progress**: Current corpus vs. ₹2Cr target (separate tracker, starts 2031)
- **Float Indicator**: Nifty level vs. 52-week high, shows market drawdown % (e.g., "Nifty at −8% from 52W high")
- **Action:** Monitor monthly; update portfolio data quarterly or after major transactions

### Profile Tab
**Purpose:** Input portfolio holdings, import CAS PDFs, configure calculation overrides.

**Sections:**
- **Portfolio Entry:**
  - MF holdings: Scheme name + units + purchase cost basis
  - FD details: Bank name + principal + interest rate + maturity date
  - EPF balance: Current accumulated balance
  - ESOP shares: Company + shares + grant date + vest date + exercise price
  - Demat stocks: ISIN + company name + quantity + current value
- **CAS PDF Import:**
  - Click "Import CAS PDF" button
  - Select Consolidated Account Statement from broker
  - System auto-extracts: Fund names, units, NAV as of statement date, demat holdings (ISIN + quantity)
  - Review confirmation modal, confirm imports
  - Demat stocks auto-populate as separate holdings
- **Cost Basis Overrides:**
  - For SIPs where auto-calculated "invested amount" is wrong, override with actual cost basis
  - Field: `costBasis1`, `costBasis2`, etc. (one per SIP)
  - Used in P&L calculation: Actual P&L = (Current Value − Manual Cost Basis)
- **Action:** Update quarterly or immediately after CAS imports; verify all holdings match statement

### Calculators Tab
**Purpose:** Run financial scenarios, stress-test plan, evaluate life events.

**Available Calculators:**
- **Crash Protocol**: 
  - Input: Current Nifty level + desired fall % (10%, 15%, 25%)
  - Output: Recommended Wint Wealth deployment amount (₹20K at −10%, ₹35K at −15%, ₹60K at −25%)
  - Use: Monthly during market downturns; helps systematize crash buying
- **SIP Pause Impact**:
  - Input: Current SIP amount + number of months paused
  - Output: Corpus loss vs. normal SIP continuation (e.g., "3-month pause = ₹45K opportunity cost")
  - Use: Before pausing SIP (e.g., job transition, emergency)
- **Emergency Runway**:
  - Input: Current liquid assets (MF + FD + Buffer cash)
  - Output: Months of survival at ₹122K/month expense run-rate
  - Use: Quarterly health check; keep >12 months runway
- **ESOP Tools**:
  - Input: ESOP shares + grant date + vest date + current stock price + exercise price
  - Output: Maturity value, post-tax value (TDS estimate), EUR/INR conversion (auto-fetched)
  - Use: Annually during vesting; helps plan Coorg goal funding
- **Beta/Downside Capture Stress Simulator** (planned v3.0):
  - Input: Portfolio allocation (%, fund selection) + market stress scenario (−30% crash, stagflation, etc.)
  - Output: Portfolio stress test, drawdown %, time-to-recovery estimate
  - Use: Annual plan review; validate allocation against risk appetite

### Watchdog Tab
**Purpose:** Monitor fund health, manager status, trigger alerts.

**Sections:**
- **Fund Monitoring Widget:**
  - PPFCF: Current AUM, Rajeev Thakkar status, last rebalance date, risk rating
  - Nippon Growth: Current AUM, Samir Rachh status, fund liquidity (7-day redemption), last block date (if any)
  - Nippon Small Cap: Current AUM, fund liquidity, last block date
  - Action: If AUM breach or manager exit detected, alert user
- **Alpha vs Benchmark Tracker:**
  - Rolling 3-year fund returns vs. Nifty 50 index
  - Shows outperformance/underperformance %
  - Action: Monitor annually; underperformance >3% triggers fund review
- **Trigger Alerts:**
  - Red alert: "SIP step-up due April 1st" (April)
  - Red alert: "LTCG harvest period" (April–May)
  - Red alert: "Corpus ₹5.5Cr reached" (when applicable)
  - Yellow alert: "Fund AUM approaching ₹1.75L Cr limit" (PPFCF)
  - Action: Check monthly; act on red alerts immediately
- **Decision Log:**
  - Records when: Manager exits, funds blocked, AUM breaches, Step-up applied, LTCG harvested
  - Helps audit plan execution and decision audit trail

---

## Task 7: Fix "Key Metrics & Health Checks" Section

**Files:**
- Modify: `C:\Users\ponna\Project\fire-os\CLAUDE.md` (in "## Key Metrics & Health Checks" section)

- [ ] **Step 1: Locate "### Dashboard KPIs" subsection**

Find the line "### Dashboard KPIs" in the Key Metrics section.

- [ ] **Step 2: Replace FI Goal Progress bullet with corrected version**

Find this bullet:
```
-   FI Goal Progress: Current corpus vs. target (target = 25× annual expenses)
```

Replace with:
```markdown
-   **FI Goal Progress**: Current corpus vs. ₹5.5Cr target
    - Target = ₹5.5Cr based on ₹122K/month expenses at age 45 (NOT ₹33Cr static)
    - Uses 3% Safe Withdrawal Rate (SWR) aligned to India-specific inflation + life expectancy
    - Timeline at 17% CAGR: FI by age 43–44
    - Dashboard displays age-to-FI estimate based on current portfolio growth rate
-   **Coorg Goal Progress**: Current corpus vs. ₹2Cr target (separate from FI)
    - Funded by dedicated ₹10K/mo SIP (start 2031) + ESOP liquidation trigger
    - Timeline: Land purchase 2034, construction 2035–2036
```

- [ ] **Step 3: Verify the corrected section matches actual FI calculation**

Check that ₹122K/month × 25 years = ~₹5.5Cr (with 3% SWR rule).

---

## Task 8: Commit Documentation Changes

**Files:**
- Modify: `C:\Users\ponna\Project\fire-os\CLAUDE.md`

- [ ] **Step 1: Stage all changes**

```bash
git add C:\Users\ponna\Project\fire-os\CLAUDE.md
```

- [ ] **Step 2: Verify changes with git diff**

```bash
git diff --cached C:\Users\ponna\Project\fire-os\CLAUDE.md
```

Expected: Shows all 6 sections added + corrected KPI metrics.

- [ ] **Step 3: Commit with descriptive message**

```bash
git commit -m "docs(CLAUDE.md): add financial plan overview, watchdog rules, roadmap, and user guide

- Add Financial Plan Overview section (dual FI + Coorg goals, allocation, timeline)
- Add Portfolio Watchdog Rules (fund manager exits, AUM triggers, annual triggers)
- Add Coorg Goal Tracker to App Features (separate ₹2Cr target)
- Add Development Roadmap (v2.3 and v3.0 planned features)
- Add User Guide (per-tab walkthrough: Dashboard, Profile, Calculators, Watchdog)
- Fix FI Goal Progress KPI (correct target: ₹5.5Cr at 3% SWR, age 45)
- Fix Coorg Goal Progress KPI (separate target: ₹2Cr by 2036)

Addresses documentation gaps identified in council review:
- Financial plan rationale now explicit (why ₹5.5Cr, why 40/30/20/10 allocation)
- Watchdog rules documented (critical triggers, fund manager exit protocol)
- Coorg goal no longer invisible (feature section + KPI)
- User guide added (which calculator to use when, tab workflows)
- Roadmap visible (v2.3 and v3.0 planned features)"
```

- [ ] **Step 4: Verify commit succeeded**

```bash
git log --oneline -1
```

Expected: Shows your commit message as most recent commit.

---

## Task 9: Verify Updated CLAUDE.md Reads Clearly

- [ ] **Step 1: Read the entire updated CLAUDE.md in a text editor**

Open the file and scroll through all sections to verify:
- Financial Plan Overview is clear and at the top
- Watchdog Rules are nested properly under App Features
- Coorg Goal Tracker bullet exists in App Features
- Development Roadmap section exists before Performance Notes
- User Guide section exists before Development Workflow
- Key Metrics section shows corrected FI target (₹5.5Cr, not ₹33Cr)

- [ ] **Step 2: Check formatting consistency**

Verify:
- All markdown headers use correct `##` / `###` / `####` hierarchy
- Bullet indentation is consistent throughout
- Code blocks (if any) are properly fenced with triple backticks
- No stray characters or encoding issues

- [ ] **Step 3: Cross-check all numbers against council analysis**

Verify these exact values appear correctly:
- FI target: ₹5.5Cr ✓
- Monthly expense: ₹122K ✓
- Coorg target: ₹2Cr ✓
- Portfolio allocation: 40/30/20/10 ✓
- SIP amounts: ₹12K/₹9K/₹6K/₹3K ✓
- PPFCF AUM limit: ₹1.75L Cr ✓
- Nippon Growth block threshold: >14 days ✓
- LTCG harvest target: ₹1.25L/year ✓
- Safe withdrawal rate: 3% ✓
