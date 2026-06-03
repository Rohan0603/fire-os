# FIRE OS v2.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 5 major features for FIRE OS v2.3 (Q3 2026): Scenario Modeler, Crash Alerts, Coorg Goal Tracker, Portfolio Rebalancing, Fund Manager Alerts.

**Architecture:** Add new calculator module (scenario-modeler.ts), extend dashboard with Coorg widget, integrate real-time Nifty monitoring via API, add watchdog automation rules to D object, create rebalancing suggestion engine. All features integrate with existing D state object and Firebase persistence.

**Tech Stack:** TypeScript, Vite, Firebase Realtime DB, Canvas (for charts), existing XIRR/SIP calculators, Nifty API (Yahoo Finance + fallback).

---

## File Structure

**New files:**
- `src/modules/calculators/scenario-modeler.ts` - CAGR/SIP/salary sliders → FI age calculation
- `src/modules/dashboard/coorg-tracker.ts` - Separate Coorg goal progress widget
- `src/modules/api/nifty-monitor.ts` - Real-time Nifty level monitoring with alerts
- `src/modules/calculators/portfolio-rebalancing.ts` - Allocation drift detection + rebalancing suggestions
- `src/modules/watchdog/fund-manager-alerts.ts` - Automate manager exit/AUM breach alerts
- `tests/scenario-modeler.test.ts` - Scenario modeler tests
- `tests/coorg-tracker.test.ts` - Coorg tracker tests
- `tests/portfolio-rebalancing.test.ts` - Rebalancing tests

**Modified files:**
- `src/state/index.ts` - Add coorgCorpus, watchdogRules fields to D object
- `src/modules/dashboard/index.ts` - Add Coorg widget render + call scenario modeler
- `src/modules/ui/index.ts` - Add rebalancing alert UI component
- `src/main.ts` - Initialize Nifty monitoring on app start

---

## Task 1: Add Coorg Goal Tracker to State

**Files:**
- Modify: `src/state/index.ts`
- Test: `tests/state.test.ts` (add test for Coorg fields)

- [ ] **Step 1: Read current D object structure**

Open `src/state/index.ts` and review existing state shape (profile, holdings, etc.)

- [ ] **Step 2: Add Coorg fields to D interface**

Add to D object interface:
```typescript
interface D {
  // ... existing fields ...
  coorgCorpus: number; // Current corpus in rupees
  coorgStartDate: string; // When Coorg SIP starts (YYYY-MM)
  coorgTarget: number; // Target: 2Cr = 20000000
  coorgMonthlyAmount: number; // Monthly SIP: 10000
}
```

- [ ] **Step 3: Initialize Coorg fields in D object**

In the D object initialization:
```typescript
const D: D = {
  // ... existing init ...
  coorgCorpus: 0,
  coorgStartDate: "2031-01", // Coorg SIP starts Jan 2031
  coorgTarget: 20000000,
  coorgMonthlyAmount: 10000,
};
```

- [ ] **Step 4: Add test for Coorg field persistence**

```typescript
test("D object persists Coorg fields to Firebase", () => {
  D.coorgCorpus = 500000;
  savePortfolioToFirebase();
  // Verify firebase write includes coorgCorpus: 500000
});
```

- [ ] **Step 5: Run test to verify**

`npm run test -- tests/state.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/state/index.ts tests/state.test.ts
git commit -m "feat(state): add Coorg goal tracking fields to D object"
```

---

## Task 2: Implement Scenario Modeler Calculator

**Files:**
- Create: `src/modules/calculators/scenario-modeler.ts`
- Test: `tests/scenario-modeler.test.ts`

- [ ] **Step 1: Write failing test for scenario modeler**

