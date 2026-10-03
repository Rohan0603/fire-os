/**
 * Calculators Module
 * Provides financial calculators: Crash Protocol, Emergency Runway, SIP Pause
 */

import { formatCurrency } from '../../lib/formatters';
import { createFeatureContext, type FeatureContext } from '../../core/feature-context';
import './styles.css';
import { initTaxModule } from './tax';
import { executeMonthlyWithdrawal } from './swp-scheduler';

let activeContext = createFeatureContext();
let D = activeContext.state;

export function initCalculatorsModule(containerId: string, context: FeatureContext = activeContext) {
  activeContext = context;
  D = context.state;
  const container = document.getElementById(containerId);
  if (!container) return;
  renderCalculators(container, context);
  autoFetchNiftyData();
}

// Auto-fetch Nifty data on init
async function autoFetchNiftyData() {
  try {
    const niftyData = await activeContext.ports.marketData.fetchNifty();
    if (niftyData) {
      D.niftyHigh = niftyData.high52w;
      D.niftyData = niftyData;
      activeContext.portfolio.save(D, { sync: false });
      // Update form inputs if they exist
      setTimeout(() => {
        const niftyHighInput = document.getElementById('nifty-high') as HTMLInputElement;
        const niftyCurrentInput = document.getElementById('nifty-current') as HTMLInputElement;
        if (niftyHighInput) niftyHighInput.value = String(niftyData.high52w);
        if (niftyCurrentInput) niftyCurrentInput.value = String(niftyData.level);
      }, 100);
    }
  } catch {
    // Silently fail - user can click refresh button
  }
}

export function renderCalculators(container: HTMLElement, context: FeatureContext = activeContext) {
  activeContext = context;
  D = context.state;
  container.innerHTML = `
    <div class="calculators-container">
      <div class="calc-tabs">
        <button class="calc-tab active" data-calc="crash">🔴 Crash Protocol</button>
        <button class="calc-tab" data-calc="emergency">💧 Emergency Runway</button>
        <button class="calc-tab" data-calc="sip-pause">⏸️ SIP Pause</button>
        <button class="calc-tab" data-calc="tax-planner">Tax Planner</button>
        <button class="calc-tab" data-calc="swp-scheduler">⏸️ SWP Scheduler</button>
      </div>

      <div id="crash" class="calc-panel active">
        ${renderCrashProtocol()}
      </div>
      <div id="emergency" class="calc-panel">
        ${renderEmergencyRunway()}
      </div>
      <div id="sip-pause" class="calc-panel">
        ${renderSIPPause()}
      </div>
      <div id="tax-planner" class="calc-panel"></div>
      <div id="swp-scheduler" class="calc-panel">
        ${renderSWPScheduler()}
      </div>
    </div>
  `;

  attachCalculatorHandlers(context);
  initTaxModule('tax-planner', context);
}

function renderCrashProtocol(): string {
  const totalBonds = Object.values(D.bonds || {}).reduce((sum, b) => sum + b.amount, 0);
  const defaultCrashFund = totalBonds;
  
  // Amounts to deploy based on the crash fund
  const deploy10 = defaultCrashFund * 0.10;
  const deploy15 = defaultCrashFund * 0.15;
  const deploy25 = defaultCrashFund * 0.25;

  return `
    <div class="calc-card">
      <h3>Market Crash Simulator</h3>
      <p class="calc-info">How much to deploy if market crashes?</p>

      <div class="calc-input-group">
        <label>Crash Fund (₹) - Bonds Default</label>
        <input type="number" id="crash-portfolio" value="${defaultCrashFund}">
      </div>

      <div class="crash-scenarios">
        <div class="scenario">
          <span class="scenario-label">10% Crash</span>
          <span class="scenario-value">${formatCurrency(deploy10)}</span>
          <span class="scenario-desc">Invest to average down</span>
        </div>
        <div class="scenario">
          <span class="scenario-label">15% Crash</span>
          <span class="scenario-value">${formatCurrency(deploy15)}</span>
          <span class="scenario-desc">Aggressive buy</span>
        </div>
        <div class="scenario">
          <span class="scenario-label">25% Crash</span>
          <span class="scenario-value">${formatCurrency(deploy25)}</span>
          <span class="scenario-desc">Max deployment</span>
        </div>
      </div>

      <div class="calc-input-group">
        <label>Nifty 52W High (₹)</label>
        <input type="number" id="nifty-high" value="${D.niftyHigh || ''}">
      </div>
      <div class="calc-input-group">
        <label>Current Nifty Level (₹)</label>
        <input type="number" id="nifty-current" value="${D.niftyData?.level || ''}">
      </div>
      <p id="nifty-status" class="calc-info">${D.niftyData ? `${D.niftyData.status ?? 'legacy'} data from ${D.niftyData.source}. Updated: ${new Date(D.niftyData.timestamp).toLocaleString()}` : 'Live Nifty data unavailable. Enter both values manually before interpreting drawdown.'}</p>
      <button id="refresh-nifty-btn" class="btn-primary">⚡ Refresh Nifty</button>
    </div>
  `;
}

