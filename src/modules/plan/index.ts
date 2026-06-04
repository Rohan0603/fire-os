import { D } from '../../main';
import { renderHealthStatusBanner, attachHealthBannerListeners } from './health-status';
import { renderActionItems } from './action-engine';
import { renderNetWorthHistory } from './net-worth-history';
import { renderMilestones } from './milestones';
import { renderPlainEnglishSummary } from './plain-english';
import { renderCashflowSummary } from './cashflow-summary';
import { totalNetWorth } from '../dashboard/kpis';
import { calculateFIAge, generateScenarios } from '../calculators/scenario-modeler';
import { sipCorpus } from '../../lib/calculations';
import { formatCurrency } from '../../lib/formatters';
import './styles.css';

let containerId = 'plan';

export function initPlanModule(id: string = 'plan') {
  containerId = id;
}

export function renderPlan() {
  const el = document.getElementById(containerId);
  if (!el) return;

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

  const coorgCorpus = D.coorgCorpus || 0;
  const coorgTarget = D.coorgTarget || 20_000_000;
  const coorgProgressPct = coorgTarget > 0 ? Math.min((coorgCorpus / coorgTarget) * 100, 100) : 0;
  const coorgMonthlyAmount = D.coorgMonthlyAmount || 10_000;
  const coorgSIPProjected = sipCorpus(coorgMonthlyAmount, 0.17, 5);

  el.innerHTML = `
    <div class="plan-container">
      ${renderHealthStatusBanner(D)}
      
      <div class="plan-grid">
        <div class="plan-col">
          ${renderPlainEnglishSummary(D)}
          
          <section class="plan-card">
            ${renderCashflowSummary(D)}
          </section>
          
          <section class="plan-card">
            <h2 class="plan-card-title">Next Actions</h2>
            <div class="plan-actions-container">
              ${renderActionItems(D)}
            </div>
          </section>
        </div>
        
        <div class="plan-col">
          <section class="plan-card">
            ${renderNetWorthHistory(D)}
          </section>
          
          <section class="plan-card">
            ${renderMilestones(D)}
          </section>
          
          <section class="plan-card plan-fi-card">
            <h2 class="plan-card-title">FI Projection</h2>
            <div class="plan-kpi-row">
              <div class="plan-kpi">
                <span class="plan-kpi-label">Target</span>
                <span class="plan-kpi-value">${formatCurrency(fiTarget, 2)}</span>
              </div>
              <div class="plan-kpi">
                <span class="plan-kpi-label">Progress</span>
                <span class="plan-kpi-value plan-kpi-value--accent">${fiProgressPct.toFixed(1)}%</span>
              </div>
            </div>
            <div class="plan-progress-bar">
              <div class="plan-progress-fill" style="width:${fiProgressPct.toFixed(1)}%"></div>
            </div>
            <p class="plan-progress-note">FI in <strong>${(baseScenario.monthsToFI / 12).toFixed(1)}y</strong> (age ${baseScenario.fiAge.toFixed(1)})</p>
          </section>
          
          <section class="plan-card plan-coorg-card">
            <h2 class="plan-card-title">Coorg Home</h2>
            <div class="plan-kpi-row">
              <div class="plan-kpi">
                <span class="plan-kpi-label">Target</span>
                <span class="plan-kpi-value">${formatCurrency(coorgTarget, 2)}</span>
              </div>
              <div class="plan-kpi">
                <span class="plan-kpi-label">Progress</span>
                <span class="plan-kpi-value">${coorgProgressPct.toFixed(1)}%</span>
              </div>
            </div>
            <div class="plan-progress-bar plan-progress-bar--coorg">
              <div class="plan-progress-fill plan-progress-fill--coorg" style="width:${coorgProgressPct.toFixed(1)}%"></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners for dynamic components
  attachHealthBannerListeners();
  
  // Attach listeners for action checkboxes to update state
  const checkboxes = el.querySelectorAll('.action-checkbox');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const id = target.getAttribute('data-action-id');
      if (id) {
        if (target.checked) {
          D.completedActions[id] = { completedAt: new Date().toISOString() };
        } else {
          delete D.completedActions[id];
        }
        // Save state and re-render
        // Assuming we have a saveState or we dispatch an event. For now re-render Plan
        // to reflect state changes UI
        renderPlan();
      }
    });
  });
}

export function teardownPlan() {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '';
}
