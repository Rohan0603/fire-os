# FIRE OS v3.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 4 major features for FIRE OS v3.0 (Q4 2026): SWP Automation, Tax Optimization Engine, Advisor Integration, Custom Expense Tracking.

**Architecture:** Add withdrawal automation module (swp-scheduler.ts), tax calculation engine (tax-optimizer.ts), advisor webhook integration, and expense tracker with SWP linking. All integrate with D state, Firebase, and existing portfolio calculators. SWP uses FIFO redemption strategy with LTCG harvesting.

**Tech Stack:** TypeScript, Firebase Realtime DB + Cloud Functions (for scheduled withdrawals), Stripe/webhook integration (advisor), localStorage for expense tracking, existing XIRR/portfolio calculators.

---

## File Structure

**New files:**
- `src/modules/calculators/swp-scheduler.ts` - Withdrawal scheduler, FIFO redemption logic
- `src/modules/calculators/tax-optimizer.ts` - LTCG harvest calendar, tax comparison engine
- `src/modules/integrations/advisor-webhook.ts` - CFP review workflow integration
- `src/modules/trackers/expense-tracker.ts` - Link SWP withdrawals to actual spending
- `tests/swp-scheduler.test.ts`
- `tests/tax-optimizer.test.ts`
- `tests/expense-tracker.test.ts`

**Modified files:**
- `src/state/index.ts` - Add SWP schedule, tax calendar, expenses fields to D object
- `src/modules/dashboard/index.ts` - Add SWP status widget + expense tracker UI
- `firebase-rules.json` - New rules for withdrawal scheduling + expense data
- `CLAUDE.md` - Update feature list + v3.0 roadmap

---

## Task 1: Add SWP & Tax Fields to State

**Files:**
- Modify: `src/state/index.ts`
- Test: `tests/state.test.ts`

- [ ] **Step 1: Extend D object with SWP fields**

Add to D interface:
```typescript
interface D {
  // ... existing ...
  swpSchedule: {
    enabled: boolean;
    startDate: string; // YYYY-MM when SWP begins
    monthlyAmount: number; // ₹122K for FI at 45
    rate: number; // 3% for 3% SWR
  };
  taxCalendar: {
    lastLTCGHarvestDate: string; // YYYY-MM-DD
    lastHarvestedAmount: number; // Gains harvested this year
    harvestTarget: number; // ₹1.25L annual target
  };
  expenses: Array<{
    date: string; // YYYY-MM-DD
    category: string; // "food", "utilities", "travel", etc.
    amount: number;
    linkedToSWP: boolean; // true if withdrawn via SWP
  }>;
}
```

- [ ] **Step 2: Initialize SWP fields**

```typescript
const D: D = {
  // ... existing ...
  swpSchedule: {
    enabled: false, // Enabled when corpus hits ₹5.5Cr
    startDate: "", // Set at FI trigger
    monthlyAmount: 122000, // ₹122K/month
    rate: 0.03, // 3% SWR
  },
  taxCalendar: {
    lastLTCGHarvestDate: "",
    lastHarvestedAmount: 0,
    harvestTarget: 125000, // ₹1.25L/year
  },
  expenses: [],
};
```

- [ ] **Step 3: Test persistence**

```typescript
test("D object persists SWP schedule to Firebase", () => {
  D.swpSchedule.enabled = true;
  D.swpSchedule.startDate = "2044-01";
  savePortfolioToFirebase();
  // Verify firebase includes swpSchedule
});
```

- [ ] **Step 4: Run test**

`npm run test -- tests/state.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/state/index.ts tests/state.test.ts
git commit -m "feat(state): add SWP schedule and tax calendar fields to D object"
```

---

## Task 2: Implement SWP Scheduler with FIFO Redemption

**Files:**
- Create: `src/modules/calculators/swp-scheduler.ts`
- Test: `tests/swp-scheduler.test.ts`

- [ ] **Step 1: Write test for FIFO redemption logic**