```typescript
// tests/scenario-modeler.test.ts
import { calculateFIAge } from "../src/modules/calculators/scenario-modeler";

test("calculateFIAge with 15% CAGR and ₹30K SIP gives FI at ~45.2 years", () => {
  const result = calculateFIAge({
    currentCorpus: 500000,
    monthlyAmount: 30000,
    targetCorpus: 5500000,
    cagr: 0.15,
    currentAge: 32,
  });
  // FI age should be ~45.2 years
  expect(result.fiAge).toBeCloseTo(45.2, 1);
  expect(result.monthsToFI).toBeCloseTo((45.2 - 32) * 12, 0);
});

test("calculateFIAge with 17% CAGR gives FI at ~43.5 years", () => {
  const result = calculateFIAge({
    currentCorpus: 500000,
    monthlyAmount: 30000,
    targetCorpus: 5500000,
    cagr: 0.17,
    currentAge: 32,
  });
  expect(result.fiAge).toBeCloseTo(43.5, 1);
});
```

- [ ] **Step 2: Run test to verify failure**

`npm run test -- tests/scenario-modeler.test.ts`
Expected: FAIL - "calculateFIAge is not defined"

- [ ] **Step 3: Implement scenario modeler**

Create `src/modules/calculators/scenario-modeler.ts`:

```typescript
interface ScenarioParams {
  currentCorpus: number; // Current portfolio value
  monthlyAmount: number; // Current monthly SIP amount
  targetCorpus: number; // FI target (default ₹5.5Cr)
  cagr: number; // Expected annual return (0.13 to 0.20)
  currentAge: number; // Current age
  annualStepUp?: number; // Annual SIP increase % (default 10%)
}

interface ScenarioResult {
  fiAge: number; // Age when FI reached
  monthsToFI: number; // Months from now to FI
  finalCorpus: number; // Final corpus at FI
}

export function calculateFIAge(params: ScenarioParams): ScenarioResult {
  const {
    currentCorpus,
    monthlyAmount,
    targetCorpus,
    cagr,
    currentAge,
    annualStepUp = 0.10,
  } = params;

  let corpus = currentCorpus;
  let currentMonth = 0;
  let monthlyAmountNow = monthlyAmount;

  // Simulate month-by-month growth until target is reached
  while (corpus < targetCorpus && currentMonth < 1200) {
    // Monthly return
    const monthlyReturn = corpus * (cagr / 12);
    corpus += monthlyReturn + monthlyAmountNow;

    currentMonth++;

    // Apply annual step-up (every 12 months)
    if (currentMonth % 12 === 0) {
      monthlyAmountNow *= 1 + annualStepUp;
    }
  }

  const yearsToFI = currentMonth / 12;
  const fiAge = currentAge + yearsToFI;

  return {
    fiAge: parseFloat(fiAge.toFixed(1)),
    monthsToFI: currentMonth,
    finalCorpus: parseFloat(corpus.toFixed(0)),
  };
}
```

- [ ] **Step 4: Run test to verify passing**

`npm run test -- tests/scenario-modeler.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/calculators/scenario-modeler.ts tests/scenario-modeler.test.ts
git commit -m "feat(calculators): implement scenario modeler for FI age calculation"
```

---

## Task 3: Create Coorg Goal Tracker Widget

**Files:**
- Create: `src/modules/dashboard/coorg-tracker.ts`
- Test: `tests/coorg-tracker.test.ts`
- Modify: `src/modules/dashboard/index.ts`

- [ ] **Step 1: Write test for Coorg tracker calculations**

```typescript
// tests/coorg-tracker.test.ts
import { calculateCoorgProgress } from "../src/modules/dashboard/coorg-tracker";

test("Coorg tracker shows progress vs ₹2Cr target", () => {
  const progress = calculateCoorgProgress({
    currentCorpus: 500000,
    targetCorpus: 20000000,
    currentDate: "2026-06-03",
    sipStartDate: "2031-01",
  });
  expect(progress.percentage).toBe(2.5); // 500K / 20M = 2.5%
  expect(progress.remainingAmount).toBe(19500000);
  expect(progress.yearsUntilStart).toBe(4.58); // ~4.58 years until 2031
});
```

- [ ] **Step 2: Run test to verify failure**

`npm run test -- tests/coorg-tracker.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Coorg tracker**

Create `src/modules/dashboard/coorg-tracker.ts`:

```typescript
interface CoorgTrackerParams {
  currentCorpus: number;
  targetCorpus: number; // 20000000 (₹2Cr)
  currentDate: string; // YYYY-MM-DD
  sipStartDate: string; // YYYY-MM
}

