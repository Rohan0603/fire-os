import { D } from '../../main';
import { totalNetWorth } from '../dashboard/kpis';
import { calculateFIAge, generateScenarios } from '../calculators/scenario-modeler';
import { sipCorpus } from '../../lib/calculations';
import { formatCurrency, formatPercentage } from '../../lib/formatters';
import './styles.css';

let containerId = 'plan';

export function initPlanModule(id: string = 'plan') {
  containerId = id;
}

export function renderPlan() {
  const el = document.getElementById(containerId);
  if (!el) return;

  // --- FI calculations ---
  const { netWorth } = totalNetWorth(D);
  const fiTarget = D.profile?.fiTarget || 55_000_000;
  const currentAge = D.profile?.age || 25;
  const totalMonthlyAmount = Object.values(D.sip || {}).reduce(
    (sum, f) => sum + (f.monthlyAmount || 0),
    0,
  );

  const fiProgressPct = fiTarget > 0 ? Math.min((netWorth / fiTarget) * 100, 100) : 0;

  const baseScenario = calculateFIAge({
    currentCorpus: netWorth,
    monthlyAmount: totalMonthlyAmount,
    targetCorpus: fiTarget,
    cagr: 0.17,
    currentAge,
  });

  // generateScenarios returns [13%, 14%, 15%, 17%] at indices 0,1,2,3
  const allScenarios = generateScenarios({
    currentCorpus: netWorth,
    monthlyAmount: totalMonthlyAmount,
    targetCorpus: fiTarget,
    currentAge,
  });
  const stressRows = [
    { scenario: allScenarios[3], label: 'Base ✓', cls: 'base' },
    { scenario: allScenarios[1], label: 'Likely', cls: 'likely' },
    { scenario: allScenarios[0], label: 'Stress', cls: 'stress' },
  ];

  // --- Coorg calculations ---
  const coorgCorpus = D.coorgCorpus || 0;
  const coorgTarget = D.coorgTarget || 20_000_000;
  const coorgMonthlyAmount = D.coorgMonthlyAmount || 10_000;
  const coorgProgressPct = coorgTarget > 0 ? Math.min((coorgCorpus / coorgTarget) * 100, 100) : 0;
  // Project SIP from Jan 2031 → Jan 2036 = 5 years at 17% CAGR
  const coorgSIPProjected = sipCorpus(coorgMonthlyAmount, 0.17, 5);

  // --- Milestone FI year ---
  const currentYear = new Date().getFullYear();
  const fiYear = currentYear + Math.ceil(baseScenario.monthsToFI / 12);
  const fiYearOffset = fiYear - 2026; // years from SIP start (May 2026)

  // --- Next action: step-up SIP amount ---
  const stepUpAmount = totalMonthlyAmount > 0 ? Math.round(totalMonthlyAmount * 1.1) : 33_000;

  el.innerHTML = `
    <div class="plan-container">

      <section class="plan-card plan-fi-card">
        <h2 class="plan-card-title">Financial Independence</h2>
        <div class="plan-kpi-row">
          <div class="plan-kpi">
            <span class="plan-kpi-label">Target Corpus</span>
            <span class="plan-kpi-value">${formatCurrency(fiTarget, 2)}</span>
          </div>
          <div class="plan-kpi">
            <span class="plan-kpi-label">Current Value</span>
            <span class="plan-kpi-value">${formatCurrency(netWorth, 2)}</span>
          </div>
          <div class="plan-kpi">
            <span class="plan-kpi-label">Progress</span>
            <span class="plan-kpi-value plan-kpi-value--accent">${fiProgressPct.toFixed(1)}%</span>
          </div>
        </div>
        <div class="plan-progress-bar">
          <div class="plan-progress-fill" style="width:${fiProgressPct.toFixed(1)}%"></div>
        </div>
        <p class="plan-progress-note">Years remaining @ 17% CAGR: <strong>${(baseScenario.monthsToFI / 12).toFixed(1)}y</strong> · FI age: <strong>${baseScenario.fiAge.toFixed(1)}</strong></p>
      </section>

      <section class="plan-card">
        <h2 class="plan-card-title">Stress Tests</h2>
        <table class="plan-stress-table">
          <thead>
            <tr><th>CAGR</th><th>Timeline</th><th>FI Age</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${stressRows.map(({ scenario: s, label, cls }) => `
              <tr class="stress-row stress-row--${cls}">
                <td>${s.cagr}</td>
                <td>${(s.monthsToFI / 12).toFixed(1)}y</td>
                <td>${s.fiAge.toFixed(1)}</td>
                <td><span class="stress-badge stress-badge--${cls}">${label}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </section>

      <section class="plan-card plan-coorg-card">
        <h2 class="plan-card-title">Coorg Home <span class="plan-card-subtitle">(Separate Goal)</span></h2>
        <div class="plan-kpi-row">
          <div class="plan-kpi">
            <span class="plan-kpi-label">Target</span>
            <span class="plan-kpi-value">${formatCurrency(coorgTarget, 2)} by 2036</span>
          </div>
          <div class="plan-kpi">
            <span class="plan-kpi-label">Current</span>
            <span class="plan-kpi-value">${formatCurrency(coorgCorpus, 2)}</span>
          </div>
          <div class="plan-kpi">
            <span class="plan-kpi-label">Progress</span>
            <span class="plan-kpi-value">${coorgProgressPct.toFixed(1)}%</span>
          </div>
        </div>
        <div class="plan-progress-bar plan-progress-bar--coorg">
          <div class="plan-progress-fill plan-progress-fill--coorg" style="width:${coorgProgressPct.toFixed(1)}%"></div>
        </div>
        <p class="plan-progress-note">SIP projection (2031–2036 @ 17%): <strong>${formatCurrency(coorgSIPProjected, 2)}</strong></p>
        <div class="plan-funding-list">
          <div class="plan-funding-item">₹${(coorgMonthlyAmount / 1000).toFixed(0)}K/mo SIP · starts Jan 2031</div>
          <div class="plan-funding-item">+ ESOP liquidation · 2036</div>
        </div>
      </section>

      <section class="plan-card">
        <h2 class="plan-card-title">Key Milestones</h2>
        <ul class="plan-milestones">
          <li class="milestone"><span class="milestone-year">2027 (Year 1)</span><span class="milestone-desc">SIP step-up +10% → ₹${Math.round(stepUpAmount / 1000)}K/mo</span></li>
          <li class="milestone"><span class="milestone-year">2031 (Year 5)</span><span class="milestone-desc">Coorg SIP starts (₹${(coorgMonthlyAmount / 1000).toFixed(0)}K/mo)</span></li>
          <li class="milestone"><span class="milestone-year">2032 (Year 6)</span><span class="milestone-desc">LTCG harvest begins (₹1.25L/year)</span></li>
          <li class="milestone"><span class="milestone-year">2034 (Year 8)</span><span class="milestone-desc">Coorg land purchase</span></li>
          <li class="milestone"><span class="milestone-year">2036 (Year 10)</span><span class="milestone-desc">Coorg construction</span></li>
          <li class="milestone milestone--fi"><span class="milestone-year">${fiYear} (Year ${fiYearOffset})</span><span class="milestone-desc">FI target @ 17% CAGR · age ${baseScenario.fiAge.toFixed(1)}</span></li>
        </ul>
      </section>

      <section class="plan-card">
        <h2 class="plan-card-title">Your Next Actions</h2>
        <ul class="plan-actions">
          <li class="action action--now">
            <span class="action-timing">This Month</span>
            <span class="action-desc">Monitor Nifty for crash opportunities</span>
          </li>
          <li class="action action--upcoming">
            <span class="action-timing">April 2027</span>
            <span class="action-desc">Step-up SIP to ₹${Math.round(stepUpAmount / 1000)}K/mo</span>
          </li>
          <li class="action action--future">
            <span class="action-timing">Jan 2031</span>
            <span class="action-desc">Start Coorg SIP ₹${(coorgMonthlyAmount / 1000).toFixed(0)}K/mo</span>
          </li>
          <li class="action action--future">
            <span class="action-timing">From 2032</span>
            <span class="action-desc">LTCG harvest ₹1.25L/year</span>
          </li>
        </ul>
      </section>

    </div>
  `;
}

export function teardownPlan() {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '';
}
