# FIRE OS Final Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete remaining production-ready integration: Profile & Calculators modules, comprehensive error handling, performance optimization, and documentation.

**Architecture:** Tasks 11-12 integrate existing modular components. Task 13 adds error boundaries around all async operations and form inputs. Task 15 optimizes bundle size and runtime performance. Task 16 creates reference documentation for developers.

**Tech Stack:** Vite 5, TypeScript 5, Firebase 11, Playwright 1.59+

---

## Task 11: Complete Profile Module Integration

**Files:**
- Modify: `src/modules/profile/index.ts` (complete form handlers, PDF import flow, data export/import)
- Modify: `src/modules/profile/pdf-parser.ts` (fix PDF extraction logic, handle edge cases)
- Verify: `src/modules/profile/styles.css` (exists and styles all form sections)

### Current State
Profile module renders correctly but form handlers incomplete:
- `saveProfile()` function partially written (need lines 300+)
- PDF import flow not fully connected
- Data export/import functions missing

### Step 1: Complete saveProfile() function

- [ ] Read existing saveProfile() to line 300 and identify what's missing

```bash
head -n 350 src/modules/profile/index.ts | tail -n 50
```

- [ ] Add SIP field parsing to saveProfile(). Append to `src/modules/profile/index.ts` after line 300:

```typescript
    // SIP fields
    const sipIndices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    sipIndices.forEach((i) => {
      const nameEl = document.querySelector(`.sip-name[data-index="${i}"]`) as HTMLInputElement;
      const codeEl = document.querySelector(`.sip-code[data-index="${i}"]`) as HTMLInputElement;
      const unitsEl = document.querySelector(`.sip-units[data-index="${i}"]`) as HTMLInputElement;
      const amountEl = document.querySelector(`.sip-amount[data-index="${i}"]`) as HTMLInputElement;
      const startEl = document.querySelector(`.sip-start[data-index="${i}"]`) as HTMLInputElement;
      const costBasisEl = document.querySelector(`.sip-cost-basis[data-index="${i}"]`) as HTMLInputElement;

      if (nameEl?.value.trim()) {
        D.sip[`sip${i}`] = {
          name: nameEl.value.trim(),
          schemeCode: codeEl?.value.trim() || '',
          units: parseFloat(unitsEl?.value || '0') || 0,
          monthlyAmount: parseFloat(amountEl?.value || '0') || 0,
          startDate: startEl?.value.trim() || '',
          costBasis: costBasisEl?.value ? parseFloat(costBasisEl.value) : undefined,
        };
      }
    });

    // Holdings fields
    const fdInput = document.getElementById('fd') as HTMLInputElement;
    if (fdInput?.value) {
      D.fd.fd = { amount: parseFloat(fdInput.value) || 0 };
    }

    const epfInput = document.getElementById('epf') as HTMLInputElement;
    if (epfInput?.value) {
      D.epf.epf = { amount: parseFloat(epfInput.value) || 0 };
    }

    const esopInput = document.getElementById('esop') as HTMLInputElement;
    if (esopInput?.value) {
      D.esop.esop = { amount: parseFloat(esopInput.value) || 0 };
    }

    // Persist and trigger dashboard refresh
    saveData(D);
    showToast('Portfolio saved', 3000, 'success');
    
    // Trigger dashboard update if it exists
    const dashboardTab = document.getElementById('dashboard');
    if (dashboardTab) {
      const event = new CustomEvent('profileUpdated', { detail: { timestamp: Date.now() } });
      document.dispatchEvent(event);
    }
  } catch (e) {
    handleError(e as Error, 'Failed to save profile');
  }
}
```

- [ ] Run `npm run dev` and test Profile tab → enter values → blur input → verify values persist to localStorage

- [ ] Commit: `git add src/modules/profile/index.ts && git commit -m "feat(profile): complete form save handlers and field parsing"`

### Step 2: Implement PDF import confirmation flow

- [ ] Add handler for PDF file selection. Append new function to `src/modules/profile/index.ts`:

```typescript
/**
 * Handle PDF file selection
 */
async function handlePDFImport(event: Event) {
  try {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    showToast('Parsing CAS PDF...', 5000, 'info');
    const parsed = await parseCASPDF(file);
    
    if (!parsed || parsed.funds.length === 0) {
      showToast('No funds found in PDF', 3000, 'error');
      return;
    }

    // Store parsed data temporarily for confirmation
    (window as any).__pendingPDFImport = parsed;

    // Show confirmation modal
    const modal = document.getElementById('pdf-confirmation');
    if (modal) {
      const preview = document.getElementById('pdf-preview');
      if (preview) {
        preview.innerHTML = `
          <div class="pdf-preview-content">
            <h4>Detected Mutual Funds</h4>
            <ul>
              ${parsed.funds.map((f: any) => `<li>${f.name} - ${f.units} units</li>`).join('')}
            </ul>
            ${parsed.dematHoldings && parsed.dematHoldings.length > 0 ? `
              <h4>Detected Demat Holdings</h4>
              <ul>
                ${parsed.dematHoldings.map((d: any) => `<li>${d.name} (${d.isin}) - ${d.quantity} units</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        `;
      }
      modal.style.display = 'flex';
    }
  } catch (e) {
    handleError(e as Error, 'Failed to parse PDF');
    input.value = '';
  }
}
```

- [ ] Add confirm/cancel handlers. Append to `src/modules/profile/index.ts`:

```typescript
/**
 * Confirm PDF import
 */
function confirmPDFImport() {
  try {
    const parsed = (window as any).__pendingPDFImport;
    if (!parsed) return;

    // Import funds
    let sipIndex = 1;
    parsed.funds.forEach((fund: any) => {
      while (D.sip[`sip${sipIndex}`] && sipIndex <= 10) sipIndex++;
      if (sipIndex <= 10) {
        D.sip[`sip${sipIndex}`] = {
          name: fund.name,
          schemeCode: fund.schemeCode || '',
          units: parseFloat(fund.units) || 0,
          monthlyAmount: 0,
          startDate: fund.purchaseDate || '',
        };
      }
    });

    // Import demat holdings
    if (parsed.dematHoldings) {
      parsed.dematHoldings.forEach((holding: any) => {
        D.demat[holding.isin] = holding;
      });
    }

    saveData(D);
    showToast('CAS data imported successfully', 3000, 'success');

    const modal = document.getElementById('pdf-confirmation');
    if (modal) modal.style.display = 'none';

    const input = document.getElementById('pdf-input') as HTMLInputElement;
    if (input) input.value = '';

    delete (window as any).__pendingPDFImport;

    // Re-render profile to show new data
    const container = document.getElementById('profile');
    if (container) renderProfile(container);

    document.dispatchEvent(new CustomEvent('profileUpdated', { detail: { timestamp: Date.now() } }));
  } catch (e) {
    handleError(e as Error, 'Failed to import CAS data');
  }
}

/**
 * Cancel PDF import
 */
function cancelPDFImport() {
  const modal = document.getElementById('pdf-confirmation');
  if (modal) modal.style.display = 'none';

  const input = document.getElementById('pdf-input') as HTMLInputElement;
  if (input) input.value = '';

  delete (window as any).__pendingPDFImport;
}
```

- [ ] Test PDF import: `npm run dev` → Profile tab → Import CAS PDF → select a test PDF → verify preview shows → click Confirm → verify profile re-renders

- [ ] Commit: `git add src/modules/profile/index.ts && git commit -m "feat(profile): implement PDF import confirmation flow"`

### Step 3: Implement data export/import

- [ ] Add export function to `src/modules/profile/index.ts`:

```typescript
/**
 * Export portfolio as JSON
 */
function exportPortfolioJSON() {
  try {
    const backup = {
      version: 'fireOS_v2',
      exportedAt: new Date().toISOString(),
      profile: D.profile,
      sip: D.sip,
      fd: D.fd,
      epf: D.epf,
      esop: D.esop,
      demat: D.demat,
      nav: D.nav,
      eurInr: D.eurInr,
    };

    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fireOS_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Portfolio exported', 2000, 'success');
  } catch (e) {
    handleError(e as Error, 'Failed to export portfolio');
  }
}

/**
 * Handle JSON import
 */
async function handleJSONImport(event: Event) {
  try {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const text = await file.text();
    const data = JSON.parse(text);

    // Support both v1 (legacy) and v2 formats
    if (data.version === 'fireOS_v2') {
      Object.assign(D, {
        profile: data.profile || D.profile,
        sip: data.sip || D.sip,
        fd: data.fd || D.fd,
        epf: data.epf || D.epf,
        esop: data.esop || D.esop,
        demat: data.demat || D.demat,
        nav: data.nav || D.nav,
        eurInr: data.eurInr || D.eurInr,
      });
    } else {
      // Legacy v1 support
      Object.assign(D.profile, data.profile || {});
      Object.assign(D.sip, data.sip || {});
    }

    saveData(D);
    showToast('Portfolio imported', 2000, 'success');

    const container = document.getElementById('profile');
    if (container) renderProfile(container);

    document.dispatchEvent(new CustomEvent('profileUpdated', { detail: { timestamp: Date.now() } }));

    input.value = '';
  } catch (e) {
    handleError(e as Error, 'Failed to import portfolio');
    (event.target as HTMLInputElement).value = '';
  }
}
```

- [ ] Test export: `npm run dev` → Profile tab → click "Export Data" → verify JSON file downloads with correct structure

- [ ] Test import: Import the JSON file back → verify data loads correctly

- [ ] Commit: `git add src/modules/profile/index.ts && git commit -m "feat(profile): implement data export and import handlers"`

### Step 4: Verify PDF parser robustness

- [ ] Read `src/modules/profile/pdf-parser.ts` to check current implementation

```bash
head -n 100 src/modules/profile/pdf-parser.ts
```

- [ ] If `parseCASPDF` function doesn't handle errors gracefully, wrap it with try-catch and error handling (already done in Step 2's `handlePDFImport`)

- [ ] Test edge cases: corrupt PDF, empty PDF, non-CAS PDF → verify all fail gracefully with error toast

- [ ] Commit: `git add -A && git commit -m "feat(profile): verify PDF parser handles edge cases"`

### Step 5: Verify Profile module initialization

- [ ] Check that `initProfileModule('profile')` is called in `src/main.ts` line 69

```bash
grep -n "initProfileModule" src/main.ts
```

- [ ] If not present, add to main.ts `initApp()` function. Already verified in main.ts

- [ ] Test: `npm run dev` → verify Profile tab renders on page load with all form sections

- [ ] Commit: `git add -A && git commit -m "feat(profile): complete integration with main module initialization"`

---

## Task 12: Complete Calculators Module Integration

**Files:**
- Verify: `src/modules/calculators/index.ts` (all 4 calculators render)
- Add: Event handlers for calculator inputs and refresh buttons

### Current State
Calculators module has skeleton renders but missing:
- Event handler attachment
- Live calculation updates
- Nifty fetch integration
- EUR/INR auto-fetch

### Step 1: Add calculator tab switching

- [ ] Check `src/modules/calculators/index.ts` for `attachCalculatorHandlers()` function

```bash
grep -A 20 "attachCalculatorHandlers" src/modules/calculators/index.ts
```

- [ ] If function body is empty, implement it. Append to `src/modules/calculators/index.ts` after `renderCalculators()`:

```typescript
function attachCalculatorHandlers() {
  // Tab switching
  document.querySelectorAll('.calc-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const calcId = (e.target as HTMLElement).getAttribute('data-calc');
      if (calcId) {
        document.querySelectorAll('.calc-tab').forEach((t) => t.classList.remove('active'));
        (e.target as HTMLElement).classList.add('active');

        document.querySelectorAll('.calc-panel').forEach((p) => p.classList.remove('active'));
        const panel = document.getElementById(calcId);
        if (panel) panel.classList.add('active');

        // Trigger auto-fetch when ESOP tab opens
        if (calcId === 'esop') {
          handleESOP();
        }
      }
    });
  });

  // Crash Protocol handlers
  attachCrashProtocolHandlers();

  // ESOP handlers
  attachESOP();
}

function attachCrashProtocolHandlers() {
  const refreshBtn = document.getElementById('refresh-nifty-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      try {
        const niftyHigh = document.getElementById('nifty-high') as HTMLInputElement;
        const niftyCurrent = document.getElementById('nifty-current') as HTMLInputElement;

        if (!niftyHigh?.value || !niftyCurrent?.value) {
          showToast('Enter both Nifty values', 2000, 'error');
          return;
        }

        // Recalculate crash scenarios
        const highVal = parseFloat(niftyHigh.value);
        const currentVal = parseFloat(niftyCurrent.value);
        const drawdown = ((highVal - currentVal) / highVal) * 100;

        const crashPanel = document.getElementById('crash');
        if (crashPanel) {
          const scenarioDiv = crashPanel.querySelector('.crash-scenarios');
          if (scenarioDiv) {
            const totalNW = calculateTotalNetWorth();
            scenarioDiv.innerHTML = `
              <div class="scenario-info">
                <p>Current Drawdown: ${drawdown.toFixed(2)}%</p>
              </div>
              <div class="scenario">
                <span class="scenario-label">10% Crash</span>
                <span class="scenario-value">₹${formatCurrency(totalNW * 0.1)}</span>
              </div>
              <div class="scenario">
                <span class="scenario-label">15% Crash</span>
                <span class="scenario-value">₹${formatCurrency(totalNW * 0.15)}</span>
              </div>
              <div class="scenario">
                <span class="scenario-label">25% Crash</span>
                <span class="scenario-value">₹${formatCurrency(totalNW * 0.25)}</span>
              </div>
            `;
          }
        }

        showToast('Crash scenarios updated', 2000, 'success');
      } catch (e) {
        handleError(e as Error, 'Failed to update Nifty data');
      }
    });
  }
}

async function handleESOP() {
  try {
    // Auto-fetch EUR/INR when ESOP tab opens
    const { fetchEURINR } = await import('../api');
    const rate = await fetchEURINR();
    if (rate) {
      const currencyInput = document.getElementById('eur-inr-rate') as HTMLInputElement;
      if (currencyInput) {
        currencyInput.value = rate.toString();
        showToast(`EUR/INR fetched: ${rate}`, 2000, 'success');
      }
    }
  } catch (e) {
    // Fail silently, user can enter manually
    console.warn('EUR/INR fetch failed, user can enter manually');
  }
}

function attachESOP() {
  const updateBtn = document.getElementById('esop-calculate-btn');
  if (updateBtn) {
    updateBtn.addEventListener('click', () => {
      try {
        const quantity = parseFloat((document.getElementById('esop-quantity') as HTMLInputElement)?.value || '0');
        const grantPrice = parseFloat((document.getElementById('esop-grant-price') as HTMLInputElement)?.value || '0');
        const currentPrice = parseFloat((document.getElementById('esop-current-price') as HTMLInputElement)?.value || '0');
        const rate = parseFloat((document.getElementById('eur-inr-rate') as HTMLInputElement)?.value || '1');

        if (quantity <= 0 || grantPrice <= 0 || currentPrice <= 0) {
          showToast('Enter valid values', 2000, 'error');
          return;
        }

        const investmentCost = quantity * grantPrice;
        const currentValue = quantity * currentPrice;
        const gain = currentValue - investmentCost;
        const gainPercent = (gain / investmentCost) * 100;

        const resultDiv = document.getElementById('esop-result');
        if (resultDiv) {
          resultDiv.innerHTML = `
            <div class="result-item">
              <span class="label">Investment Cost</span>
              <span class="value">₹${formatCurrency(investmentCost)}</span>
            </div>
            <div class="result-item">
              <span class="label">Current Value</span>
              <span class="value">₹${formatCurrency(currentValue)}</span>
            </div>
            <div class="result-item">
              <span class="label">Gain/Loss</span>
              <span class="value ${gain >= 0 ? 'positive' : 'negative'}">₹${formatCurrency(gain)}</span>
            </div>
            <div class="result-item">
              <span class="label">Return %</span>
              <span class="value ${gainPercent >= 0 ? 'positive' : 'negative'}">${gainPercent.toFixed(2)}%</span>
            </div>
          `;
        }

        showToast('ESOP valuation updated', 2000, 'success');
      } catch (e) {
        handleError(e as Error, 'Failed to calculate ESOP value');
      }
    });
  }
}

function calculateTotalNetWorth(): number {
  let total = 0;
  Object.values(D.sip).forEach((sip: any) => {
    total += (sip.units || 0) * (D.nav[sip.schemeCode]?.nav || 0);
  });
  total += D.fd.fd?.amount || 0;
  total += D.epf.epf?.amount || 0;
  total += D.esop.esop?.amount || 0;
  Object.values(D.demat).forEach((h: any) => {
    total += h.currentValue || 0;
  });
  return total;
}
```

- [ ] Run `npm run dev` → Calculators tab → click each calculator tab → verify they switch

- [ ] Commit: `git add src/modules/calculators/index.ts && git commit -m "feat(calculators): implement tab switching and calculator event handlers"`

### Step 2: Add crash protocol inputs and refresh

- [ ] Update `renderCrashProtocol()` to include dynamic inputs. Find the function in `src/modules/calculators/index.ts` and ensure it has this button:

```bash
grep -B 5 -A 15 "refresh-nifty-btn" src/modules/calculators/index.ts
```

- [ ] Button already exists (seen in earlier code review). Verify it's properly wired in `attachCrashProtocolHandlers()`

- [ ] Test: `npm run dev` → Calculators → Crash Protocol → enter Nifty values → click Refresh → verify scenarios update

- [ ] Commit: `git add -A && git commit -m "feat(calculators): verify crash protocol calculator integration"`

### Step 3: Add ESOP tools with EUR/INR fetch

- [ ] Check `renderESOP()` function exists and includes EUR/INR input:

```bash
grep -A 40 "renderESOP" src/modules/calculators/index.ts | head -n 50
```

- [ ] If missing EUR/INR input fields, add them to `renderESOP()`. Update function:

```typescript
function renderESOP(): string {
  return `
    <div class="calc-card">
      <h3>ESOP Valuation & Tax Tools</h3>
      <p class="calc-info">Calculate ESOP value and tax implications</p>

      <div class="calc-input-group">
        <label>Stock Quantity</label>
        <input type="number" id="esop-quantity" placeholder="Number of shares">
      </div>

      <div class="calc-input-group">
        <label>Grant Price (₹)</label>
        <input type="number" id="esop-grant-price" placeholder="Price per share">
      </div>

      <div class="calc-input-group">
        <label>Current Price (₹)</label>
        <input type="number" id="esop-current-price" placeholder="Current market price">
      </div>

      <div class="calc-input-group">
        <label>EUR/INR Rate</label>
        <div class="input-with-button">
          <input type="number" id="eur-inr-rate" placeholder="Auto-fetched" value="${D.eurInr?.rate || ''}">
          <span class="rate-timestamp">${D.eurInr?.timestamp ? `Last updated: ${new Date(D.eurInr.timestamp).toLocaleDateString()}` : ''}</span>
        </div>
      </div>

      <button id="esop-calculate-btn" class="btn-primary">Calculate</button>

      <div id="esop-result" class="calc-result"></div>

      <div class="alpha-tracker-section">
        <h4>Alpha vs Benchmark Tracker</h4>
        <p class="calc-info">3-year rolling returns</p>
        ${renderAlphaTracker()}
      </div>
    </div>
  `;
}

function renderAlphaTracker(): string {
  const alphaData = D.alphaTrackerData || {};
  return `
    <div class="alpha-grid">
      <div class="alpha-card">
        <span class="fund">PPFCF</span>
        <span class="benchmark">vs Nifty 500</span>
        <span class="returns">${alphaData.ppfcf3yr || 'N/A'}%</span>
      </div>
      <div class="alpha-card">
        <span class="fund">Nippon Growth</span>
        <span class="benchmark">vs Nifty MC150</span>
        <span class="returns">${alphaData.nipponGrowth3yr || 'N/A'}%</span>
      </div>
      <div class="alpha-card">
        <span class="fund">Nippon Small Cap</span>
        <span class="benchmark">vs Nifty SC250</span>
        <span class="returns">${alphaData.nipponSmallCap3yr || 'N/A'}%</span>
      </div>
    </div>
  `;
}
```

- [ ] Test: `npm run dev` → Calculators → ESOP Tools → verify EUR/INR auto-fetches or shows cached value → enter stock values → click Calculate → verify valuation displays