interface CoorgProgress {
  percentage: number; // % of target reached
  remainingAmount: number;
  yearsUntilStart: number;
  status: "planning" | "in_progress" | "target_reached";
}

export function calculateCoorgProgress(
  params: CoorgTrackerParams
): CoorgProgress {
  const { currentCorpus, targetCorpus, currentDate, sipStartDate } = params;
  const percentage = (currentCorpus / targetCorpus) * 100;
  const remainingAmount = targetCorpus - currentCorpus;

  const currentYear = parseInt(currentDate.split("-")[0]);
  const currentMonth = parseInt(currentDate.split("-")[1]);
  const sipYear = parseInt(sipStartDate.split("-")[0]);
  const sipMonth = parseInt(sipStartDate.split("-")[1]);

  const monthsUntilStart =
    (sipYear - currentYear) * 12 + (sipMonth - currentMonth);
  const yearsUntilStart = parseFloat((monthsUntilStart / 12).toFixed(2));

  let status: "planning" | "in_progress" | "target_reached" = "planning";
  if (currentYear > sipYear || (currentYear === sipYear && currentMonth >= sipMonth)) {
    status = "in_progress";
  }
  if (currentCorpus >= targetCorpus) {
    status = "target_reached";
  }

  return {
    percentage: parseFloat(percentage.toFixed(1)),
    remainingAmount,
    yearsUntilStart,
    status,
  };
}

export function renderCoorgWidget(D: any): string {
  const progress = calculateCoorgProgress({
    currentCorpus: D.coorgCorpus,
    targetCorpus: D.coorgTarget,
    currentDate: new Date().toISOString().split("T")[0],
    sipStartDate: D.coorgStartDate,
  });

  return `
    <div class="coorg-widget">
      <h3>Coorg Goal (₹2Cr by 2036)</h3>
      <div class="progress-bar" style="width: ${progress.percentage}%"></div>
      <p>Current: ₹${(D.coorgCorpus / 100000).toFixed(1)}L / ₹2Cr (${progress.percentage}%)</p>
      <p>${progress.status === "planning" ? `SIP starts in ${progress.yearsUntilStart} years` : "SIP in progress"}</p>
    </div>
  `;
}
```

- [ ] **Step 4: Run test to verify**

`npm run test -- tests/coorg-tracker.test.ts`
Expected: PASS

- [ ] **Step 5: Integrate into dashboard**

Modify `src/modules/dashboard/index.ts` to call `renderCoorgWidget(D)` and display in dashboard alongside FI progress.

- [ ] **Step 6: Commit**

```bash
git add src/modules/dashboard/coorg-tracker.ts tests/coorg-tracker.test.ts src/modules/dashboard/index.ts
git commit -m "feat(dashboard): add Coorg goal tracker widget with progress display"
```

---

## Task 4: Implement Real-Time Nifty Monitoring & Crash Alerts

**Files:**
- Create: `src/modules/api/nifty-monitor.ts`
- Test: `tests/nifty-monitor.test.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write test for crash alert detection**

```typescript
// tests/nifty-monitor.test.ts
import { detectCrashAlert } from "../src/modules/api/nifty-monitor";

test("detectCrashAlert identifies 10% crash", () => {
  const alert = detectCrashAlert({
    current52WeekHigh: 25000,
    currentLevel: 22500,
  });
  expect(alert.crashPercentage).toBe(10);
  expect(alert.severity).toBe("medium");
  expect(alert.shouldAlert).toBe(true);
});

test("detectCrashAlert identifies 25% crash", () => {
  const alert = detectCrashAlert({
    current52WeekHigh: 25000,
    currentLevel: 18750,
  });
  expect(alert.crashPercentage).toBe(25);
  expect(alert.severity).toBe("critical");
  expect(alert.shouldAlert).toBe(true);
});

test("detectCrashAlert ignores <10% drops", () => {
  const alert = detectCrashAlert({
    current52WeekHigh: 25000,
    currentLevel: 23500,
  });
  expect(alert.shouldAlert).toBe(false);
});
```

- [ ] **Step 2: Run test to verify failure**