function renderEmergencyRunway(): string {
  const monthlyExpenses = D.profile.annualExpenses || 0;
  const annualExpenses = monthlyExpenses * 12;

  const mfValue = Object.values(D.sip)
    .reduce((sum, sip) => sum + (sip.units * (sip.schemeCode ? D.nav[sip.schemeCode]?.nav || 0 : 0)), 0);
  const fdValue = D.fd.fd?.amount || 0;
  const buffer = 0; // From profile if added

  const liquidAssets = mfValue + fdValue + buffer;
  const runwayMonths = monthlyExpenses > 0 ? Math.floor(liquidAssets / monthlyExpenses) : 0;

  return `
    <div class="calc-card">
      <h3>Emergency Runway Calculator</h3>
      <p class="calc-info">Months of expenses covered by liquid assets</p>

      <div class="runway-breakdown">
        <div class="runway-item">
          <span class="label">Monthly Expenses</span>
          <span class="value">${formatCurrency(monthlyExpenses)}</span>
          <span class="sub">Annual: ${formatCurrency(annualExpenses)}</span>
        </div>
        <div class="runway-item">
          <span class="label">Mutual Funds</span>
          <span class="value">${formatCurrency(mfValue)}</span>
        </div>
        <div class="runway-item">
          <span class="label">Fixed Deposits</span>
          <span class="value">${formatCurrency(fdValue)}</span>
        </div>
        <div class="runway-item">
          <span class="label">Total Liquid</span>
          <span class="value">${formatCurrency(liquidAssets)}</span>
        </div>
      </div>

      <div class="runway-result">
        <div class="runway-months">
          <span class="number">${runwayMonths}</span>
          <span class="label">Months of Emergency Fund</span>
        </div>
        <span class="status ${runwayMonths >= 12 ? 'healthy' : runwayMonths >= 6 ? 'ok' : 'warning'}">
          ${runwayMonths >= 12 ? '✓ Healthy' : runwayMonths >= 6 ? '⚠️ Moderate' : '✗ Low'}
        </span>
      </div>
    </div>
  `;
}

function renderSIPPause(): string {
  const totalSIPMonthly = Object.values(D.sip)
    .filter(sip => sip && sip.monthlyAmount)
    .reduce((sum, sip) => sum + (sip.monthlyAmount || 0), 0);

  return `
    <div class="calc-card">
      <h3>SIP Pause Impact Calculator</h3>
      <p class="calc-info">Cost of missing SIP contributions during downturns</p>

      <div class="calc-input-group">
        <label>Total Monthly SIP (₹)</label>
        <input type="number" id="sip-monthly" value="${totalSIPMonthly}" placeholder="Enter monthly SIP total">
      </div>

      <div class="calc-input-group">
        <label>Pause Duration (months)</label>
        <input type="number" id="pause-months" min="1" max="60" value="6">
      </div>

      <div class="calc-input-group">
        <label>Expected Annual Return (%)</label>
        <input type="number" id="expected-return" min="0" max="50" value="12" step="0.1">
      </div>

      <button id="calculate-sip-btn" class="btn-primary">Calculate Impact</button>

      <div id="sip-result" class="calc-result" style="display: none;">
        <div class="result-item">
          <span class="label">Missed Contributions</span>
          <span id="missed-amount" class="value">₹0</span>
        </div>
        <div class="result-item">
          <span class="label">Lost Growth (12 months)</span>
          <span id="lost-growth" class="value">₹0</span>
        </div>
        <div class="result-item">
          <span class="label">Total Cost</span>
          <span id="total-cost" class="value">₹0</span>
        </div>
      </div>
    </div>
  `;
}