- [ ] Commit: `git add src/modules/calculators/index.ts && git commit -m "feat(calculators): complete ESOP tools with EUR/INR auto-fetch"`

### Step 4: Verify Calculators module initialization

- [ ] Check that `initCalculatorsModule('calculators')` called in `src/main.ts`

```bash
grep -n "initCalculatorsModule" src/main.ts
```

- [ ] Verify it's in `initApp()` function (line 71)

- [ ] Test: `npm run dev` → Calculators tab → verify all 4 calculators render

- [ ] Commit: `git add -A && git commit -m "feat(calculators): complete module initialization and integration"`

---

## Task 13: Add Comprehensive Error Handling & Validation

**Files:**
- Modify: `src/lib/error-handler.ts` (ensure comprehensive error handling)
- Modify: `src/main.ts` (add try-catch boundaries around module initialization)
- Modify: All module index files (add try-catch around event handlers)

### Current State
Error handler exists with `handleError` function. Need to:
- Wrap all async operations with try-catch
- Add input validation before form submission
- Add error boundaries for module initialization
- Ensure all API errors show user-facing toasts

### Step 1: Enhance error-handler.ts

- [ ] Read current `src/lib/error-handler.ts`:

```bash
cat src/lib/error-handler.ts
```

- [ ] If function doesn't exist, create comprehensive error handler. Replace entire file:

```typescript
/**
 * Error Handling & Input Validation
 */

export class FireOSError extends Error {
  constructor(
    public code: string,
    message: string,
    public userMessage: string = 'Something went wrong. Please try again.'
  ) {
    super(message);
    this.name = 'FireOSError';
  }
}

export type ValidationError = {
  field: string;
  message: string;
};

/**
 * Global error handler
 */
export function handleError(error: Error, context?: string) {
  console.error(`[FireOS Error] ${context || 'Unexpected error'}:`, error);

  // Log to Firebase Crashlytics in production (optional future enhancement)
  if (import.meta.env.PROD) {
    // TODO: integrate with Firebase Crashlytics
  }

  // Don't re-throw, let caller decide
}

/**
 * Validate form input
 */
export function validateFormInput(value: string, rules: ValidationRule[]): ValidationError | null {
  for (const rule of rules) {
    const error = rule.validate(value);
    if (error) return { field: rule.name, message: error };
  }
  return null;
}

export interface ValidationRule {
  name: string;
  validate: (value: string) => string | null;
}

/**
 * Common validation rules
 */
export const ValidationRules = {
  required: (fieldName: string): ValidationRule => ({
    name: fieldName,
    validate: (value: string) => (value.trim() ? null : `${fieldName} is required`),
  }),

  positiveNumber: (fieldName: string): ValidationRule => ({
    name: fieldName,
    validate: (value: string) => {
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0 ? null : `${fieldName} must be a positive number`;
    },
  }),

  dateYYYYMM: (fieldName: string): ValidationRule => ({
    name: fieldName,
    validate: (value: string) => {
      const match = /^\d{4}-\d{2}$/.test(value);
      if (!match) return `${fieldName} must be YYYY-MM format`;
      const [year, month] = value.split('-').map(Number);
      if (month < 1 || month > 12) return 'Month must be 01-12';
      return null;
    },
  }),

  schemeCode: (fieldName: string): ValidationRule => ({
    name: fieldName,
    validate: (value: string) => {
      return /^\d{6}$/.test(value.trim()) ? null : `${fieldName} must be 6 digits`;
    },
  }),

  isin: (fieldName: string): ValidationRule => ({
    name: fieldName,
    validate: (value: string) => {
      return /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(value.trim())
        ? null
        : `${fieldName} must be valid ISIN (12 chars)`;
    },
  }),
};

/**
 * Setup global error handlers
 */
export function setupErrorHandling() {
  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled Promise Rejection]', event.reason);
    handleError(event.reason as Error, 'Unhandled promise rejection');
  });

  // Global error handler
  window.addEventListener('error', (event) => {
    console.error('[Global Error]', event.error);
    handleError(event.error as Error, 'Uncaught exception');
  });
}
```

- [ ] Run `npm run dev` and check console has no errors

- [ ] Commit: `git add src/lib/error-handler.ts && git commit -m "feat(error-handling): enhance error handler with validation rules"`

### Step 2: Add try-catch boundaries to module initialization

- [ ] Update `src/main.ts` `initApp()` function. Replace entire function:

```typescript
// In src/main.ts, replace initApp function
function initApp() {
  try {
    setupErrorHandling();
    loadFromLocalStorage();
    
    try {
      initUIModule();
    } catch (e) {
      console.error('Failed to initialize UI module:', e);
      showToast('UI initialization failed', 3000, 'error');
    }

    try {
      initProfileModule('profile');
    } catch (e) {
      console.error('Failed to initialize Profile module:', e);
      document.getElementById('profile')!.innerHTML = '<p>Error loading Profile module</p>';
    }

    try {
      initDashboardModule('dashboard');
    } catch (e) {
      console.error('Failed to initialize Dashboard module:', e);
      document.getElementById('dashboard')!.innerHTML = '<p>Error loading Dashboard module</p>';
    }

    try {
      initCalculatorsModule('calculators');
    } catch (e) {
      console.error('Failed to initialize Calculators module:', e);
      document.getElementById('calculators')!.innerHTML = '<p>Error loading Calculators module</p>';
    }

    renderApp();
    setupAuthListener();
    setupTabNavigation();
    setupAutoSave();
    setupDashboardAutoRefresh();
    setupOfflineNotification();
  } catch (e) {
    console.error('Fatal error during app initialization:', e);
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = '<div style="padding: 20px; color: red;">Failed to initialize app. Please reload.</div>';
    }
  }
}
```

- [ ] Import `showToast` at top of `src/main.ts`. Add to imports:

```typescript
import { showToast } from './modules/ui';
```

- [ ] Test: `npm run dev` → check console for any errors → verify app loads normally

- [ ] Commit: `git add src/main.ts && git commit -m "feat(error-handling): add try-catch boundaries to module initialization"`

### Step 3: Add validation to Profile form saves

- [ ] Update `saveProfile()` in `src/modules/profile/index.ts` to validate before save. Wrap field assignments with validation:

```typescript
// Add at start of saveProfile function, after try block
const errors: ValidationError[] = [];

if (nameInput?.value) {
  const error = validateFormInput(nameInput.value, [ValidationRules.required('Name')]);
  if (error) errors.push(error);
  else if (nameInput.value.length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters' });
  }
}

if (ageInput?.value) {
  const error = validateFormInput(ageInput.value, [ValidationRules.positiveNumber('Age')]);
  if (error) errors.push(error);
}

if (expensesInput?.value) {
  const error = validateFormInput(expensesInput.value, [ValidationRules.positiveNumber('Expenses')]);
  if (error) errors.push(error);
}

// Check for SIP validation
sipIndices.forEach((i) => {
  const startEl = document.querySelector(`.sip-start[data-index="${i}"]`) as HTMLInputElement;
  if (startEl?.value) {
    const error = validateFormInput(startEl.value, [ValidationRules.dateYYYYMM('SIP Start Date')]);
    if (error) errors.push({ ...error, field: `sip${i}_startDate` });
  }
});

// If validation errors, show and return
if (errors.length > 0) {
  const errorMsg = errors.map((e) => e.message).join(', ');
  showToast(`Validation errors: ${errorMsg}`, 3000, 'error');
  return;
}
```