`npm run test -- tests/nifty-monitor.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Nifty monitor**

Create `src/modules/api/nifty-monitor.ts`:

```typescript
interface CrashAlertParams {
  current52WeekHigh: number;
  currentLevel: number;
}

interface CrashAlert {
  crashPercentage: number;
  severity: "low" | "medium" | "high" | "critical";
  shouldAlert: boolean;
  deployAmount?: number; // Suggested Wint deployment amount
}

export function detectCrashAlert(
  params: CrashAlertParams
): CrashAlert {
  const { current52WeekHigh, currentLevel } = params;
  const crashPercentage = parseFloat(
    (((current52WeekHigh - currentLevel) / current52WeekHigh) * 100).toFixed(1)
  );

  let severity: "low" | "medium" | "high" | "critical" = "low";
  let shouldAlert = false;
  let deployAmount = 0;

  if (crashPercentage >= 10 && crashPercentage < 15) {
    severity = "medium";
    shouldAlert = true;
    deployAmount = 20000; // ₹20K
  } else if (crashPercentage >= 15 && crashPercentage < 25) {
    severity = "high";
    shouldAlert = true;
    deployAmount = 35000; // ₹35K
  } else if (crashPercentage >= 25) {
    severity = "critical";
    shouldAlert = true;
    deployAmount = 60000; // ₹60K
  }

  return {
    crashPercentage,
    severity,
    shouldAlert,
    deployAmount: shouldAlert ? deployAmount : undefined,
  };
}