function updateCrashScenarios() {
  const portfolioInput = document.getElementById('crash-portfolio') as HTMLInputElement;
  const portfolio = parseFloat(portfolioInput?.value || '0') || 0;

  const scenarioDiv = document.querySelector('#crash .crash-scenarios');
  if (scenarioDiv) {
    scenarioDiv.innerHTML = `
      <div class="scenario">
        <span class="scenario-label">10% Crash</span>
        <span class="scenario-value">${formatCurrency(portfolio * 0.1)}</span>
        <span class="scenario-desc">Invest to average down</span>
      </div>
      <div class="scenario">
        <span class="scenario-label">15% Crash</span>
        <span class="scenario-value">${formatCurrency(portfolio * 0.15)}</span>
        <span class="scenario-desc">Aggressive buy</span>
      </div>
      <div class="scenario">
        <span class="scenario-label">25% Crash</span>
        <span class="scenario-value">${formatCurrency(portfolio * 0.25)}</span>
        <span class="scenario-desc">Max deployment</span>
      </div>
    `;
  }
}

function attachCalculatorHandlers(context: FeatureContext) {
  // Tab switching
  document.querySelectorAll('.calc-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).getAttribute('data-calc');
      if (!target) return;

      document.querySelectorAll('.calc-tab').forEach((t) => t.classList.remove('active'));
      (e.target as HTMLElement).classList.add('active');

      document.querySelectorAll('.calc-panel').forEach((p) => p.classList.remove('active'));
      document.getElementById(target)?.classList.add('active');
    });
  });

  // Crash Protocol
  document.getElementById('crash-portfolio')?.addEventListener('input', updateCrashScenarios);
  document.getElementById('refresh-nifty-btn')?.addEventListener('click', () => refreshNiftyData(context));

  // SIP Pause
  document.getElementById('calculate-sip-btn')?.addEventListener('click', calculateSIPPause);

  // SWP Scheduler handlers
  document.getElementById('save-swp-btn')?.addEventListener('click', () => {
    const enabledInput = document.getElementById('swp-enabled') as HTMLInputElement;
    const amountInput = document.getElementById('swp-amount') as HTMLInputElement;
    const startDateInput = document.getElementById('swp-start-date') as HTMLInputElement;

    const enabled = enabledInput?.checked ?? false;
    const amount = parseFloat(amountInput?.value || '0') || 0;
    const startDate = startDateInput?.value ? `${startDateInput.value}-01` : '';

    if (amount <= 0) {
      context.ports.ui.showToast('Please enter a valid positive monthly amount', 3000, 'warning');
      return;
    }

    if (!D.swpSchedule) {
      D.swpSchedule = { enabled: false, startDate: '', monthlyAmount: 122000, rate: 3 };
    }

    D.swpSchedule.enabled = enabled;
    D.swpSchedule.monthlyAmount = amount;
    D.swpSchedule.startDate = startDate;

    context.portfolio.save(D);

    context.ports.ui.showToast('✓ SWP config saved successfully', 3000, 'success');
  });

  document.getElementById('trigger-swp-btn')?.addEventListener('click', async () => {
    const triggerBtn = document.getElementById('trigger-swp-btn') as HTMLButtonElement;
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.textContent = '⏳ Executing...';
    }
    try {
      if (!D.swpSchedule || !D.swpSchedule.enabled) {
        context.ports.ui.showToast('Please enable SWP and save config first', 3000, 'warning');
        return;
      }
      await executeMonthlyWithdrawal(D);
      await context.portfolio.save(D, { awaitCloud: true });
      context.ports.ui.showToast('✓ Simulated withdrawal executed successfully', 3000, 'success');
    } catch {
      context.ports.ui.showToast('✗ Withdrawal execution failed', 3000, 'error');
    } finally {
      if (triggerBtn) {
        triggerBtn.disabled = false;
        triggerBtn.textContent = 'Simulate Withdrawal';
      }
    }
  });
}

