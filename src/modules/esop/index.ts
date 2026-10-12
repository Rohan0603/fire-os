import { createFeatureContext, type FeatureContext } from '../../core/feature-context';
import type { EsopValuation } from '../api/esop';
import { DEFAULT_FUND_BUCKETS } from '../../lib/fundMatcher';
import './styles.css';

let moduleContainerId: string = 'esop';
let activeContext = createFeatureContext();
let D = activeContext.state;
const DEBOUNCE_MS = 500;
let debounceTimer: NodeJS.Timeout | null = null;

// Module level state for fetched values
let valuationResults: EsopValuation[] = [];
let hasFetchedValuations = false;
let isFetching = false;
let fetchError: string | null = null;

// Calculator inputs state
let calcShares: number | null = null;
let calcVestingFmv: number | null = null;
let calcCurrentPrice: number | null = null;
let calcSlabRate = 30; // default 30%

export function initEsopModule(containerId: string, context: FeatureContext = activeContext) {
  moduleContainerId = containerId;
  activeContext = context;
  D = context.state;
  valuationResults = [];
  hasFetchedValuations = false;
  isFetching = false;
  fetchError = null;
  const container = document.getElementById(containerId);
  if (!container) return;
  renderEsop(container, context);
}

export function renderEsop(container?: HTMLElement, context: FeatureContext = activeContext) {
  activeContext = context;
  D = context.state;
  const targetContainer = container || document.getElementById(moduleContainerId);
  if (!targetContainer) return;

  // Initialize calculator inputs if they are null
  if (calcShares === null) calcShares = D.esopDetails.liquidationShares ?? D.esopDetails.shares;
  if (calcVestingFmv === null) calcVestingFmv = D.esopDetails.vestingFmv ?? D.esopDetails.grantPrice;
  if (calcCurrentPrice === null && D.esopDetails.currentPrice !== undefined) calcCurrentPrice = D.esopDetails.currentPrice;
  calcSlabRate = D.profile.taxSlabRate ?? calcSlabRate;

  // Trigger live fetching if data is not loaded and not in flight
  if (!hasFetchedValuations && !isFetching) {
    isFetching = true;
    fetchError = null;

    targetContainer.innerHTML = `
      <div class="esop-container loading-container">
        <div class="loader-circle"></div>
        <p class="loader-text">Fetching live stock prices and currency rates...</p>
      </div>
    `;

    context.ports.marketData.fetchEsopValuations(D.esopDetails.holdings || [])
      .then((results) => {
        valuationResults = results;
        hasFetchedValuations = true;
        isFetching = false;

        if (calcCurrentPrice === null) {
          calcCurrentPrice = results.find(({ quote }) => quote !== null)?.quote?.price ?? null;
        }

        // Sync valuation to main state
        const computedInrValue = results.reduce((total, { value }) => total + (value ?? 0), 0);
        D.esop.esop = { amount: computedInrValue, currency: 'INR' };
        context.portfolio.save(D);

        renderEsop(targetContainer);
      })
      .catch((err) => {
        console.error('Error loading live ESOP data:', err);
        fetchError = 'Unable to fetch live market data.';
        hasFetchedValuations = true;
        isFetching = false;
        renderEsop(targetContainer);
      });
    return;
  }

  // 1. Live Valuation & Exchange Rate Calculations
  const firstValuation = valuationResults.find(({ quote }) => quote !== null);
  const finalRate = firstValuation?.rate ?? null;
  const displayCurrency = firstValuation?.holding.currency ?? D.esopDetails.holdings?.[0]?.currency ?? 'local currency';
  const grossInr = D.esop.esop?.amount ?? valuationResults.reduce(
    (total, { value }) => total + (value ?? 0),
    0,
  );
  
  // Calculate percentage of net worth
  const { netWorth } = context.ports.calculations.totalNetWorth(D);
  const percentNetWorth = netWorth > 0 ? (grossInr / netWorth) * 100 : 0;

  // 2. Trigger Monitor Calculations (general liquidation rules)
  const currentYear = new Date().getFullYear();
  // LTCG holding-period milestone: configured years measured from the earliest
  // vesting date (default 5 years).
  const holdingPeriodYears = D.esopDetails.holdingPeriodYears ?? 5;
  const vestingYears = (D.esopDetails.vestingSchedule ?? [])
    .map((item) => Number(String(item.date).slice(0, 4)))
    .filter((year) => Number.isFinite(year));
  const startYear = vestingYears.length ? Math.min(...vestingYears) : currentYear;
  const milestoneYear = startYear + holdingPeriodYears;
  const yearsRemaining = Math.max(0, milestoneYear - currentYear);
  const rule5YearFired = currentYear >= milestoneYear;

  const rules = D.liquidationRules ?? [];
  const activeRules = rules.filter((rule) => rule.active);
  const jobFired = activeRules.some((rule) => rule.kind === 'jobChange');
  const goalFired = activeRules.find((rule) => rule.kind === 'goal');
  const anyTriggerFired = rule5YearFired || activeRules.length > 0;

  const ruleMessage = (rule: typeof rules[number]): string => {
    switch (rule.kind) {
      case 'marriage':
        return '<strong>Marriage Goal:</strong> Triggered. Liquidate shares to meet upcoming expenses.';
      case 'childBirth':
        return '<strong>Child Birth:</strong> Triggered. Realize funds for family expansion needs.';
      case 'jobChange':
        return '<strong>Employment Change:</strong> Triggered. Vested options may need to be exercised or liquidated within the post-employment window to avoid forfeiture.';
      case 'goal':
        return `<strong>${rule.label}:</strong> Triggered. Allocate${rule.allocateAmount ? ` up to ${formatRupeesAndLakhs(rule.allocateAmount)}` : ' proceeds'} to the ${rule.label} goal.`;
      default:
        return `<strong>${rule.label}:</strong> Triggered.`;
    }
  };

  const ruleDescription = (rule: typeof rules[number]): string => {
    if (rule.note) return rule.note;
    switch (rule.kind) {
      case 'marriage':
        return 'Toggle when wedding timeline is finalized.';
      case 'childBirth':
        return 'Toggle to align liquidation with family goals.';
      case 'jobChange':
        return 'Toggle upon submitting resignation.';
      case 'goal':
        return `Funds the ${rule.label} goal.`;
      case 'holdingPeriod':
        return 'Toggle when the holding period milestone is reached.';
      default:
        return 'Custom liquidation rule.';
    }
  };

  // Construct UI HTML
  let html = `
    <div class="esop-container">
      <div class="esop-header">
        <div>
          <h2>ESOP Valuation & Liquidation Planner</h2>
          <p class="esop-subtitle">Manage, track, and plan employee stock holdings</p>
        </div>
        <button id="esop-refresh-btn" class="btn-refresh" title="Refresh live rates">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Refresh Live Data
        </button>
      </div>

      ${fetchError ? `<div class="esop-alert warning">${fetchError}</div>` : ''}

      <!-- Flash Alert Banner (Visible only if triggers fire) -->
      ${anyTriggerFired ? `
        <div class="flash-alert animate-pulse">
          <div class="alert-icon">⚠️</div>
          <div class="alert-content">
            <h3>Active Liquidation Trigger Event(s) Detected</h3>
            <ul class="active-triggers-list">
              ${rule5YearFired ? `<li><strong>${holdingPeriodYears}-Year Holding Period Rule:</strong> ${milestoneYear} milestone reached (Auto-Alert). Reduce single-stock concentration.</li>` : ''}
              ${activeRules.map((rule) => `<li>${ruleMessage(rule)}</li>`).join('')}
            </ul>
            <div class="alert-recommendation">
              <strong>Recommended Strategy:</strong> 
              ${jobFired 
                ? 'Review vested shares immediately or within 90 days of exit. Account for applicable India tax on exercise FMV, and deploy net proceeds according to the plan.'
                : goalFired 
                  ? `Proceed with liquidating vested shares to fund the ${goalFired.label} goal${goalFired.allocateAmount ? ` (up to ${formatRupeesAndLakhs(goalFired.allocateAmount)})` : ''}. Invest any surplus in the diversified mutual funds.`
                  : 'Liquidate vested shares to fund your short-to-medium-term goals, or rebalance into the recommended asset allocation model below to manage downside risk.'
              }
            </div>
          </div>
        </div>
      ` : ''}

      <div class="esop-grid">
        <!-- Live Valuation Card -->
        <div class="esop-card valuation-card">
          <div class="card-header">
            <h3>Live Valuation</h3>
            <span class="badge live">Live</span>
          </div>
          <div class="valuation-primary">
            <span class="value-lakhs">${(grossInr / 100000).toFixed(0)}L</span>
            <span class="value-currency">INR</span>
          </div>
          <div class="valuation-meta">
            <div class="meta-row">
              <span>Holdings</span>
              <strong>${D.esopDetails.holdings?.length || 0} positions</strong>
            </div>
            <div class="meta-row">
              <span>Total Quantity</span>
              <strong>${D.esopDetails.shares} shares</strong>
            </div>
            <div class="meta-row">
              <span>Net Worth Allocation</span>
              <strong>${percentNetWorth.toFixed(0)}%</strong>
            </div>
          </div>
          
          <div class="fx-section">
            <div class="fx-header">
              <span>${displayCurrency}/INR Conversion</span>
              <span class="fx-change text-success">+2.3% (12m)</span>
            </div>
            <div class="fx-value">1 ${displayCurrency} = ${finalRate === null ? 'Unavailable' : `₹${finalRate.toFixed(2)}`}</div>
          </div>
        </div>

        <!-- Trigger Monitor Card -->
        <div class="esop-card triggers-card">
          <h3>Trigger Monitor</h3>
          <p class="section-desc">Manage milestones that trigger share liquidation</p>
          
          <div class="triggers-grid">
            <div class="trigger-item ${rule5YearFired ? 'fired' : ''}">
              <div class="trigger-header">
                <span class="trigger-title">${holdingPeriodYears}-Year Holding Rule</span>
                <span class="trigger-badge ${rule5YearFired ? 'active' : ''}">
                  ${rule5YearFired ? 'Auto-Alert' : `${yearsRemaining}y remaining`}
                </span>
              </div>
              <p class="trigger-desc">Triggers auto-alert in ${milestoneYear} to review single-stock concentration.</p>
            </div>

            ${rules.map((rule) => `
            <div class="trigger-item ${rule.active ? 'fired' : ''}">
              <div class="trigger-header">
                <span class="trigger-title">${rule.label}</span>
                <label class="toggle-switch">
                  <input type="checkbox" id="trigger-${rule.id}" ${rule.active ? 'checked' : ''}>
                  <span class="slider"></span>
                </label>
              </div>
              <p class="trigger-desc">${ruleDescription(rule)}</p>
            </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="esop-grid secondary-grid">
        <!-- Tax Calculator & Liquidation Planner Card -->
        <div class="esop-card planner-card">
          <h3>Tax Calculator & Liquidation Planner</h3>
          <p class="section-desc">Estimate proceeds, perquisite and capital gains taxes, and model reinvestment</p>
          
          <form class="planner-form" onsubmit="event.preventDefault();">
            <div class="form-row">
              <div class="form-group">
                <label for="calc-shares">Shares to Liquidate</label>
                <input type="number" id="calc-shares" value="${calcShares || ''}" placeholder="e.g. 95">
              </div>
              <div class="form-group">
                <label for="calc-fmv">Vesting FMV (${displayCurrency})</label>
                <input type="number" id="calc-fmv" value="${calcVestingFmv || ''}" placeholder="e.g. 45">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="calc-price">Current Price (${displayCurrency})</label>
                <input type="number" id="calc-price" value="${calcCurrentPrice || ''}" placeholder="e.g. 65.72">
              </div>
              <div class="form-group">
                <label for="calc-slab">Income Tax Slab Rate (%)</label>
                <input type="number" id="calc-slab" value="${calcSlabRate}" placeholder="e.g. 30">
              </div>
            </div>
          </form>

          <div id="calc-errors"></div>

          <div class="planner-results">
            <h4>Tax Calculation Breakdown</h4>
            <div class="results-grid">
              <div class="result-box">
                <span class="result-label">Gross Sale Value</span>
                <span id="res-gross" class="result-value">-</span>
              </div>
              <div class="result-box warning">
                <span class="result-label">India Perquisite Tax (Slab)</span>
                <span id="res-perq" class="result-value text-danger">-</span>
              </div>
              <div class="result-box warning">
                <span class="result-label">LTCG Tax (12.5%)</span>
                <span id="res-ltcg" class="result-value text-danger">-</span>
              </div>
              <div class="result-box highlight">
                <span class="result-label">Net Realized Value</span>
                <span id="res-net" class="result-value text-success">-</span>
              </div>
            </div>
          </div>

          <div class="deployment-plan">
            <h4>Target Reinvestment & Deployment</h4>
            <div id="deployment-plan-list" class="deploy-list">
              <!-- Rendered dynamically -->
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  targetContainer.innerHTML = html;

  // Initial calculations display
  updateCalculationUI();

  // Attach handlers
  attachEsopHandlers();
}