export async function monitorNiftyLevel(
  callback: (alert: CrashAlert | null) => void
): Promise<void> {
  // Fetch Nifty level every 5 minutes
  setInterval(async () => {
    try {
      const niftyData = await fetch(
        "https://query1.finance.yahoo.com/v10/finance/quoteSummary/^NSEI?modules=price"
      )
        .then((r) => r.json())
        .then(
          (d) => d.quoteSummary.result[0].price
        );

      const current = niftyData.regularMarketPrice;
      const high52w = niftyData.fiftyTwoWeekHigh;

      const alert = detectCrashAlert({
        current52WeekHigh: high52w,
        currentLevel: current,
      });

      if (alert.shouldAlert) {
        callback(alert);
        // TODO: Send email alert
      }
    } catch (e) {
      console.warn("Nifty monitoring error:", e);
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}
```

- [ ] **Step 4: Run test to verify**

`npm run test -- tests/nifty-monitor.test.ts`
Expected: PASS

- [ ] **Step 5: Add crash alert display to dashboard**

In `src/modules/dashboard/index.ts`, add alert banner:
```typescript
if (crashAlert) {
  return `<div class="alert alert-${crashAlert.severity}">
    Nifty crashed ${crashAlert.crashPercentage}%! 
    Deploy ₹${crashAlert.deployAmount} via Wint Wealth (Crash Protocol)
  </div>`;
}
```

- [ ] **Step 6: Initialize monitoring on app start**

In `src/main.ts`:
```typescript
import { monitorNiftyLevel } from "./modules/api/nifty-monitor";

monitorNiftyLevel((alert) => {
  if (alert) {
    // Update dashboard with alert, possibly send email
    updateDashboard();
  }
});
```

- [ ] **Step 7: Commit**

```bash
git add src/modules/api/nifty-monitor.ts tests/nifty-monitor.test.ts src/modules/dashboard/index.ts src/main.ts
git commit -m "feat(api): implement real-time Nifty monitoring with crash alerts"
```

---

## Task 5: Implement Portfolio Rebalancing Suggestions

**Files:**
- Create: `src/modules/calculators/portfolio-rebalancing.ts`
- Test: `tests/portfolio-rebalancing.test.ts`

- [ ] **Step 1: Write test for allocation drift detection**

```typescript
// tests/portfolio-rebalancing.test.ts
import { calculateAllocationDrift } from "../src/modules/calculators/portfolio-rebalancing";

test("calculateAllocationDrift detects over-allocation in PPFCF", () => {
  const holdings = {
    PPFCF: 1500000, // ₹15L
    NipponGrowth: 600000, // ₹6L
    NipponSmallCap: 400000, // ₹4L
    Gold: 300000, // ₹3L
  };
  const totalValue = 2800000;

  const drift = calculateAllocationDrift(holdings, totalValue);
  expect(drift.current).toEqual({
    PPFCF: 53.6, // 15L / 28L = 53.6%
    NipponGrowth: 21.4,
    NipponSmallCap: 14.3,
    Gold: 10.7,
  });
  expect(drift.target).toEqual({
    PPFCF: 40,
    NipponGrowth: 30,
    NipponSmallCap: 20,
    Gold: 10,
  });
  expect(drift.driftAmount.PPFCF).toBe(13.6); // 53.6 - 40
  expect(drift.recommendations).toContain(
    "Reduce PPFCF by ₹3.8L (13.6% drift)"
  );
});
```

- [ ] **Step 2: Run test to verify failure**

`npm run test -- tests/portfolio-rebalancing.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement rebalancing logic**

Create `src/modules/calculators/portfolio-rebalancing.ts`:

```typescript
interface Holdings {
  [fundName: string]: number; // Value in rupees
}

interface AllocationDrift {
  current: { [fundName: string]: number }; // Current %
  target: { [fundName: string]: number }; // Target %
  driftAmount: { [fundName: string]: number }; // Difference in %
  recommendations: string[]; // Rebalancing actions
}

const TARGET_ALLOCATION = {
  PPFCF: 40,
  NipponGrowth: 30,
  NipponSmallCap: 20,
  Gold: 10,
};

export function calculateAllocationDrift(
  holdings: Holdings,
  totalValue: number
): AllocationDrift {
  const current: { [key: string]: number } = {};
  const driftAmount: { [key: string]: number } = {};
  const recommendations: string[] = [];

  // Calculate current allocation %
  for (const [fund, value] of Object.entries(holdings)) {
    current[fund] = parseFloat(((value / totalValue) * 100).toFixed(1));
  }

  // Calculate drift from target
  for (const [fund, targetPct] of Object.entries(TARGET_ALLOCATION)) {
    const currentPct = current[fund] || 0;
    driftAmount[fund] = currentPct - targetPct;

    // If drift > 5%, recommend rebalancing
    if (Math.abs(driftAmount[fund]) > 5) {
      const action = driftAmount[fund] > 0 ? "Reduce" : "Increase";
      const amount = Math.abs((driftAmount[fund] / 100) * totalValue);
      recommendations.push(
        `${action} ${fund} by ₹${(amount / 100000).toFixed(1)}L (${Math.abs(driftAmount[fund]).toFixed(1)}% drift)`
      );
    }
  }

  return {
    current,
    target: TARGET_ALLOCATION,
    driftAmount,
    recommendations,
  };
}
```

- [ ] **Step 4: Run test to verify**

`npm run test -- tests/portfolio-rebalancing.test.ts`
Expected: PASS

- [ ] **Step 5: Add rebalancing alert to dashboard**

In `src/modules/dashboard/index.ts`:
```typescript
import { calculateAllocationDrift } from "../calculators/portfolio-rebalancing";

const drift = calculateAllocationDrift(D.holdings, D.totalNetWorth);
if (drift.recommendations.length > 0) {
  renderRebalancingWidget(drift.recommendations);
}
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/calculators/portfolio-rebalancing.ts tests/portfolio-rebalancing.test.ts src/modules/dashboard/index.ts
git commit -m "feat(calculators): implement portfolio rebalancing drift detection"
```

---

## Task 6: Automate Fund Manager Alert Rules

**Files:**
- Create: `src/modules/watchdog/fund-manager-alerts.ts`
- Test: `tests/fund-manager-alerts.test.ts`
- Modify: `src/state/index.ts`

- [ ] **Step 1: Add watchdog rules to D object**

Modify `src/state/index.ts`:
```typescript
interface D {
  // ... existing ...
  watchdogRules: {
    ppfcfAumLimit: number; // ₹1.75L Cr
    nipponGrowthBlockDays: number; // >14 days = alert
    nipponSmallCapBlockDays: number; // >60 days = alert
    managerExits: {
      PPFCF: string; // Manager name
      NipponSmallCap: string;
    };
  };
}
```

- [ ] **Step 2: Write test for watchdog alert logic**

```typescript
// tests/fund-manager-alerts.test.ts
import { checkWatchdogRules } from "../src/modules/watchdog/fund-manager-alerts";

test("checkWatchdogRules detects AUM breach", () => {
  const alerts = checkWatchdogRules({
    ppfcfAum: 180000000000, // ₹1.8L Cr
    ppfcfAumLimit: 175000000000, // ₹1.75L Cr
    nipponGrowthBlocked: false,
    nipponSmallCapBlocked: false,
  });
  expect(alerts).toContain("PPFCF AUM exceeded ₹1.75L Cr limit");
});

test("checkWatchdogRules detects fund block >14 days", () => {
  const alerts = checkWatchdogRules({
    ppfcfAum: 150000000000,
    ppfcfAumLimit: 175000000000,
    nipponGrowthBlocked: 15, // 15 days
    nipponSmallCapBlocked: false,
  });
  expect(alerts).toContain("Nippon Growth blocked >14 days");
});
```

- [ ] **Step 3: Run test to verify failure**

`npm run test -- tests/fund-manager-alerts.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement watchdog logic**

Create `src/modules/watchdog/fund-manager-alerts.ts`:

```typescript
interface WatchdogCheckParams {
  ppfcfAum: number; // Current AUM in rupees
  ppfcfAumLimit: number; // Limit: ₹1.75L Cr
  nipponGrowthBlocked: number | boolean; // Days blocked (0 = not blocked)
  nipponSmallCapBlocked: number | boolean;
}

export function checkWatchdogRules(params: WatchdogCheckParams): string[] {
  const alerts: string[] = [];

  // Check AUM breach
  if (params.ppfcfAum > params.ppfcfAumLimit) {
    alerts.push(
      `PPFCF AUM exceeded ₹1.75L Cr limit (${(params.ppfcfAum / 10000000000).toFixed(1)}L Cr)`
    );
    alerts.push("Recommendation: Plan B = Mirae Asset Flexi Cap Direct");
  }

  // Check fund blocks
  if (
    typeof params.nipponGrowthBlocked === "number" &&
    params.nipponGrowthBlocked > 14
  ) {
    alerts.push(`Nippon Growth blocked ${params.nipponGrowthBlocked} days (>14 day threshold)`);
    alerts.push("Recommendation: Plan B = Motilal Oswal Midcap Direct");
  }

  if (
    typeof params.nipponSmallCapBlocked === "number" &&
    params.nipponSmallCapBlocked > 60
  ) {
    alerts.push(`Nippon Small Cap blocked ${params.nipponSmallCapBlocked} days (>60 day threshold)`);
    alerts.push("Recommendation: Temporary = SBI/Bandhan Small Cap Direct");
  }

  return alerts;
}

export async function monitorWatchdogRules(D: any): Promise<void> {
  // Check rules every day
  setInterval(() => {
    const alerts = checkWatchdogRules({
      ppfcfAum: D.ppfcfAum || 150000000000, // Fetch from API
      ppfcfAumLimit: D.watchdogRules.ppfcfAumLimit,
      nipponGrowthBlocked: D.nipponGrowthBlockedDays || 0,
      nipponSmallCapBlocked: D.nipponSmallCapBlockedDays || 0,
    });

    if (alerts.length > 0) {
      // Update dashboard, send email
      console.warn("Watchdog alerts:", alerts);
      updateDashboardAlerts(alerts);
    }
  }, 24 * 60 * 60 * 1000); // Daily
}
```

- [ ] **Step 5: Run test to verify**

`npm run test -- tests/fund-manager-alerts.test.ts`
Expected: PASS

- [ ] **Step 6: Add watchdog alerts to dashboard**

In `src/modules/dashboard/index.ts`:
```typescript
import { monitorWatchdogRules } from "../watchdog/fund-manager-alerts";

monitorWatchdogRules(D);
```

- [ ] **Step 7: Commit**

```bash
git add src/modules/watchdog/fund-manager-alerts.ts tests/fund-manager-alerts.test.ts src/state/index.ts src/modules/dashboard/index.ts
git commit -m "feat(watchdog): automate fund manager exit and AUM breach alerts"
```

---

## Task 7: Integrate All v2.3 Features & Test End-to-End

**Files:**
- Modify: `src/modules/dashboard/index.ts` (main integration point)
- Test: `tests/e2e.v2.3.test.ts`

- [ ] **Step 1: Write E2E test for full v2.3 feature set**

```typescript
// tests/e2e.v2.3.test.ts
import { renderDashboard } from "../src/modules/dashboard";

test("v2.3 Dashboard renders all new features", () => {
  const html = renderDashboard(mockD);
  
  // Coorg tracker
  expect(html).toContain("Coorg Goal (₹2Cr by 2036)");
  
  // Scenario modeler widget
  expect(html).toContain("FI Age Calculator");
  
  // Crash alerts (if any)
  // Rebalancing suggestions
  expect(html).toContain("Portfolio Allocation");
  
  // Watchdog alerts
  expect(html).toContain("Watchdog");
});
```

- [ ] **Step 2: Run E2E test**

`npm run test -- tests/e2e.v2.3.test.ts`
Expected: PASS

- [ ] **Step 3: Manual smoke test in browser**

```bash
npm run dev
```

- Open http://localhost:5173
- Verify:
  - Dashboard shows Coorg tracker widget
  - Scenario Modeler sliders appear
  - Crash alert appears if market is down >10%
  - Rebalancing suggestions visible
  - Watchdog alerts panel shows (if any)

- [ ] **Step 4: Test data persistence**

- Update Coorg corpus to ₹10L
- Reload page
- Verify Coorg corpus persists (Firebase + localStorage)

- [ ] **Step 5: Commit final integration**

```bash
git add tests/e2e.v2.3.test.ts src/modules/dashboard/index.ts
git commit -m "feat(v2.3): integrate all features and verify E2E"
```

---

## Task 8: Create Release Notes & Update Docs

**Files:**
- Create: `CHANGELOG.md` (v2.3 entry)
- Modify: `CLAUDE.md` (update feature list with v2.3 features marked as LIVE)

- [ ] **Step 1: Write v2.3 changelog entry**

Append to `CHANGELOG.md`:
```markdown
## [2.3.0] - 2026-06-15

### Added
- Scenario Modeler: CAGR/SIP/salary sliders → real-time FI age calculation
- Crash Alerts: Real-time Nifty monitoring, alerts at 10%/15%/25% market falls
- Coorg Goal Tracker: Separate corpus widget tracking ₹2Cr target by 2036
- Portfolio Rebalancing Tool: Allocation drift detection vs 40/30/20/10, rebalancing suggestions
- Fund Manager Alert Integration: Automated watchdog rules (manager exits → pause, AUM breach → alert)

### Technical
- Added scenario-modeler, coorg-tracker, nifty-monitor, portfolio-rebalancing, fund-manager-alerts modules
- Extended D object with coorgCorpus, coorgTarget, watchdogRules fields
- Real-time Nifty monitoring via Yahoo Finance API
- Daily watchdog checks for AUM/block status
```

- [ ] **Step 2: Update CLAUDE.md features list**

Mark v2.3 features as ✅ LIVE in CLAUDE.md section.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md CLAUDE.md
git commit -m "docs: add v2.3 release notes and feature updates"
```

---

## Summary

**v2.3 (Q3 2026) Complete:**
- ✅ Scenario Modeler (5 features)
- ✅ Crash Alerts (real-time Nifty monitoring)
- ✅ Coorg Goal Tracker (separate ₹2Cr target)
- ✅ Portfolio Rebalancing (drift detection + suggestions)
- ✅ Fund Manager Alerts (automated watchdog rules)

**Total commits:** 8
**New modules:** 5
**New tests:** 5
**Code coverage:** All new functions tested via unit + E2E

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-03-fire-os-v2-3-implementation.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session, batch execution with checkpoints

**Which approach?**

---

*After v2.3 completes, v3.0 plan (SWP Automation, Tax Engine, Advisor Integration, Expense Tracking) will follow.*