async function refreshNiftyData(context: FeatureContext = activeContext) {
  try {
    context.ports.ui.showToast('⟳ Fetching Nifty data...', 2000);

    // Fetch fresh Nifty data from API
    const niftyData = await context.ports.marketData.fetchNifty();
    if (!niftyData) {
      const status = document.getElementById('nifty-status');
      if (status) status.textContent = 'Live Nifty data unavailable. Enter both values manually before interpreting drawdown.';
      context.ports.ui.showToast('✗ Failed to fetch Nifty data. Enter manually.', 2000, 'error');
      return;
    }

    // Update D state and form inputs
    D.niftyHigh = niftyData.high52w;
    D.niftyData = niftyData;
    context.portfolio.save(D, { sync: false });

    const niftyHighInput = document.getElementById('nifty-high') as HTMLInputElement;
    const niftyCurrentInput = document.getElementById('nifty-current') as HTMLInputElement;

    if (niftyHighInput) niftyHighInput.value = String(niftyData.high52w);
    if (niftyCurrentInput) niftyCurrentInput.value = String(niftyData.level);
    const status = document.getElementById('nifty-status');
    if (status) status.textContent = `${niftyData.status ?? 'legacy'} data from ${niftyData.source}. Updated: ${new Date(niftyData.timestamp).toLocaleString()}`;

    // Recalculate crash scenarios
    const highVal = niftyData.high52w;
    const currentVal = niftyData.level;
    const drawdown = ((highVal - currentVal) / highVal) * 100;
    const totalNW = context.ports.calculations.totalNetWorth(D).netWorth;

    const crashPanel = document.getElementById('crash');
    if (crashPanel) {
      const scenarioDiv = crashPanel.querySelector('.crash-scenarios');
      if (scenarioDiv) {
        scenarioDiv.innerHTML = `
          <div class="scenario-info">
            <p><strong>Nifty: ${currentVal} | 52W High: ${highVal}</strong></p>
            <p><strong>Current Drawdown: ${drawdown.toFixed(0)}%</strong></p>
            <p style="font-size: 12px; color: #666;">${niftyData.status ?? 'legacy'} data from ${niftyData.source}. Updated: ${new Date(niftyData.timestamp).toLocaleString()}</p>
          </div>
          <div class="scenario">
            <span class="scenario-label">10% Crash Deploy</span>
            <span class="scenario-value">${formatCurrency(totalNW * 0.1)}</span>
            <span class="scenario-desc">Average down position</span>
          </div>
          <div class="scenario">
            <span class="scenario-label">15% Crash Deploy</span>
            <span class="scenario-value">${formatCurrency(totalNW * 0.15)}</span>
            <span class="scenario-desc">Aggressive buy</span>
          </div>
          <div class="scenario">
            <span class="scenario-label">25% Crash Deploy</span>
            <span class="scenario-value">${formatCurrency(totalNW * 0.25)}</span>
            <span class="scenario-desc">Max deployment</span>
          </div>
        `;
      }
    }

    context.ports.ui.showToast(`✓ Nifty fetched: ${currentVal}`, 2000, 'success');
  } catch {
    context.ports.ui.showToast('✗ Failed to fetch Nifty data', 2000, 'error');
  }
}

function calculateSIPPause() {
  const monthlyInput = document.getElementById('sip-monthly') as HTMLInputElement;
  const pauseInput = document.getElementById('pause-months') as HTMLInputElement;
  const returnInput = document.getElementById('expected-return') as HTMLInputElement;

  const monthly = parseFloat(monthlyInput?.value || '0') || 0;
  const months = parseInt(pauseInput?.value || '0') || 0;
  const annualReturn = parseFloat(returnInput?.value || '12') || 12;

  const missedAmount = monthly * months;
  const monthlyReturn = annualReturn / 12 / 100;
  const lostGrowth = missedAmount * monthlyReturn * 12; // Approximate 12 months of growth
  const totalCost = missedAmount + lostGrowth;

  const resultDiv = document.getElementById('sip-result');
  if (resultDiv) {
    (document.getElementById('missed-amount') as HTMLElement).textContent = `${formatCurrency(missedAmount)}`;
    (document.getElementById('lost-growth') as HTMLElement).textContent = `${formatCurrency(lostGrowth)}`;
    (document.getElementById('total-cost') as HTMLElement).textContent = `${formatCurrency(totalCost)}`;
    resultDiv.style.display = 'block';
  }
}

function renderSWPScheduler(): string {
  const swp = D.swpSchedule || { enabled: false, startDate: '', monthlyAmount: 122000, rate: 3 };
  return `
    <div class="calc-card">
      <h3>SWP Scheduler</h3>
      <p class="calc-info">Schedule your post-retirement withdrawals using FIFO redemption strategy.</p>

      <div class="form-group margin-bottom-1-5">
        <label class="flex-align-center gap-0-5 cursor-pointer">
          <input type="checkbox" id="swp-enabled" ${swp.enabled ? 'checked' : ''}>
          <span class="font-medium text-white">Enable SWP Automation</span>
        </label>
      </div>

      <div class="calc-input-group margin-bottom-1-5">
        <label for="swp-amount">Monthly Withdrawal Amount (₹)</label>
        <input type="number" id="swp-amount" value="${swp.monthlyAmount || 122000}">
      </div>

      <div class="calc-input-group margin-bottom-1-5">
        <label for="swp-start-date">SWP Start Date (Month)</label>
        <input type="month" id="swp-start-date" value="${swp.startDate ? swp.startDate.substring(0, 7) : ''}">
      </div>

      <div class="flex-row gap-1">
        <button id="save-swp-btn" class="btn btn-primary">Save SWP Config</button>
        <button id="trigger-swp-btn" class="btn btn-secondary">Simulate Withdrawal</button>
      </div>
    </div>
  `;
}