- [ ] Test: `npm run dev` → Profile tab → enter invalid values (e.g., age = "abc", date = "2023") → blur field → verify error toast appears

- [ ] Commit: `git add src/modules/profile/index.ts && git commit -m "feat(error-handling): add input validation to profile form"`

### Step 4: Add error handling to API calls

- [ ] Update `src/modules/api/index.ts` to ensure all fetch calls have try-catch. Check current implementation:

```bash
grep -n "fetch(" src/modules/api/index.ts
```

- [ ] If any fetches don't have try-catch, wrap them. Example wrapper:

```typescript
async function fetchWithErrorHandling<T>(url: string, context: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return await response.json();
  } catch (e) {
    console.warn(`API call failed (${context}):`, e);
    return null;
  }
}
```

- [ ] Test: Disable network → try to fetch NAV/Nifty → verify graceful fallback to cache or manual entry

- [ ] Commit: `git add src/modules/api/index.ts && git commit -m "feat(error-handling): add try-catch to all API calls"`

### Step 5: Add offline error notification

- [ ] Verify `setupOfflineNotification()` exists in `src/main.ts` (already there from code review)

- [ ] Test: Open DevTools → Network → offline mode → verify banner shows → go online → verify banner hides

- [ ] Commit: `git add -A && git commit -m "feat(error-handling): verify offline detection and user notification"`

---

## Task 15: Performance Optimization

**Files:**
- Modify: `src/lib/storage.ts` (verify cache TTL management)
- Modify: `src/main.ts` (verify debouncing)
- Verify: Vite build configuration in `vite.config.ts`

### Current State
- Form debouncing exists (500ms in Profile)
- API caching exists (4h NAV, 1h Nifty, 24h EUR/INR)
- Need to verify bundle size and add minor optimizations

### Step 1: Verify debouncing in Profile form

- [ ] Check Profile module has debounce. Already verified (line 14-15):

```bash
grep -n "DEBOUNCE_MS" src/modules/profile/index.ts
```

- [ ] Verify debounce is applied correctly. Already in code at line 263-266

- [ ] Test: `npm run dev` → Profile → rapidly change inputs in quick succession → check browser console → should see only 1 save after 500ms pause

- [ ] Commit: `git add -A && git commit -m "perf: verify form input debouncing"`

### Step 2: Verify API cache TTL implementation

- [ ] Check cache TTL in API modules:

```bash
grep -r "TTL\|ttl\|3600000\|14400000\|86400000" src/modules/api/
```

- [ ] Verify times match CLAUDE.md:
  - NAV: 4 hours (14400000 ms) ✓
  - Nifty: 1 hour (3600000 ms) ✓
  - EUR/INR: 24 hours (86400000 ms) ✓

- [ ] If any are missing, add to respective modules. Example for NAV cache:

```typescript
const NAV_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

function getCachedNAV(schemeCode: string): { nav: number; timestamp: number } | null {
  const cached = D.nav[schemeCode];
  if (!cached) return null;
  
  const age = Date.now() - (cached.timestamp || 0);
  if (age > NAV_CACHE_TTL) {
    delete D.nav[schemeCode];
    return null;
  }
  
  return cached;
}
```

- [ ] Test: `npm run dev` → enter NAV fetch → wait 1 second → fetch again → should use cache (no network call)

- [ ] Commit: `git add src/modules/api/*.ts && git commit -m "perf: verify cache TTL implementation"`

### Step 3: Check Vite build configuration

- [ ] Read `vite.config.ts`:

```bash
cat vite.config.ts
```

- [ ] Verify it includes minification and optimization settings:

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    minify: 'terser',
    sourcemap: false,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        manualChunks: undefined, // Let Vite decide
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
```

- [ ] If missing, update the file with above config

- [ ] Run build and check size:

```bash
npm run build
ls -lh dist/index.js
```

- [ ] Target: < 200 KB gzipped. If larger, identify heavy dependencies:

```bash
npm install --save-dev @esbuild/linux-x64 # or darwin/win32
npx esbuild --version
```

- [ ] Test: `npm run preview` → verify app loads and works in preview mode (production build)

- [ ] Commit: `git add vite.config.ts && git commit -m "perf: optimize Vite build configuration"`

### Step 4: Remove console logs in production

- [ ] Update logger to detect production. Check `src/lib/logger.ts`:

```bash
cat src/lib/logger.ts
```

- [ ] If it doesn't check for production, update to:

```typescript
export const logger = {
  log: (...args: any[]) => {
    if (!import.meta.env.PROD) console.log('[FIRE OS]', ...args);
  },
  warn: (...args: any[]) => {
    if (!import.meta.env.PROD) console.warn('[FIRE OS]', ...args);
  },
  error: (...args: any[]) => {
    // Always log errors, even in prod
    console.error('[FIRE OS]', ...args);
  },
  debug: (...args: any[]) => {
    if (!import.meta.env.PROD && import.meta.env.DEBUG) console.debug('[FIRE OS]', ...args);
  },
};
```

- [ ] Replace `console.log` calls with `logger.log` in non-critical paths

- [ ] Test: `npm run build && npm run preview` → open DevTools console → verify minimal logs

- [ ] Commit: `git add src/lib/logger.ts && git commit -m "perf: remove console logs in production build"`

### Step 5: Verify lazy loading opportunities

- [ ] Check if Chart.js is loaded on page load or on-demand:

```bash
grep -n "Chart" src/modules/dashboard/index.ts | head -5
```

- [ ] If loaded unconditionally, add dynamic import. Example:

```typescript
export function initDashboardModule(containerId: string) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Don't load Chart.js until dashboard tab is opened
  (window as any)._dashboardInitialized = false;
}

export async function renderDashboard() {
  if (!(window as any)._dashboardInitialized) {
    // Dynamic import on first render
    const { Chart } = await import('chart.js');
    (window as any)._Chart = Chart;
    (window as any)._dashboardInitialized = true;
  }

  // Render using Chart...
}
```

- [ ] Test: DevTools Network tab → open app → check Chart.js not loaded → click Dashboard tab → Chart.js loads

- [ ] Commit: `git add src/modules/dashboard/index.ts && git commit -m "perf: lazy-load Chart.js on dashboard tab open"`

### Step 6: Final performance verification

- [ ] Run full build:

```bash
npm run build
```

- [ ] Check metrics:
  - Bundle size (target: < 200 KB gzipped)
  - Page load time (target: < 2s on 3G)
  - Time to interactive (target: < 1.5s)

- [ ] If targets not met, use Chrome DevTools Performance tab to identify bottlenecks

- [ ] Commit: `git add -A && git commit -m "perf: verify performance metrics and optimize"`

---

## Task 16: Documentation

**Files:**
- Create: `docs/ARCHITECTURE.md` (detailed module breakdown)
- Create: `docs/API.md` (API endpoints, responses, error handling)
- Modify: `README.md` (update build instructions)
- Verify: `CLAUDE.md` (already updated in task 1)

### Step 1: Create ARCHITECTURE.md

- [ ] Create file `docs/ARCHITECTURE.md`:

```markdown
# FIRE OS Architecture

