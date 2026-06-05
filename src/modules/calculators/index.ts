/**
 * Calculators Module
 * Provides financial calculators: Crash Protocol, Emergency Runway, SIP Pause
 */

import { D } from '../../main';
import { formatCurrency } from '../../lib/formatters';
import { showToast } from '../ui';
import { fetchNifty } from '../api';
import './styles.css';
import { initTaxModule } from '../tax';

export function initCalculatorsModule(containerId: string) {
  const container = document.getElementById(containerId);
  if (!container) return;
  renderCalculators(container);
  autoFetchNiftyData();
}

// Auto-fetch Nifty data on init
async function autoFetchNiftyData() {
  try {
    const niftyData = await fetchNifty();
    if (niftyData) {
      D.niftyHigh = niftyData.high52w;
      D.niftyData = {
        level: niftyData.level,
        high52w: niftyData.high52w,
        timestamp: new Date().toISOString(),
        source: niftyData.source,
      };
      // Update form inputs if they exist
      setTimeout(() => {
        const niftyHighInput = document.getElementById('nifty-high') as HTMLInputElement;
        const niftyCurrentInput = document.getElementById('nifty-current') as HTMLInputElement;
        if (niftyHighInput) niftyHighInput.value = String(niftyData.high52w);
        if (niftyCurrentInput) niftyCurrentInput.value = String(niftyData.level);
      }, 100);
    }
  } catch (e) {
    // Silently fail - user can click refresh button
  }
}

export function renderCalculators(container: HTMLElement) {
  container.innerHTML = `
    <div class="calculators-container">
      <div class="calc-tabs">
        <button class="calc-tab active" data-calc="crash">🔴 Crash Protocol</button>
        <button class="calc-tab" data-calc="emergency">💧 Emergency Runway</button>
        <button class="calc-tab" data-calc="sip-pause">⏸️ SIP Pause</button>
        <button class="calc-tab" data-calc="tax-planner">Tax Planner</button>
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
    </div>
  `;

  attachCalculatorHandlers();
  initTaxModule('tax-planner');
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

function attachCalculatorHandlers() {
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
  document.getElementById('refresh-nifty-btn')?.addEventListener('click', refreshNiftyData);

  // SIP Pause
  document.getElementById('calculate-sip-btn')?.addEventListener('click', calculateSIPPause);
}

function calculateTotalNetWorth(): number {
  let total = 0;

  // SIP values
  Object.values(D.sip).forEach((sip) => {
    const navData = sip.schemeCode ? D.nav[sip.schemeCode] : undefined;
    if (navData) {
      total += sip.units * navData.nav;
    }
  });

  // Holdings
  total += D.fd.fd?.amount || 0;
  total += D.epf.epf?.amount || 0;
  total += D.esop.esop?.amount || 0;
  total += D.bonds.bonds?.amount || 0;

  // Demat stocks
  Object.values(D.demat).forEach((stock) => {
    total += stock.currentValue;
  });

  return total;
}

async function refreshNiftyData() {
  try {
    showToast('⟳ Fetching Nifty data...', 2000);

    // Fetch fresh Nifty data from API
    const niftyData = await fetchNifty();
    if (!niftyData) {
      showToast('✗ Failed to fetch Nifty data. Enter manually.', 2000, 'error');
      return;
    }

    // Update D state and form inputs
    D.niftyHigh = niftyData.high52w;
    D.niftyData = {
      level: niftyData.level,
      high52w: niftyData.high52w,
      timestamp: new Date().toISOString(),
      source: niftyData.source,
    };

    const niftyHighInput = document.getElementById('nifty-high') as HTMLInputElement;
    const niftyCurrentInput = document.getElementById('nifty-current') as HTMLInputElement;

    if (niftyHighInput) niftyHighInput.value = String(niftyData.high52w);
    if (niftyCurrentInput) niftyCurrentInput.value = String(niftyData.level);

    // Recalculate crash scenarios
    const highVal = niftyData.high52w;
    const currentVal = niftyData.level;
    const drawdown = ((highVal - currentVal) / highVal) * 100;
    const totalNW = calculateTotalNetWorth();

    const crashPanel = document.getElementById('crash');
    if (crashPanel) {
      const scenarioDiv = crashPanel.querySelector('.crash-scenarios');
      if (scenarioDiv) {
        scenarioDiv.innerHTML = `
          <div class="scenario-info">
            <p><strong>Nifty: ${currentVal} | 52W High: ${highVal}</strong></p>
            <p><strong>Current Drawdown: ${drawdown.toFixed(2)}%</strong></p>
            <p style="font-size: 12px; color: #666;">Source: ${niftyData.source}</p>
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

    showToast(`✓ Nifty fetched: ${currentVal}`, 2000, 'success');
  } catch (e) {
    showToast('✗ Failed to fetch Nifty data', 2000, 'error');
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