function attachEsopHandlers() {
  const handleRuleToggle = (ruleId: string, checked: boolean) => {
    const rule = D.liquidationRules.find((candidate) => candidate.id === ruleId);
    if (rule) rule.active = checked;

    // Trigger toggles change the trigger-status list rendered by the template,
    // so this path still needs the full re-render.
    debounceSave(true);
  };

  for (const rule of D.liquidationRules) {
    const toggle = document.getElementById(`trigger-${rule.id}`) as HTMLInputElement | null;
    toggle?.addEventListener('change', () => handleRuleToggle(rule.id, toggle.checked));
  }

  // Tax Calculator inputs handlers
  const sharesInput = document.getElementById('calc-shares') as HTMLInputElement;
  const vestingFmvInput = document.getElementById('calc-fmv') as HTMLInputElement;
  const currentPriceInput = document.getElementById('calc-price') as HTMLInputElement;
  const slabRateInput = document.getElementById('calc-slab') as HTMLInputElement;

  const handleTaxCalcInput = () => {
    const sharesVal = parseFloat(sharesInput.value);
    const fmvVal = parseFloat(vestingFmvInput.value);
    const priceVal = parseFloat(currentPriceInput.value);
    const slabVal = parseFloat(slabRateInput.value);

    let hasError = false;

    if (isNaN(sharesVal) || sharesVal < 0) {
      showInputError(sharesInput, 'Shares must be positive');
      hasError = true;
    } else {
      clearInputError(sharesInput);
    }

    if (isNaN(fmvVal) || fmvVal < 0) {
      showInputError(vestingFmvInput, 'Vesting FMV must be positive');
      hasError = true;
    } else {
      clearInputError(vestingFmvInput);
    }

    if (isNaN(priceVal) || priceVal < 0) {
      showInputError(currentPriceInput, 'Price must be positive');
      hasError = true;
    } else {
      clearInputError(currentPriceInput);
    }

    if (isNaN(slabVal) || slabVal < 0 || slabVal > 100) {
      showInputError(slabRateInput, 'Slab must be 0-100%');
      hasError = true;
    } else {
      clearInputError(slabRateInput);
    }

    if (!hasError) {
      calcShares = sharesVal;
      calcVestingFmv = fmvVal;
      calcCurrentPrice = priceVal;
      calcSlabRate = slabVal;
      D.esopDetails.liquidationShares = sharesVal;
      D.esopDetails.vestingFmv = fmvVal;
      D.esopDetails.currentPrice = priceVal;
      D.esopDetails.slabRate = slabVal;

      updateCalculationUI();
      debounceSave();
    }
  };

  sharesInput?.addEventListener('input', handleTaxCalcInput);
  vestingFmvInput?.addEventListener('input', handleTaxCalcInput);
  currentPriceInput?.addEventListener('input', handleTaxCalcInput);
  slabRateInput?.addEventListener('input', handleTaxCalcInput);

  // Manual refresh button handler
  const refreshBtn = document.getElementById('esop-refresh-btn');
  refreshBtn?.addEventListener('click', () => {
    valuationResults = [];
    hasFetchedValuations = false;
    renderEsop();
  });
}