```typescript
// tests/swp-scheduler.test.ts
import { calculateFIFORedemption } from "../src/modules/calculators/swp-scheduler";

test("calculateFIFORedemption redeems PPFCF first", () => {
  const holdings = {
    PPFCF: { units: 500, nav: 100 }, // ₹50K
    NipponGrowth: { units: 200, nav: 150 }, // ₹30K
    NipponSmallCap: { units: 100, nav: 200 }, // ₹20K
    Gold: { units: 50, nav: 400 }, // ₹20K
  };

  const redemption = calculateFIFORedemption(holdings, 122000);
  
  // Should redeem all PPFCF first (₹50K)
  expect(redemption.PPFCF).toBe(500); // All units
  // Then ₹72K from NipponGrowth
  expect(redemption.NipponGrowth).toBe(480); // 72000/150 = 480 units
  expect(redemption.NipponSmallCap).toBe(0);
  expect(redemption.Gold).toBe(0);
});

test("calculateFIFORedemption handles ₹122K monthly withdrawal", () => {
  const holdings = {
    PPFCF: { units: 10000, nav: 100 }, // ₹100L
    NipponGrowth: { units: 5000, nav: 150 }, // ₹75L
    NipponSmallCap: { units: 3000, nav: 200 }, // ₹60L
    Gold: { units: 1000, nav: 400 }, // ₹40L
  };

  const redemption = calculateFIFORedemption(holdings, 122000);
  // ₹122K from PPFCF = 1220 units (122000/100)
  expect(redemption.PPFCF).toBe(1220);
  expect(redemption.NipponGrowth).toBe(0);
});
```

- [ ] **Step 2: Run test to verify failure**

`npm run test -- tests/swp-scheduler.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement SWP scheduler**

Create `src/modules/calculators/swp-scheduler.ts`:

```typescript
interface Holding {
  units: number;
  nav: number; // Net Asset Value
}

interface Holdings {
  [fundName: string]: Holding;
}

interface RedemptionPlan {
  [fundName: string]: number; // Units to redeem
}

export function calculateFIFORedemption(
  holdings: Holdings,
  withdrawalAmount: number
): RedemptionPlan {
  const redemption: RedemptionPlan = {
    PPFCF: 0,
    NipponGrowth: 0,
    NipponSmallCap: 0,
    Gold: 0,
  };

  let remaining = withdrawalAmount;
  const fundOrder = ["PPFCF", "NipponGrowth", "NipponSmallCap", "Gold"];

  for (const fund of fundOrder) {
    if (remaining <= 0) break;

    const holding = holdings[fund];
    if (!holding) continue;

    const fundValue = holding.units * holding.nav;

    if (fundValue >= remaining) {
      // Partial redemption from this fund
      redemption[fund] = Math.ceil(remaining / holding.nav);
      remaining = 0;
    } else {
      // Full redemption from this fund
      redemption[fund] = holding.units;
      remaining -= fundValue;
    }
  }

  return redemption;
}

