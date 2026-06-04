/**
 * Insurance Module
 * Manages term life and health insurance gap analysis
 */
import { D } from '../../main';
import { formatCurrency } from '../../lib/formatters';
import { saveData } from '../../lib/storage';
import { showToast } from '../ui';
import './styles.css';

const DEBOUNCE_MS = 500;
let debounceTimer: NodeJS.Timeout | null = null;

export function initInsuranceModule(containerId: string) {
  const container = document.getElementById(containerId);
  if (!container) return;
  renderInsurance(container);
}

export function renderInsurance(container?: HTMLElement) {
  if (!container) {
    container = document.getElementById('insurance') as HTMLElement;
    if (!container) return;
  }

  const annualIncome = (D.profile.monthlyIncome || 0) * 12;
  const recommendedTerm = Math.max(annualIncome * 10, 10000000);
  const currentTermCover = D.insurance.termLife.currentCover || 0;
  const termAdequate = currentTermCover >= recommendedTerm;

  const familySize = D.insurance.health.familySize || 1;
  const recommendedHealth = familySize <= 2 ? 2000000 : 5000000;
  const currentHealthCover = D.insurance.health.currentCover || 0;
  const healthAdequate = currentHealthCover >= recommendedHealth;

  const successIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px;color:#2e7d32;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
  const warningIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px;color:#d32f2f;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

  container.innerHTML = `
    <div class="insurance-container">
      <h2>Insurance Gap Analyzer</h2>
      
      <div class="insurance-cards">
        <!-- Term Life Card -->
        <div class="insurance-card">
          <h3>Term Life Insurance</h3>
          <div class="adequacy-check ${termAdequate ? 'adequate' : 'inadequate'}">
            <span class="status-icon">${termAdequate ? successIcon : warningIcon}</span>
            <div class="status-text">
              <strong>${termAdequate ? 'Adequate Cover' : 'Underinsured'}</strong>
              <span>Recommended: ${formatCurrency(recommendedTerm)}</span>
            </div>
          </div>
          
          <form id="term-form" class="insurance-form">
            <div class="form-group">
              <label for="term-cover">Current Cover Amount (₹)</label>
              <input type="number" id="term-cover" value="${D.insurance.termLife.currentCover || ''}" placeholder="e.g. 10000000">
            </div>
            <div class="form-group">
              <label for="term-premium">Annual Premium (₹)</label>
              <input type="number" id="term-premium" value="${D.insurance.termLife.annualPremium || ''}" placeholder="e.g. 15000">
            </div>
          </form>
        </div>

        <!-- Health Insurance Card -->
        <div class="insurance-card">
          <h3>Health Insurance</h3>
          <div class="adequacy-check ${healthAdequate ? 'adequate' : 'inadequate'}">
            <span class="status-icon">${healthAdequate ? successIcon : warningIcon}</span>
            <div class="status-text">
              <strong>${healthAdequate ? 'Adequate Cover' : 'Underinsured'}</strong>
              <span>Recommended: ${formatCurrency(recommendedHealth)}</span>
            </div>
          </div>
          
          <form id="health-form" class="insurance-form">
            <div class="form-group">
              <label for="health-cover">Current Cover Amount (₹)</label>
              <input type="number" id="health-cover" value="${D.insurance.health.currentCover || ''}" placeholder="e.g. 2000000">
            </div>
            <div class="form-group">
              <label for="health-premium">Annual Premium (₹)</label>
              <input type="number" id="health-premium" value="${D.insurance.health.annualPremium || ''}" placeholder="e.g. 25000">
            </div>
            <div class="form-group">
              <label for="health-family">Family Size (Number of people)</label>
              <input type="number" id="health-family" value="${D.insurance.health.familySize || ''}" placeholder="e.g. 4">
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  attachInsuranceHandlers();
}

function attachInsuranceHandlers() {
  const inputs = document.querySelectorAll('.insurance-form input');
  inputs.forEach(input => {
    input.addEventListener('input', debounceInsuranceSave);
  });
}

function debounceInsuranceSave() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    saveInsurance();
    renderInsurance();
  }, DEBOUNCE_MS);
}

function saveInsurance() {
  const termCover = document.getElementById('term-cover') as HTMLInputElement;
  const termPremium = document.getElementById('term-premium') as HTMLInputElement;
  const healthCover = document.getElementById('health-cover') as HTMLInputElement;
  const healthPremium = document.getElementById('health-premium') as HTMLInputElement;
  const healthFamily = document.getElementById('health-family') as HTMLInputElement;

  D.insurance.termLife.currentCover = parseFloat(termCover.value) || 0;
  D.insurance.termLife.annualPremium = parseFloat(termPremium.value) || 0;
  
  D.insurance.health.currentCover = parseFloat(healthCover.value) || 0;
  D.insurance.health.annualPremium = parseFloat(healthPremium.value) || 0;
  D.insurance.health.familySize = parseInt(healthFamily.value) || 1;

  saveData(D);
}