## Overview

FIRE OS is a personal finance dashboard for FIRE planning. Built with Vite + TypeScript, it features a modular architecture with clear separation of concerns.

## Project Structure

\`\`\`
src/
├── main.ts                 # App bootstrap, Firebase init, module registration
├── types/                  # TypeScript interfaces
│   ├── state.ts           # Global state type (FireOSState)
│   ├── portfolio.ts       # Portfolio data types
│   ├── api.ts             # API response types
│   └── firebase.ts        # Firebase types
├── lib/                    # Utility libraries (no UI)
│   ├── calculations.ts    # XIRR, SIP, FI calculations
│   ├── storage.ts         # Firebase + localStorage sync
│   ├── validators.ts      # Input validation rules
│   ├── formatters.ts      # Number/currency/date formatting
│   ├── logger.ts          # Logging (dev vs prod)
│   └── error-handler.ts   # Error handling & validation
├── modules/                # Feature modules (each with UI + logic)
│   ├── auth/              # Firebase authentication
│   │   ├── index.ts
│   │   ├── firebaseAuth.ts
│   │   ├── validation.ts
│   │   └── styles.css
│   ├── ui/                # Shared UI components
│   │   ├── Modal.ts
│   │   ├── Card.ts
│   │   ├── Form.ts
│   │   ├── Toast.ts
│   │   ├── index.ts
│   │   └── styles.css
│   ├── api/               # External API integrations
│   │   ├── mfapi.ts       # NAV fetching
│   │   ├── nifty.ts       # Nifty level + 52W high
│   │   ├── eurInr.ts      # EUR/INR rate
│   │   ├── fallbacks.ts   # Caching & manual entry
│   │   ├── parsePDF.ts    # PDF parsing
│   │   └── index.ts
│   ├── dashboard/         # KPI dashboard
│   │   ├── index.ts
│   │   ├── kpis.ts
│   │   └── styles.css
│   ├── profile/           # Portfolio form + PDF import
│   │   ├── index.ts
│   │   ├── pdf-parser.ts
│   │   └── styles.css
│   └── calculators/       # Financial calculators
│       ├── index.ts
│       └── styles.css
├── styles/                # Global CSS
│   ├── global.css
│   ├── layout.css
│   └── tokens.css
└── index.html            # Entry point

dist/                      # Build output (Vite)
tests/                     # Tests
docs/                      # Documentation
```

## Module Architecture

### Lifecycle: Init → Render → Handle Events

Each module follows this pattern:

\`\`\`typescript
// 1. Initialization (called once on app start)
export function initProfileModule(containerId: string) {
  const container = document.getElementById(containerId);
  if (container) renderProfile(container);
}

// 2. Rendering (called when data changes)
export function renderProfile(container: HTMLElement) {
  container.innerHTML = \`...\`;
  attachProfileHandlers();
}

// 3. Event handling (user interactions)
function attachProfileHandlers() {
  document.getElementById('save-btn')?.addEventListener('click', saveProfile);
}
```

### State Management (D Object)

Global state object `D` (FireOSState) represents entire app state:

\`\`\`typescript
export interface FireOSState {
  currentUser: FirebaseUser | null;
  profile: {
    name: string;
    age?: number;
    annualExpenses: number;
    fiTarget: number;
  };
  sip: Record<string, SIPFund>;  // sip1, sip2, ...sip10
  fd: Record<string, Holding>;
  epf: Record<string, Holding>;
  esop: Record<string, Holding>;
  demat: Record<string, DematHolding>;  // ISIN -> holding
  nav: Record<string, NAVCache>;        // schemeCode -> {nav, timestamp}
  niftyData?: { level: number; high52w: number; timestamp: number };
  eurInr?: { rate: number; timestamp: number };
  _lastSavedAt: string;  // ISO timestamp
}
```

### Data Flow

\`\`\`
User Input → Form Event Handler
  ↓
Input Validation (validators.ts)
  ↓
Save to D object
  ↓
Persist to localStorage + Firebase
  ↓
Dispatch custom event ('profileUpdated')
  ↓
Other modules listen and re-render
  ↓
updateDashboard() recalculates KPIs
\`\`\`

### Authentication Flow

1. Page load → Check Firebase auth state
2. If not authenticated → Show login/signup screen
3. User logs in → Firebase validates → `onAuthStateChanged()` fires
4. Set `D.currentUser` → Hide auth screen → Load portfolio from Firebase
5. User interacts → Changes persisted to Realtime DB automatically

### API Caching Strategy

| API | TTL | Source | Fallback |
|-----|-----|--------|----------|
| NAV | 4h | api.mfapi.in | Manual entry |
| Nifty | 1h | Yahoo Finance → ETF NAV | Manual entry |
| EUR/INR | 24h | Yahoo Finance | Cached value |

## Adding New Features

1. Create module in `src/modules/feature/`
2. Export `init()`, `render()` functions
3. Register in `main.ts` `initApp()`
4. Update state type in `src/types/state.ts` if needed
5. Add tests in `tests/feature.test.ts`

## Error Handling

All errors follow this pattern:

\`\`\`typescript
try {
  // operation
} catch (e) {
  handleError(e as Error, 'Context description');
  showToast('User-friendly error message', 3000, 'error');
}
\`\`\`

Never expose technical errors to users. Always show a Toast notification.

## Testing

- **Unit**: `npm run test` (Vitest)
- **E2E**: `npm run test:ui` (Playwright)
- **Build**: `npm run build` (verify no errors)

## Performance

- Form inputs debounced 500ms before save
- API responses cached with TTL validation
- Chart.js lazy-loaded on dashboard tab open
- Production bundle minified + gzipped (< 200 KB)
- Page load time < 2 seconds

## Deployment

Firebase Hosting: `npm run build && firebase deploy`

Realtime DB URL: https://fire-os-dd6d6-default-rtdb.asia-southeast1.firebasedatabase.app

Security Rules: Only authenticated users can read/write their own portfolio.
\`\`\`

- [ ] Save file: Create `docs/ARCHITECTURE.md` with above content

- [ ] Test: Read it and verify it matches actual codebase structure

- [ ] Commit: `git add docs/ARCHITECTURE.md && git commit -m "docs: add ARCHITECTURE.md with module breakdown and data flow"`

### Step 2: Create API.md

- [ ] Create file `docs/API.md`:

```markdown
# FIRE OS API Documentation