function showInputError(input: HTMLInputElement, message: string) {
  input.classList.add('input-error');
  let errorEl = input.nextElementSibling as HTMLElement;
  if (!errorEl || !errorEl.classList.contains('error-msg')) {
    errorEl = document.createElement('span');
    errorEl.className = 'error-msg';
    input.parentNode?.insertBefore(errorEl, input.nextSibling);
  }
  errorEl.textContent = message;
}

function clearInputError(input: HTMLInputElement) {
  input.classList.remove('input-error');
  const errorEl = input.nextElementSibling;
  if (errorEl && errorEl.classList.contains('error-msg')) {
    errorEl.remove();
  }
}

function debounceSave(reRender = false) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    activeContext.portfolio.save(D);
    // Only re-render when the caller needs template-level output (trigger list).
    // The tax-calculator inputs call updateCalculationUI() directly, so a
    // re-render here would replace the very input being typed into and drop focus.
    if (reRender) renderEsop();
  }, DEBOUNCE_MS);
}

function calculateTaxAndDeployment() {
  const shares = calcShares ?? D.esopDetails.shares;
  const vestingFmv = calcVestingFmv ?? D.esopDetails.grantPrice;
  const primaryValuation = valuationResults.find(({ quote }) => quote !== null);
  const currentPrice = calcCurrentPrice ?? primaryValuation?.quote?.price ?? 0;
  const slabRate = calcSlabRate;
  const rate = primaryValuation?.rate ?? 1;

  const gross = shares * currentPrice * rate;
  const perquisiteTax = shares * vestingFmv * rate * (slabRate / 100);
  const priceDiff = Math.max(0, currentPrice - vestingFmv);
  const ltcgTax = shares * priceDiff * rate * 0.125;
  const netRealized = gross - perquisiteTax - ltcgTax;

  // Fund active goal-linked rules from the net proceeds, in list order, before
  // the diversified allocation split.
  let remainder = netRealized;
  const goalAllocations: Array<{ label: string; amount: number }> = [];
  for (const rule of D.liquidationRules) {
    if (!rule.active || rule.kind !== 'goal' || !rule.allocateAmount || rule.allocateAmount <= 0) continue;
    const amount = Math.min(rule.allocateAmount, remainder);
    if (amount <= 0) continue;
    goalAllocations.push({ label: rule.label, amount });
    remainder -= amount;
  }

  // Split the remaining proceeds across the user's fund buckets, proportional to
  // their configured target percentages (equal split when none are set).
  const buckets = D.fundBuckets?.length ? D.fundBuckets : DEFAULT_FUND_BUCKETS;
  const targetSum = buckets.reduce((sum, bucket) => sum + (bucket.targetPercent || 0), 0);
  const weightOf = (bucket: (typeof buckets)[number]) =>
    targetSum > 0 ? bucket.targetPercent / targetSum : 1 / buckets.length;
  const bucketAllocations = buckets.map((bucket) => ({
    label: bucket.label,
    percent: Math.round(weightOf(bucket) * 1000) / 10,
    amount: remainder * weightOf(bucket),
  }));

  return {
    gross,
    perquisiteTax,
    ltcgTax,
    netRealized,
    goalAllocations,
    bucketAllocations,
  };
}

