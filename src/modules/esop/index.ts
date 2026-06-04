import { D } from '../../main';
import { saveData } from '../../lib/storage';
import { fetchSocGenPrice } from '../api/esop';
import { fetchEURINR } from '../api/eurInr';
import { totalNetWorth } from '../dashboard/kpis';
import { formatCurrency } from '../../lib/formatters';
import './styles.css';

let moduleContainerId: string = 'esop';
const DEBOUNCE_MS = 500;
let debounceTimer: NodeJS.Timeout | null = null;

// Module level state for fetched values
let glePrice: number | null = null;
let eurInrRate: number | null = null;
let isFetching = false;
let fetchError: string | null = null;

// Calculator inputs state
let calcShares: number | null = null;
let calcVestingFmv: number | null = null;
let calcCurrentPrice: number | null = null;
let calcSlabRate = 30; // default 30%

export function initEsopModule(containerId: string) {
  moduleContainerId = containerId;
  const container = document.getElementById(containerId);
  if (!container) return;
  renderEsop(container);
}

export function renderEsop(container?: HTMLElement) {
  const targetContainer = container || document.getElementById(moduleContainerId);
  if (!targetContainer) return;

  // Initialize calculator inputs if they are null
  if (calcShares === null) calcShares = D.esopDetails.shares;
  if (calcVestingFmv === null) calcVestingFmv = D.esopDetails.grantPrice;

  // Trigger live fetching if data is not loaded and not in flight
  if (glePrice === null && eurInrRate === null && !isFetching) {
    isFetching = true;
    fetchError = null;

    targetContainer.innerHTML = `
      <div class="esop-container loading-container">
        <div class="loader-circle"></div>
        <p class="loader-text">Fetching live Societe Generale (GLE.PA) price & EUR/INR rates...</p>
      </div>
    `;

    Promise.all([fetchSocGenPrice(), fetchEURINR()])
      .then(([price, rate]) => {
        glePrice = price || 24.50; // Fallback price
        eurInrRate = rate || 90.00; // Fallback rate
        isFetching = false;

        if (calcCurrentPrice === null) {
          calcCurrentPrice = glePrice;
        }

        // Sync valuation to main state
        const computedInrValue = D.esopDetails.shares * glePrice * eurInrRate;
        D.esop.esop = { amount: computedInrValue, currency: 'INR' };
        saveData(D);

        renderEsop(targetContainer);
      })
      .catch((err) => {
        console.error('Error loading live ESOP data:', err);
        fetchError = 'Unable to fetch live market data. Using fallbacks.';
        glePrice = glePrice || 24.50;
        eurInrRate = eurInrRate || 90.00;
        isFetching = false;
        
        if (calcCurrentPrice === null) {
          calcCurrentPrice = glePrice;
        }
        
        renderEsop(targetContainer);
      });
    return;
  }

  // 1. Live Valuation & Exchange Rate Calculations
  const finalPrice = glePrice || 24.50;
  const finalRate = eurInrRate || 90.00;
  const grossInr = D.esopDetails.shares * finalPrice * finalRate;
  
  // Calculate percentage of net worth
  const { netWorth } = totalNetWorth(D);
  const percentNetWorth = netWorth > 0 ? (grossInr / netWorth) * 100 : 0;

  // 2. Vesting schedule calculations
  const schedule = [...D.esopDetails.vestingSchedule].sort((a, b) => a.date.localeCompare(b.date));
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-indexed

  let vestedShares = 0;
  let lockedShares = 0;

  const processedSchedule = schedule.map(item => {
    const [itemYear, itemMonth] = item.date.split('-').map(Number);
    // Compare YYYY-MM
    const isVested = itemYear < currentYear || (itemYear === currentYear && itemMonth <= currentMonth);

    if (isVested) {
      vestedShares += item.shares;
    } else {
      lockedShares += item.shares;
    }

    return {
      date: item.date,
      shares: item.shares,
      status: isVested ? 'Vested' : 'Pending',
      isVested
    };
  });

  const nextUnlockItem = processedSchedule.find(item => !item.isVested);
  const nextUnlockText = nextUnlockItem 
    ? `${nextUnlockItem.date} (${nextUnlockItem.shares} shares)`
    : 'All shares vested';

  const vestedPercent = D.esopDetails.shares > 0 ? (vestedShares / D.esopDetails.shares) * 100 : 0;

  // 3. Trigger Monitor Calculations
  const yearsRemaining = 2031 - currentYear;
  const rule5YearFired = currentYear >= 2031;
  const marriageFired = D.esopDetails.triggers.marriage;
  const childFired = D.esopDetails.triggers.childBirth;
  const jobFired = D.esopDetails.triggers.jobChange;
  const coorgFired = D.esopDetails.triggers.coorgConstruction;

  const anyTriggerFired = rule5YearFired || marriageFired || childFired || jobFired || coorgFired;

  // Check if Coorg Goal is active
  const isCoorgGoalActive = D.coorgTarget > 0;
  const coorgStatusText = isCoorgGoalActive 
    ? `Coorg Goal Active: ₹${(D.coorgCorpus / 100000).toFixed(1)}L saved towards ₹${(D.coorgTarget / 10000000).toFixed(1)}Cr target`
    : 'Coorg Construction Scheduled';

  // Construct UI HTML
  let html = `
    <div class="esop-container">
      <div class="esop-header">
        <div>
          <h2>ESOP Valuation & Liquidation Planner</h2>
          <p class="esop-subtitle">Manage, track, and plan Societe Generale (GLE.PA) employee shares</p>
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
              ${rule5YearFired ? '<li><strong>5-Year Holding Period Rule:</strong> 2031 milestone reached (Auto-Alert). Reduce single-stock concentration.</li>' : ''}
              ${marriageFired ? '<li><strong>Marriage Goal:</strong> Triggered. Liquidate shares to meet upcoming expenses.</li>' : ''}
              ${childFired ? '<li><strong>Child Birth:</strong> Triggered. Realize funds for family expansion needs.</li>' : ''}
              ${jobFired ? '<li><strong>Leaving Societe Generale (Job Change):</strong> Triggered. Vested options must be exercised/liquidated within post-employment window to avoid forfeiture.</li>' : ''}
              ${coorgFired ? `<li><strong>Coorg Construction:</strong> Triggered. Allocate up to ₹5.00L to Coorg construction goal.</li>` : ''}
            </ul>
            <div class="alert-recommendation">
              <strong>Recommended Strategy:</strong> 
              ${jobFired 
                ? 'Liquidate vested shares immediately or within 90 days of exit. Account for perquisite tax on exercise FMV, and deploy net proceeds according to the plan.' 
                : coorgFired 
                  ? 'Proceed with liquidating vested shares up to ₹5.00L for the Coorg construction fund. Invest any surplus in the diversified mutual funds.'
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
            <span class="value-lakhs">${(grossInr / 100000).toFixed(2)}L</span>
            <span class="value-currency">INR</span>
          </div>
          <div class="valuation-meta">
            <div class="meta-row">
              <span>Shares Owned</span>
              <strong>${D.esopDetails.shares} shares</strong>
            </div>
            <div class="meta-row">
              <span>GLE.PA Price</span>
              <strong>€${finalPrice.toFixed(2)}</strong>
            </div>
            <div class="meta-row">
              <span>Net Worth Allocation</span>
              <strong>${percentNetWorth.toFixed(2)}%</strong>
            </div>
            <div class="meta-row border-top">
              <span>Vested Shares</span>
              <span class="text-success">${vestedShares} shares</span>
            </div>
            <div class="meta-row">
              <span>Locked Shares</span>
              <span class="text-warning">${lockedShares} shares</span>
            </div>
            <div class="meta-row">
              <span>Next Unlock</span>
              <strong>${nextUnlockText}</strong>
            </div>
          </div>
          
          <div class="fx-section">
            <div class="fx-header">
              <span>EUR/INR Exchange Rate</span>
              <span class="fx-change text-success">+2.3% (12m)</span>
            </div>
            <div class="fx-value">1 € = ₹${finalRate.toFixed(2)}</div>
          </div>
        </div>

        <!-- Trigger Monitor Card -->
        <div class="esop-card triggers-card">
          <h3>Trigger Monitor</h3>
          <p class="section-desc">Manage milestones that trigger share liquidation</p>
          
          <div class="triggers-grid">
            <div class="trigger-item ${rule5YearFired ? 'fired' : ''}">
              <div class="trigger-header">
                <span class="trigger-title">5-Year Holding Rule</span>
                <span class="trigger-badge ${rule5YearFired ? 'active' : ''}">
                  ${rule5YearFired ? 'Auto-Alert' : `${yearsRemaining}y remaining`}
                </span>
              </div>
              <p class="trigger-desc">Triggers auto-alert in 2031 to avoid over-concentration.</p>
            </div>
            
            <div class="trigger-item ${coorgFired ? 'fired' : ''}">
              <div class="trigger-header">
                <span class="trigger-title">Coorg Construction</span>
                <label class="toggle-switch">
                  <input type="checkbox" id="trigger-coorg" ${coorgFired ? 'checked' : ''}>
                  <span class="slider"></span>
                </label>
              </div>
              <p class="trigger-desc">${coorgStatusText}</p>
            </div>

            <div class="trigger-item ${marriageFired ? 'fired' : ''}">
              <div class="trigger-header">
                <span class="trigger-title">Marriage Plan</span>
                <label class="toggle-switch">
                  <input type="checkbox" id="trigger-marriage" ${marriageFired ? 'checked' : ''}>
                  <span class="slider"></span>
                </label>
              </div>
              <p class="trigger-desc">Toggle when wedding timeline is finalized.</p>
            </div>

            <div class="trigger-item ${childFired ? 'fired' : ''}">
              <div class="trigger-header">
                <span class="trigger-title">Child Birth</span>
                <label class="toggle-switch">
                  <input type="checkbox" id="trigger-child" ${childFired ? 'checked' : ''}>
                  <span class="slider"></span>
                </label>
              </div>
              <p class="trigger-desc">Toggle to align liquidation with family goals.</p>
            </div>

            <div class="trigger-item ${jobFired ? 'fired' : ''}">
              <div class="trigger-header">
                <span class="trigger-title">Leaving SocGen (Job Change)</span>
                <label class="toggle-switch">
                  <input type="checkbox" id="trigger-job" ${jobFired ? 'checked' : ''}>
                  <span class="slider"></span>
                </label>
              </div>
              <p class="trigger-desc">Toggle upon submitting resignation.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="esop-grid secondary-grid">
        <!-- Vesting Schedule Card -->
        <div class="esop-card vesting-card">
          <h3>Vesting Schedule & Progress</h3>
          
          <div class="progress-section">
            <div class="progress-labels">
              <span>Vesting Progress</span>
              <strong>${vestedPercent.toFixed(1)}% Vested</strong>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill vested" style="width: ${vestedPercent}%"></div>
              <div class="progress-bar-fill locked" style="width: ${100 - vestedPercent}%"></div>
            </div>
            <div class="progress-legend">
              <span class="legend-item"><span class="dot vested"></span>Vested (${vestedShares} shares)</span>
              <span class="legend-item"><span class="dot locked"></span>Locked (${lockedShares} shares)</span>
            </div>
          </div>

          <table class="vesting-table">
            <thead>
              <tr>
                <th>Vest Date</th>
                <th>Shares</th>
                <th>Status</th>
                <th>Cumulative Vested</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                let runningVested = 0;
                return processedSchedule.map(item => {
                  if (item.isVested) {
                    runningVested += item.shares;
                  }
                  return `
                    <tr class="${item.isVested ? 'row-vested' : 'row-pending'}">
                      <td>${item.date}</td>
                      <td>${item.shares}</td>
                      <td>
                        <span class="status-pill ${item.status.toLowerCase()}">${item.status}</span>
                      </td>
                      <td>${item.isVested ? `${runningVested} shares` : '-'}</td>
                    </tr>
                  `;
                }).join('');
              })()}
            </tbody>
          </table>
        </div>

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
                <label for="calc-fmv">Vesting FMV (€)</label>
                <input type="number" id="calc-fmv" value="${calcVestingFmv || ''}" placeholder="e.g. 45">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="calc-price">Current Price (€)</label>
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
                <span class="result-label">Perquisite Tax (Slab)</span>
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
  const marriageToggle = document.getElementById('trigger-marriage') as HTMLInputElement;
  const childToggle = document.getElementById('trigger-child') as HTMLInputElement;
  const jobToggle = document.getElementById('trigger-job') as HTMLInputElement;
  const coorgToggle = document.getElementById('trigger-coorg') as HTMLInputElement;

  const handleTriggerChange = () => {
    D.esopDetails.triggers.marriage = marriageToggle ? marriageToggle.checked : false;
    D.esopDetails.triggers.childBirth = childToggle ? childToggle.checked : false;
    D.esopDetails.triggers.jobChange = jobToggle ? jobToggle.checked : false;
    D.esopDetails.triggers.coorgConstruction = coorgToggle ? coorgToggle.checked : false;

    debounceSave();
  };

  marriageToggle?.addEventListener('change', handleTriggerChange);
  childToggle?.addEventListener('change', handleTriggerChange);
  jobToggle?.addEventListener('change', handleTriggerChange);
  coorgToggle?.addEventListener('change', handleTriggerChange);

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

      updateCalculationUI();
    }
  };

  sharesInput?.addEventListener('input', handleTaxCalcInput);
  vestingFmvInput?.addEventListener('input', handleTaxCalcInput);
  currentPriceInput?.addEventListener('input', handleTaxCalcInput);
  slabRateInput?.addEventListener('input', handleTaxCalcInput);

  // Manual refresh button handler
  const refreshBtn = document.getElementById('esop-refresh-btn');
  refreshBtn?.addEventListener('click', () => {
    glePrice = null;
    eurInrRate = null;
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

function debounceSave() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    saveData(D);
    renderEsop();
  }, DEBOUNCE_MS);
}

function calculateTaxAndDeployment() {
  const shares = calcShares ?? D.esopDetails.shares;
  const vestingFmv = calcVestingFmv ?? D.esopDetails.grantPrice;
  const currentPrice = calcCurrentPrice ?? (glePrice || 24.50);
  const slabRate = calcSlabRate;
  const rate = eurInrRate || 90.00;

  const gross = shares * currentPrice * rate;
  const perquisiteTax = shares * vestingFmv * rate * (slabRate / 100);
  const priceDiff = Math.max(0, currentPrice - vestingFmv);
  const ltcgTax = shares * priceDiff * rate * 0.125;
  const netRealized = gross - perquisiteTax - ltcgTax;

  const coorgActive = D.esopDetails.triggers.coorgConstruction;
  let coorgAlloc = 0;
  let remainder = netRealized;
  
  if (coorgActive) {
    coorgAlloc = Math.min(500000, netRealized);
    remainder = netRealized - coorgAlloc;
  }

  const ppfcfAlloc = remainder * 0.40;
  const nipponGrowthAlloc = remainder * 0.30;
  const nipponSmallCapAlloc = remainder * 0.20;
  const goldEtfAlloc = remainder * 0.10;

  return {
    gross,
    perquisiteTax,
    ltcgTax,
    netRealized,
    coorgAlloc,
    ppfcfAlloc,
    nipponGrowthAlloc,
    nipponSmallCapAlloc,
    goldEtfAlloc
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
    const isCoorgActive = D.esopDetails.triggers.coorgConstruction;
    
    let html = '';
    
    if (isCoorgActive) {
      html += `
        <div class="deploy-item highlight">
          <div class="deploy-info">
            <span class="deploy-name">🏠 Coorg Construction Allocation</span>
            <span class="deploy-desc">Max ₹5.00L prioritized for Coorg property construction.</span>
          </div>
          <span class="deploy-value">${formatRupeesAndLakhs(results.coorgAlloc)}</span>
        </div>
      `;
    }
    
    html += `
      <div class="deploy-item">
        <div class="deploy-info">
          <span class="deploy-name">📈 PPFCF (Parag Parikh Flexi Cap Fund) - 40%</span>
          <span class="deploy-desc">Core equity allocation for compounding.</span>
        </div>
        <span class="deploy-value">${formatRupeesAndLakhs(results.ppfcfAlloc)}</span>
      </div>
      <div class="deploy-item">
        <div class="deploy-info">
          <span class="deploy-name">🏢 Nippon Growth Fund - 30%</span>
          <span class="deploy-desc">Large & mid-cap growth exposure.</span>
        </div>
        <span class="deploy-value">${formatRupeesAndLakhs(results.nipponGrowthAlloc)}</span>
      </div>
      <div class="deploy-item">
        <div class="deploy-info">
          <span class="deploy-name">🚀 Nippon India Small Cap Fund - 20%</span>
          <span class="deploy-desc">High-growth small cap exposure.</span>
        </div>
        <span class="deploy-value">${formatRupeesAndLakhs(results.nipponSmallCapAlloc)}</span>
      </div>
      <div class="deploy-item">
        <div class="deploy-info">
          <span class="deploy-name">🪙 Gold ETF - 10%</span>
          <span class="deploy-desc">Safe-haven hedge.</span>
        </div>
        <span class="deploy-value">${formatRupeesAndLakhs(results.goldEtfAlloc)}</span>
      </div>
    `;
    deployContainer.innerHTML = html;
  }
}

function formatRupeesAndLakhs(amount: number): string {
  if (amount < 0) amount = 0;
  const lakhs = amount / 100000;
  const formatter = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0
  });
  return `₹${formatter.format(Math.round(amount))} (${lakhs.toFixed(2)}L)`;
}