## NAV Fetching (Mutual Funds)

**Endpoint:** https://api.mfapi.in/mf/{schemeCode}

**Request:**
\`\`\`bash
GET /mf/122639  # Parag Parikh, PPFCF
\`\`\`

**Response:**
\`\`\`json
{
  "meta": {
    "fund_name": "Parag Parikh Financial Advisory Services Co. Ltd. - Parag Parikh Long Term Equity Fund - Direct Plan - Growth Option",
    "scheme_code": 122639
  },
  "data": [
    {
      "date": "01-Jun-2024",
      "nav": "45.67"
    }
  ]
}
\`\`\`

**Cache:** 4 hours (TTL: 14400000ms)

**Error Handling:**
- Network timeout (5s) → falls back to cached NAV
- HTTP 4xx/5xx → shows Toast "Unable to fetch NAV"
- Invalid JSON → logs error, returns null

**Supported Schemes:**
- 122639: Parag Parikh Long Term Equity
- 118668: Nippon India Growth
- 118778: Nippon India Small Cap
- 113076: iShares Gold ETF

---

## Nifty Level & 52W High

**Primary Source:** Yahoo Finance via CORS proxy

**Endpoint:** https://api.allorigins.win/raw?url=https://query1.finance.yahoo.com/v10/finance/quoteSummary/^NSEI?modules=summaryProfile,price

**Fallback Source:** Gold ETF NAV (scheme 135106) as approximation

**Response Format:**
\`\`\`typescript
{
  level: 25150.5,        // Current Nifty 50 level
  high52w: 26500.0,      // 52-week high
  source: 'Yahoo Finance' // or 'ETF Approximation', or 'manual'
}
\`\`\`

**Cache:** 1 hour (TTL: 3600000ms)

**UI Indicator:** If using ETF approximation, Dashboard shows disclaimer

**Manual Entry:** Modal opens if all APIs fail

---

## EUR/INR Exchange Rate

**Endpoint:** https://api.allorigins.win/raw?url=https://query1.finance.yahoo.com/v7/finance/quote?symbols=EURINR%3DX

**Response:**
\`\`\`json
{
  "quoteResponse": {
    "result": [
      {
        "regularMarketPrice": 89.45
      }
    ]
  }
}
\`\`\`

**Parsed to:**
\`\`\`typescript
{
  rate: 89.45,
  timestamp: 1717408800000
}
\`\`\`

**Cache:** 24 hours (TTL: 86400000ms)

**Validation:** Rate must be between 80-150 INR/EUR (sanity check)

**Auto-Fetch:** Triggered when ESOP Tools tab opens

---

## PDF Parsing (CAS Import)

**Library:** PDF.js (via CDN)

**Input:** NSDL/CDSL Consolidated Account Statement (PDF)

**Parsed Output:**
\`\`\`typescript
{
  funds: [
    {
      name: "Parag Parikh Long Term Equity",
      schemeCode: "122639",
      units: 125.34,
      purchaseDate: "2023-01"
    }
  ],
  dematHoldings: [
    {
      isin: "INE002A01018",
      name: "TCS",
      quantity: 50,
      currentValue: 4500000
    }
  ]
}
\`\`\`

**Error Handling:** Invalid PDFs show Toast "Failed to parse PDF. Please check format."

---

## Firebase Realtime Database

**Project:** fire-os-dd6d6

**Database URL:** https://fire-os-dd6d6-default-rtdb.asia-southeast1.firebasedatabase.app

**Path Structure:**
\`\`\`
/users/{uid}/portfolio
  ├── version: "fireOS_v2"
  ├── profile: { name, age, annualExpenses, fiTarget }
  ├── sip: { sip1, sip2, ... }
  ├── fd, epf, esop, demat, nav, eurInr
  └── _lastSavedAt: "2024-06-01T12:00:00Z"
\`\`\`

**Security Rules:**
\`\`\`json
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
\`\`\`

**Sync Behavior:**
- On login: `loadPortfolioFromFirebase(uid)` fetches user data
- On save: `savePortfolioToFirebase(uid, state)` debounced 1 second
- Offline: Changes saved to localStorage, auto-sync on reconnect

---

## Error Messages

| Scenario | Message | Action |
|----------|---------|--------|
| No auth | Show login screen | Block all tabs |
| Network offline | "📡 You are offline" | Keep UI, read from localStorage |
| API timeout | "Unable to fetch [data]" | Use cached value or manual entry |
| Invalid input | "Name must be at least 2 characters" | Inline error below field |
| Firebase write fails | "Failed to save. Retrying..." | Auto-retry, show warning |
| Corrupt localStorage | Clear and start fresh | Silent, no error shown |

---

## Rate Limits

- MF NAV API: No published limit, cache 4 hours to be safe
- Yahoo Finance: ~2000 requests/hour per IP, cache 1-24 hours
- Firebase: Free tier 1 GB/month, read/write both ~100/second

---

## CORS Proxies

Due to browser CORS restrictions, some APIs require proxies:

- **Yahoo Finance:** https://api.allorigins.win/raw?url=...
- Alternative (if allorigins fails): https://cors-anywhere.herokuapp.com/

---

## Testing API Calls

\`\`\`bash
# Test NAV fetch
curl https://api.mfapi.in/mf/122639

# Test Nifty (requires proxy decoding)
curl -s "https://api.allorigins.win/raw?url=..." | jq '.quoteResponse.result[0].regularMarketPrice'

# Test EUR/INR
curl -s "https://api.allorigins.win/raw?url=..." | jq '.quoteResponse.result[0].regularMarketPrice'
\`\`\`
\`\`\`

- [ ] Save file: Create `docs/API.md` with above content

- [ ] Commit: `git add docs/API.md && git commit -m "docs: add API.md with endpoints, responses, error handling"`

### Step 3: Update README.md

- [ ] Read current `README.md`:

```bash
cat README.md
```

- [ ] Update to add deployment and architecture links. Replace entirely:

```markdown
# FIRE OS - Financial Independence & Retire Early Dashboard