function updateCalculationUI() {
  const results = calculateTaxAndDeployment();

  const grossEl = document.getElementById('res-gross');
  const perqEl = document.getElementById('res-perq');
  const ltcgEl = document.getElementById('res-ltcg');
  const netEl = document.getElementById('res-net');

  if (grossEl) grossEl.textContent = formatRupeesAndLakhs(results.gross);
  if (perqEl) perqEl.textContent = formatRupeesAndLakhs(results.perquisiteTax);
  if (ltcgEl) ltcgEl.textContent = formatRupeesAndLakhs(results.ltcgTax);
  if (netEl) netEl.textContent = formatRupeesAndLakhs(results.netRealized);

  const deployContainer = document.getElementById('deployment-plan-list');
  if (deployContainer) {
    let html = results.goalAllocations
      .map(
        (allocation) => `
        <div class="deploy-item highlight">
          <div class="deploy-info">
            <span class="deploy-name">🏠 ${allocation.label} Allocation</span>
            <span class="deploy-desc">Prioritized towards the ${allocation.label} goal.</span>
          </div>
          <span class="deploy-value">${formatRupeesAndLakhs(allocation.amount)}</span>
        </div>
      `,
      )
      .join('');
    
    html += results.bucketAllocations
      .map(
        (allocation) => `
        <div class="deploy-item">
          <div class="deploy-info">
            <span class="deploy-name">${allocation.label} - ${allocation.percent}%</span>
            <span class="deploy-desc">Diversified allocation into your ${allocation.label} bucket.</span>
          </div>
          <span class="deploy-value">${formatRupeesAndLakhs(allocation.amount)}</span>
        </div>
      `,
      )
      .join('');

    deployContainer.innerHTML = html;
  }
}

function formatRupeesAndLakhs(amount: number): string {
  if (amount <= 0) return '₹0';
  const lakhs = amount / 100000;
  const formatter = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0
  });
  return `₹${formatter.format(Math.round(amount))} (${lakhs.toFixed(1)}L)`;
}