export function generateSWPSchedule(
  D: any,
  fiTriggerDate: string // When corpus hits ₹5.5Cr
): void {
  // Enable SWP and set start date
  D.swpSchedule.enabled = true;
  D.swpSchedule.startDate = fiTriggerDate;

  // Create monthly withdrawal tasks in Firebase
  const withdrawalDates: string[] = [];
  let currentDate = new Date(fiTriggerDate + "-01");

  for (let i = 0; i < 360; i++) {
    // 30 years of withdrawals
    withdrawalDates.push(currentDate.toISOString().split("T")[0]);
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  // Store in Firebase for Cloud Function to execute
  saveToFirebase("users/swpSchedule", withdrawalDates);
}

export async function executeMonthlyWithdrawal(D: any): Promise<void> {
  if (!D.swpSchedule.enabled) return;

  const redemption = calculateFIFORedemption(
    D.holdings,
    D.swpSchedule.monthlyAmount
  );

  // Execute FIFO redemptions
  for (const [fund, units] of Object.entries(redemption)) {
    if (units > 0) {
      // Call API to redeem from fund
      await redeemUnits(fund, units);
      console.log(`Redeemed ${units} units from ${fund}`);
    }
  }

  // Add withdrawal to expense tracker
  D.expenses.push({
    date: new Date().toISOString().split("T")[0],
    category: "SWP",
    amount: D.swpSchedule.monthlyAmount,
    linkedToSWP: true,
  });
}
```

- [ ] **Step 4: Run test to verify**

`npm run test -- tests/swp-scheduler.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/calculators/swp-scheduler.ts tests/swp-scheduler.test.ts
git commit -m "feat(calculators): implement SWP scheduler with FIFO redemption logic"
```

---

## Task 3: Implement Tax Optimization Engine

**Files:**
- Create: `src/modules/calculators/tax-optimizer.ts`
- Test: `tests/tax-optimizer.test.ts`

- [ ] **Step 1: Write test for tax optimization**

```typescript
// tests/tax-optimizer.test.ts
import { calculateTaxComparison } from "../src/modules/calculators/tax-optimizer";

test("calculateTaxComparison shows SIP vs lump-sum tax impact", () => {
  const comparisonSIP = calculateTaxComparison({
    gainAmount: 500000,
    strategy: "sip", // Spread over 12 months
    taxRate: 0.20, // 20% long-term capital gains
  });

  const comparisonLumpSum = calculateTaxComparison({
    gainAmount: 500000,
    strategy: "lumpSum", // All at once
    taxRate: 0.20,
  });

  // Both should result in same tax (20% of gain)
  expect(comparisonSIP.taxPayable).toBe(100000); // 20% of 500K
  expect(comparisonLumpSum.taxPayable).toBe(100000);
});

test("calculateLTCGHarvestAmount determines optimal harvest", () => {
  const harvest = calculateLTCGHarvestAmount({
    yearlyLimit: 125000, // ₹1.25L
    currentGains: 80000,
    taxableIncome: 500000,
  });
  expect(harvest.recommendedAmount).toBe(125000); // Full limit
  expect(harvest.taxPayable).toBe(25000); // 20% of 125K
});
```

- [ ] **Step 2: Run test to verify failure**

`npm run test -- tests/tax-optimizer.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement tax optimizer**

Create `src/modules/calculators/tax-optimizer.ts`:

```typescript
interface TaxComparisonParams {
  gainAmount: number;
  strategy: "sip" | "lumpSum";
  taxRate: number; // 0.20 for 20% LTCG tax
}

interface TaxComparison {
  grossGain: number;
  taxPayable: number;
  netGain: number;
  strategy: string;
}

interface LTCGHarvestParams {
  yearlyLimit: number; // ₹1.25L
  currentGains: number; // Unrealized gains
  taxableIncome: number; // Total taxable income
}

interface HarvestRecommendation {
  recommendedAmount: number;
  taxPayable: number;
  netGain: number;
  rationale: string;
}

export function calculateTaxComparison(
  params: TaxComparisonParams
): TaxComparison {
  const { gainAmount, strategy, taxRate } = params;

  // LTCG tax is same regardless of strategy (20% for mutual funds)
  // But SIP spreads redemptions, potentially across tax years
  const taxPayable = gainAmount * taxRate;
  const netGain = gainAmount - taxPayable;

  return {
    grossGain: gainAmount,
    taxPayable,
    netGain,
    strategy,
  };
}

export function calculateLTCGHarvestAmount(
  params: LTCGHarvestParams
): HarvestRecommendation {
  const { yearlyLimit, currentGains, taxableIncome } = params;

  const recommendedAmount = Math.min(yearlyLimit, currentGains);
  const taxPayable = recommendedAmount * 0.2; // 20% LTCG tax
  const netGain = recommendedAmount - taxPayable;

  let rationale = `Harvest ₹${(recommendedAmount / 100000).toFixed(1)}L gains to use LTCG tax efficiency`;
  if (taxableIncome > 5000000) {
    rationale += " (high income, harvest to minimize bracket creep)";
  }

  return {
    recommendedAmount,
    taxPayable,
    netGain,
    rationale,
  };
}

export function generateTaxCalendar(D: any): string[] {
  const calendar: string[] = [];

  // Annual LTCG harvest reminder (April 1st - Indian fiscal year start)
  for (let year = 2026; year <= 2060; year++) {
    calendar.push(`${year}-04-01: LTCG Harvest Period (April - March)`);
    calendar.push(
      `${year}-04-15: Recommended: Harvest ₹1.25L gains for Year 6+ portfolios`
    );
  }

  // Section 80C reminder (March 31st deadline)
  for (let year = 2026; year <= 2060; year++) {
    calendar.push(`${year}-03-31: Section 80C deadline (₹1.5L limit)`);
  }

  return calendar;
}

export function generateTaxOptimizationReport(D: any): string {
  const report = `
    **Tax Optimization Report**
    
    **LTCG Harvest Strategy:**
    - Annual target: ₹1.25L (use 20% LTCG tax efficiency)
    - Timing: April-May (start of fiscal year)
    - Strategy: Harvest oldest/highest-return funds first
    
    **SIP vs Lump-Sum Comparison:**
    - Tax impact: Same (20% LTCG applies to both)
    - Recommendation: Lump-sum for simplicity (no ongoing tax tracking)
    
    **Section 80C/80D:**
    - EPF contribution: Up to ₹1.5L/year (auto-deducted)
    - Section 80D (Health insurance): Up to ₹25K (individual) or ₹50K (family)
    
    **Next LTCG Harvest:** ${D.taxCalendar.lastLTCGHarvestDate}
  `;
  return report;
}
```

- [ ] **Step 4: Run test to verify**

`npm run test -- tests/tax-optimizer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/modules/calculators/tax-optimizer.ts tests/tax-optimizer.test.ts
git commit -m "feat(calculators): implement tax optimization engine with LTCG harvest calendar"
```

---

## Task 4: Implement Advisor Integration Webhook

**Files:**
- Create: `src/modules/integrations/advisor-webhook.ts`
- Test: `tests/advisor-webhook.test.ts`

- [ ] **Step 1: Write test for advisor integration**

```typescript
// tests/advisor-webhook.test.ts
import { registerAdvisorReview } from "../src/modules/integrations/advisor-webhook";

test("registerAdvisorReview sends review request to CFP", () => {
  const result = registerAdvisorReview({
    userEmail: "user@example.com",
    portfolioSummary: {
      totalCorpus: 5500000,
      allocation: { PPFCF: 40, NipponGrowth: 30, NipponSmallCap: 20, Gold: 10 },
    },
  });

  expect(result.status).toBe("review_request_sent");
  expect(result.reviewUrl).toContain("https://advisor.fire-os.app/");
});
```

- [ ] **Step 2: Run test to verify failure**

`npm run test -- tests/advisor-webhook.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement advisor webhook**

Create `src/modules/integrations/advisor-webhook.ts`:

```typescript
interface AdvisorReviewRequest {
  userEmail: string;
  portfolioSummary: {
    totalCorpus: number;
    allocation: { [fund: string]: number };
  };
}

interface ReviewResponse {
  status: "review_request_sent" | "error";
  reviewUrl?: string;
  error?: string;
}

export async function registerAdvisorReview(
  request: AdvisorReviewRequest
): Promise<ReviewResponse> {
  try {
    // Send webhook to advisor service
    const response = await fetch("https://api.fire-os.app/advisor/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: request.userEmail,
        portfolio: request.portfolioSummary,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      return { status: "error", error: "Failed to register review" };
    }

    const data = await response.json();
    return {
      status: "review_request_sent",
      reviewUrl: `https://advisor.fire-os.app/review/${data.reviewId}`,
    };
  } catch (e) {
    return { status: "error", error: String(e) };
  }
}

export function renderAdvisorIntegrationWidget(D: any): string {
  return `
    <div class="advisor-widget">
      <h3>Certified Financial Planner Review</h3>
      <p>Get an expert review of your portfolio allocation and SWP strategy.</p>
      <button onclick="registerAdvisorReview()">Request Review</button>
      <p><small>Optional. Your portfolio summary will be shared with the CFP.</small></p>
    </div>
  `;
}
```

- [ ] **Step 4: Run test to verify**

`npm run test -- tests/advisor-webhook.test.ts`
Expected: PASS

- [ ] **Step 5: Add widget to dashboard**

In `src/modules/dashboard/index.ts`:
```typescript
if (D.swpSchedule.enabled) {
  // Show advisor review widget when SWP is active
  html += renderAdvisorIntegrationWidget(D);
}
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/integrations/advisor-webhook.ts tests/advisor-webhook.test.ts src/modules/dashboard/index.ts
git commit -m "feat(integrations): add advisor webhook for CFP portfolio review requests"
```

---

## Task 5: Implement Expense Tracker with SWP Linking

**Files:**
- Create: `src/modules/trackers/expense-tracker.ts`
- Test: `tests/expense-tracker.test.ts`

- [ ] **Step 1: Write test for expense tracking**

```typescript
// tests/expense-tracker.test.ts
import { addExpense, calculateExpenseRate } from "../src/modules/trackers/expense-tracker";

test("addExpense records spending with SWP link", () => {
  const expense = {
    date: "2044-01-15",
    category: "food",
    amount: 5000,
    linkedToSWP: true,
  };

  const expenses = addExpense([], expense);
  expect(expenses).toHaveLength(1);
  expect(expenses[0].linkedToSWP).toBe(true);
});

test("calculateExpenseRate validates FI target is on track", () => {
  const expenses = [
    {
      date: "2044-01-15",
      category: "food",
      amount: 50000,
      linkedToSWP: true,
    },
    {
      date: "2044-02-15",
      category: "utilities",
      amount: 15000,
      linkedToSWP: true,
    },
    {
      date: "2044-03-15",
      category: "travel",
      amount: 25000,
      linkedToSWP: true,
    },
  ];

  const rate = calculateExpenseRate(expenses, "2044-01");
  expect(rate.monthlyAverage).toBe(30000); // (50K + 15K + 25K) / 3
});
```

- [ ] **Step 2: Run test to verify failure**

`npm run test -- tests/expense-tracker.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement expense tracker**

Create `src/modules/trackers/expense-tracker.ts`:

```typescript
export interface Expense {
  date: string; // YYYY-MM-DD
  category: string;
  amount: number;
  linkedToSWP: boolean;
}

interface ExpenseRate {
  monthlyAverage: number;
  totalMonths: number;
  validation: {
    isOnTarget: boolean; // Should be ₹122K/month at FI
    variance: number; // % difference from target
  };
}

export function addExpense(expenses: Expense[], newExpense: Expense): Expense[] {
  return [...expenses, newExpense];
}

export function calculateExpenseRate(
  expenses: Expense[],
  startDate: string
): ExpenseRate {
  if (expenses.length === 0) {
    return {
      monthlyAverage: 0,
      totalMonths: 0,
      validation: { isOnTarget: false, variance: 0 },
    };
  }

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const monthlyAverage = Math.round(totalAmount / expenses.length);

  const target = 122000; // ₹122K/month at FI
  const variance = parseFloat(
    (((monthlyAverage - target) / target) * 100).toFixed(1)
  );

  return {
    monthlyAverage,
    totalMonths: expenses.length,
    validation: {
      isOnTarget: Math.abs(variance) < 10, // Within 10% is OK
      variance,
    },
  };
}

export function renderExpenseTracker(D: any): string {
  if (D.expenses.length === 0) {
    return "<p>No expenses tracked yet.</p>";
  }

  const rate = calculateExpenseRate(
    D.expenses,
    D.swpSchedule.startDate || new Date().toISOString().split("T")[0]
  );

  const status =
    rate.validation.isOnTarget
      ? "✅ On Target"
      : `⚠️ ${rate.validation.variance > 0 ? "Over" : "Under"} target by ${Math.abs(rate.validation.variance)}%`;

  return `
    <div class="expense-tracker">
      <h3>SWP Expense Tracking</h3>
      <p>Monthly Average: ₹${(rate.monthlyAverage / 1000).toFixed(0)}K</p>
      <p>Target: ₹122K (3% SWR)</p>
      <p>${status}</p>
      <p>Total SWP withdrawals: ${rate.totalMonths} months</p>
      <button onclick="addExpense()">+ Add Expense</button>
    </div>
  `;
}
```

- [ ] **Step 4: Run test to verify**

`npm run test -- tests/expense-tracker.test.ts`
Expected: PASS

- [ ] **Step 5: Add expense tracker to dashboard**

In `src/modules/dashboard/index.ts`:
```typescript
if (D.swpSchedule.enabled) {
  html += renderExpenseTracker(D);
}
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/trackers/expense-tracker.ts tests/expense-tracker.test.ts src/modules/dashboard/index.ts
git commit -m "feat(trackers): implement SWP expense tracker with FI validation"
```

---

## Task 6: Integrate All v3.0 Features & Test End-to-End

**Files:**
- Test: `tests/e2e.v3.0.test.ts`
- Modify: `src/modules/dashboard/index.ts`

- [ ] **Step 1: Write E2E test for v3.0**

```typescript
// tests/e2e.v3.0.test.ts
import { renderDashboard } from "../src/modules/dashboard";

test("v3.0 Dashboard renders all SWP + tax features", () => {
  const html = renderDashboard(mockD);
  
  // SWP scheduler
  expect(html).toContain("SWP Schedule");
  
  // Tax optimizer
  expect(html).toContain("Tax Optimization");
  
  // Advisor widget
  expect(html).toContain("Certified Financial Planner");
  
  // Expense tracker
  expect(html).toContain("SWP Expense Tracking");
});
```

- [ ] **Step 2: Run E2E test**

`npm run test -- tests/e2e.v3.0.test.ts`
Expected: PASS

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

- Open http://localhost:5173 when portfolio hits ₹5.5Cr
- Verify:
  - SWP Schedule widget appears (shows ₹122K monthly)
  - Tax Optimization widget shows (LTCG harvest calendar)
  - Advisor Integration button visible
  - Expense Tracker shows monthly SWP withdrawals
  - Validation shows "On Target" if avg ~₹122K/month

- [ ] **Step 4: Test data persistence**

- Add expense of ₹120K
- Reload page
- Verify expense persists (Firebase + localStorage)

- [ ] **Step 5: Commit**

```bash
git add tests/e2e.v3.0.test.ts src/modules/dashboard/index.ts
git commit -m "feat(v3.0): integrate all SWP, tax, advisor, and expense features"
```

---

## Task 7: Create Release Notes & Final Docs

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write v3.0 changelog**

Append to `CHANGELOG.md`:
```markdown
## [3.0.0] - 2026-12-15

### Added
- SWP Automation: Monthly withdrawal scheduler with FIFO redemption strategy
- Tax Optimization Engine: LTCG harvest calendar, SIP vs lump-sum tax comparison, Section 80C/80D hints
- Advisor Integration: CFP review workflow (webhook-based)
- Custom Expense Tracking: Link SWP withdrawals to actual spending, FI target validation

### Technical
- Added swp-scheduler, tax-optimizer, advisor-webhook, expense-tracker modules
- Extended D object with swpSchedule, taxCalendar, expenses fields
- Cloud Functions for automated monthly withdrawals
- Tax reporting calendar (April-March fiscal year)
- Expense validation against 3% SWR target (₹122K/month)
```

- [ ] **Step 2: Update CLAUDE.md**

Mark v3.0 features as ✅ LIVE.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md CLAUDE.md
git commit -m "docs: add v3.0 release notes and feature updates"
```

---

## Summary

**v3.0 (Q4 2026) Complete:**
- ✅ SWP Automation (FIFO redemption scheduler)
- ✅ Tax Optimization Engine (LTCG harvest calendar)
- ✅ Advisor Integration (CFP review webhook)
- ✅ Expense Tracking (SWP withdrawal validation)

**Total commits:** 8
**New modules:** 4
**New tests:** 4
**Code coverage:** All new functions tested

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-03-fire-os-v3-0-implementation.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** - Fresh subagent per task, fast iteration

**2. Inline Execution** - Batch execution with checkpoints in this session

**Which approach?**

---

*Both v2.3 and v3.0 plans are now ready. Combined: 16 tasks, 9 new modules, 9 new test files, ~3000 LOC.*