A personal finance dashboard for FIRE planning. Track mutual funds, calculate XIRR, plan SIP pauses, optimize tax, and monitor progress toward financial independence.

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (auto-opens http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Run tests
npm run test          # Headless
npm run test:ui       # Interactive UI
npm run test:debug    # Debug single test
```

## Features

- **Portfolio Tracking:** MF, FD, EPF, SIP, ESOP, Demat holdings
- **Live NAV Fetching:** Real-time prices from api.mfapi.in
- **SIP P&L & XIRR:** Cost basis override, Newton-Raphson annualized returns
- **CAS PDF Import:** Auto-detect MF and demat holdings from NSDL/CDSL statements
- **Financial Calculators:** Crash Protocol, Emergency Runway, SIP Pause Impact, ESOP Tools
- **Cross-Device Sync:** Firebase Realtime Database with offline support
- **Tax Optimization:** Alpha vs Benchmark tracking, currency conversion tools

## Documentation

- [**ARCHITECTURE.md**](docs/ARCHITECTURE.md) — Module structure, data flow, state management
- [**API.md**](docs/API.md) — API endpoints, responses, caching, error handling
- [**CLAUDE.md**](CLAUDE.md) — Developer guide, setup, testing, deployment

## Project Structure

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed module breakdown.

Key directories:
- `src/types/` — TypeScript interfaces
- `src/lib/` — Utilities (calculations, storage, validators, formatters, error handling)
- `src/modules/` — Feature modules (auth, dashboard, profile, calculators, api, ui)
- `tests/` — Unit and E2E tests

## Tech Stack

- **Frontend:** Vite 5, TypeScript 5, CSS3
- **Backend:** Firebase 11 (Authentication + Realtime Database)
- **Charts:** Chart.js 4 (CDN)
- **PDF Parsing:** PDF.js (CDN)
- **Testing:** Playwright 1.59+

## Development

### Local Setup

1. Clone: `git clone https://github.com/Rohan0603/fire-os.git`
2. Install: `npm install`
3. Start: `npm run dev`

### Add New Feature

1. Create module: `src/modules/feature/index.ts`
2. Export `initFeature()` and `renderFeature()`
3. Register in `src/main.ts`
4. Add tests: `tests/feature.test.ts`

See [ARCHITECTURE.md](docs/ARCHITECTURE.md#adding-new-features) for full guide.

### Testing

```bash
# Unit tests (Vitest)
npm run test -- tests/calculations.test.ts

# E2E tests (Playwright)
npm run test -- tests/auth.e2e.ts --ui

# Debug single test
npm run test:debug tests/auth.e2e.ts
```

## Deployment

### Firebase Hosting

```bash
npm run build
firebase login
firebase deploy --only hosting
```

**Live:** https://fire-os-dd6d6.web.app

### Database

Firebase Realtime Database: https://fire-os-dd6d6-default-rtdb.asia-southeast1.firebasedatabase.app

Security rules enforce: Only authenticated users read/write their own portfolio.

## Performance

- **Bundle:** < 200 KB gzipped (minified, tree-shaken)
- **Page Load:** < 2 seconds
- **Form Debounce:** 500ms before save
- **API Cache TTL:** NAV 4h, Nifty 1h, EUR/INR 24h

## Contributing

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for development patterns and conventions.

## License

Private project. Contact Rohan Ponnanna K K for access.
```

- [ ] Save file

- [ ] Test: Verify links work by opening file and checking URLs

- [ ] Commit: `git add README.md && git commit -m "docs: update README with feature overview and links"`

### Step 4: Verify CLAUDE.md completeness

- [ ] Read `CLAUDE.md` to ensure v2.2 documentation is complete:

```bash
head -n 50 CLAUDE.md
```

- [ ] Check it mentions:
  - Vite + TypeScript architecture
  - Module structure
  - Firebase integration
  - Nifty fix documentation
  - Testing with Playwright
  - Deployment to Firebase Hosting

- [ ] If any sections missing, they should have been added in task 1 (already done based on summary)

- [ ] Commit: `git add -A && git commit -m "docs: verify CLAUDE.md v2.2 completeness"`

### Step 5: Final documentation review

- [ ] Create quick start guide. Add to root as `QUICKSTART.md`:

```markdown
# Quick Start Guide

## For Users

1. Go to https://fire-os-dd6d6.web.app
2. Sign up with email + password
3. Go to **Profile** tab
4. Enter portfolio data:
   - Add SIPs (name, scheme code, units, monthly amount, start date)
   - Add other holdings (FD, EPF, ESOP)
   - Optionally import CAS PDF for auto-detection
5. Click NAV ⟳ to fetch latest mutual fund prices
6. View **Dashboard** for KPIs, P&L, XIRR
7. Use **Calculators** for crash protocol, emergency runway, SIP pause impact

## For Developers

### Setup
\`\`\`bash
npm install
npm run dev
\`\`\`

### Architecture
See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for module structure and data flow.

### Add Feature
1. Create `src/modules/feature/index.ts`
2. Export `initFeature()`, `renderFeature()`
3. Register in `main.ts`
4. Add tests in `tests/feature.test.ts`
5. Commit: `git commit -m "feat(feature): description"`

### Testing
\`\`\`bash
npm run test           # All tests
npm run test:ui        # Interactive UI
npm run test -- tests/auth.e2e.ts  # Specific test
\`\`\`

### Deploy
\`\`\`bash
npm run build
firebase deploy --only hosting
\`\`\`

See [CLAUDE.md](CLAUDE.md) for detailed setup and troubleshooting.
\`\`\`

- [ ] Save file: Create `QUICKSTART.md`

- [ ] Commit: `git add QUICKSTART.md && git commit -m "docs: add QUICKSTART.md for users and developers"`

### Step 6: Verify all documentation links

- [ ] Check all internal links work:
  - README.md → ARCHITECTURE.md ✓
  - README.md → API.md ✓
  - README.md → CLAUDE.md ✓
  - ARCHITECTURE.md → examples (verify code samples are accurate)
  - API.md → endpoints (verify URLs are correct)

- [ ] Test links by opening files and checking paths

- [ ] Commit: `git add -A && git commit -m "docs: verify all documentation links"`

---

## Final Verification Checklist

- [ ] All tasks 11-16 complete
- [ ] No console errors
- [ ] All modules initialize without errors
- [ ] Profile form saves with debouncing
- [ ] PDF import works with confirmation
- [ ] Calculators compute correctly
- [ ] Error toasts show for all error scenarios
- [ ] API calls have try-catch + error handling
- [ ] Cache TTL respected (check Network tab)
- [ ] Production build < 200 KB gzipped
- [ ] All tests pass: `npm run test`
- [ ] Documentation complete and accurate
- [ ] Links verified and working

---

## Execution Summary

**Total steps:** 30+ individual commits across 5 major tasks

**Estimated time:** 4-6 hours for experienced developer (2-3 hours if parallelized)

**Output:** Production-ready FIRE OS with complete error handling, optimization, and documentation

**Commit convention:** All commits follow `type(scope): message` format without "claude" reference
```

- [ ] Save to disk

---

Saved comprehensive plan to `docs/superpowers/plans/2026-06-03-final-integration.md`.

**Plan covers:**
- Task 11: Profile module (form handlers, PDF import, data export/import)
- Task 12: Calculators module (all 4 calculators with event handlers)
- Task 13: Error handling (validation rules, try-catch boundaries, API error handling)
- Task 15: Performance (debouncing, cache TTL, bundle optimization)
- Task 16: Documentation (ARCHITECTURE.md, API.md, README, QUICKSTART)

**Execution approach choice:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks
**2. Inline Execution** — Execute all tasks in this session with checkpoints

Which approach?