import { D } from '../../main';
import { calculateLTCGHarvestPlan } from './ltcg-planner';
import { formatCurrency, formatNumber } from '../../lib/formatters';
import { saveData } from '../../lib/storage';
import { showToast } from '../ui';
import './styles.css';

let moduleContainerId = 'tax';

export function initTaxModule(containerId: string) {
  moduleContainerId = containerId;
  const container = document.getElementById(containerId);
  if (!container) return;
  renderTax(container);
}

export function renderTax(container?: HTMLElement) {
  const targetContainer = container || document.getElementById(moduleContainerId);
  if (!targetContainer) return;

  // 1. LTCG Harvest Calculations
  if (!D.taxCalendar) {
    D.taxCalendar = {
      lastLTCGHarvestDate: '',
      lastHarvestedAmount: 0,
      harvestTarget: 125000,
    };
  }
  const plan = calculateLTCGHarvestPlan(D);

  // 2. 80C Tracker Calculations
  const storedEpf = localStorage.getItem('epf_annual_contribution');
  const epfValue = storedEpf !== null ? parseFloat(storedEpf) : (D.profile.monthlyIncome || 0) * 0.50 * 0.12 * 12;
  const termPremium = D.insurance?.termLife?.annualPremium || 0;
  const total80C = epfValue + termPremium;
  const limit80C = 150000;
  const progressPercent80C = Math.min(100, (total80C / limit80C) * 100);
  const remaining80C = Math.max(0, limit80C - total80C);

  targetContainer.innerHTML = `
    <div class="tax-planner-container">
      <div class="tax-header">
        <h2>Tax Planner</h2>
      </div>

      <!-- Section 1: LTCG Harvest Dashboard -->
      <div class="tax-section ltcg-harvest-section">
        <h3>LTCG Harvest Dashboard</h3>
        <p class="section-description">
          Tax harvesting is a strategy to realize long-term capital gains up to the annual exemption limit to reduce future tax liability.
        </p>

        <!-- Cards Grid -->
        <div class="metric-grid">
          <div class="metric-card">
            <div class="metric-label">Total Unrealized Gains</div>
            <div class="metric-value">${formatCurrency(plan.totalLtcgGains)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Remaining Exemption Limit</div>
            <div class="metric-value">${formatCurrency(plan.remainingLimit)}</div>
            <div class="metric-subtext">Out of 1.25L annual limit</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Recommended Harvest</div>
            <div class="metric-value">${formatCurrency(plan.totalRecommendedHarvest)}</div>
            <div class="metric-subtext">Estimated value to sell</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Tax Saved</div>
            <div class="metric-value">${formatCurrency(plan.totalRecommendedHarvestGain * 0.125)}</div>
            <div class="metric-subtext">12.5% of recommended harvest gain</div>
          </div>
        </div>

        <!-- Recommendations Table -->
        <div class="table-container">
          <table class="recommendations-table">
            <thead>
              <tr>
                <th>Fund Name</th>
                <th class="num-col">Long Term Value</th>
                <th class="num-col">LTCG Gains</th>
                <th class="num-col">Recommended Harvest Amount</th>
                <th class="num-col">Recommended Harvest Units</th>
              </tr>
            </thead>
            <tbody>
              ${plan.recommendations.length === 0 ? `
                <tr>
                  <td colspan="5" class="empty-row">No mutual funds found with long-term gains.</td>
                </tr>
              ` : plan.recommendations.map(rec => `
                <tr>
                  <td>${rec.fundName}</td>
                  <td class="num-col">${formatCurrency(rec.longTermValue)}</td>
                  <td class="num-col">${formatCurrency(rec.ltcgGains)}</td>
                  <td class="num-col highlighted-value">${formatCurrency(rec.recommendedHarvestAmount)}</td>
                  <td class="num-col">${rec.recommendedHarvestUnits.toFixed(3)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
          ${plan.totalRecommendedHarvest > 0 ? `
            <button id="record-harvest-btn" class="btn btn-primary">Record Harvest</button>
          ` : ''}
          <button id="reset-harvest-btn" class="btn btn-secondary">Reset Harvest</button>
        </div>
      </div>

      <!-- Section 2: 80C Tracker -->
      <div class="tax-section section-80c">
        <h3>Section 80C Tracker</h3>
        <p class="section-description">
          Section 80C allows tax deductions up to 1.5L per financial year on eligible investments and expenses.
        </p>

        <div class="tracker-grid">
          <div class="tracker-form">
            <div class="form-group">
              <label for="epf-annual-contribution">EPF Annual Contribution (INR)</label>
              <input type="number" id="epf-annual-contribution" value="${epfValue}" class="tax-input" placeholder="e.g. 50000">
            </div>
            <div class="form-group">
              <label>Term Insurance Premium (INR) (Read-only)</label>
              <input type="text" value="${formatCurrency(termPremium)}" class="tax-input read-only-input" readonly>
            </div>
          </div>

          <div class="tracker-results">
            <div class="progress-container">
              <div class="progress-labels">
                <span>Total Section 80C Investment: <strong>${formatCurrency(total80C)}</strong></span>
                <span>Limit: 1.5L</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${progressPercent80C}%"></div>
              </div>
              <div class="progress-percentage">${progressPercent80C.toFixed(1)}% Completed</div>
            </div>

            <div class="remaining-card">
              <div class="remaining-label">Remaining to Max Out Section 80C</div>
              <div class="remaining-value">${formatCurrency(remaining80C)}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 3: Tax Calendar -->
      <div class="tax-section tax-calendar-section">
        <h3>Tax Calendar</h3>
        <p class="section-description">
          Key financial deadlines and actions to remember for the Indian tax year.
        </p>

        <div class="calendar-layout">
          <div class="timeline">
            <div class="timeline-item">
              <div class="timeline-marker"></div>
              <div class="timeline-content">
                <h4>March 31st</h4>
                <p>Section 80C investment deadline for the financial year.</p>
              </div>
            </div>
            <div class="timeline-item">
              <div class="timeline-marker"></div>
              <div class="timeline-content">
                <h4>April 1st</h4>
                <p>New financial year begins. LTCG exemption limit resets.</p>
              </div>
            </div>
            <div class="timeline-item">
              <div class="timeline-marker"></div>
              <div class="timeline-content">
                <h4>April 15th</h4>
                <p>Recommended LTCG harvesting execution period.</p>
              </div>
            </div>
            <div class="timeline-item">
              <div class="timeline-marker"></div>
              <div class="timeline-content">
                <h4>July 31st</h4>
                <p>ITR filing deadline for individuals for the previous financial year.</p>
              </div>
            </div>
          </div>

          <!-- Last Harvest Info -->
          ${(D.taxCalendar.lastHarvestedAmount > 0 || D.taxCalendar.lastLTCGHarvestDate) ? `
            <div class="last-harvest-card">
              <h4>Last Harvest Record</h4>
              <div class="last-harvest-details">
                <div class="detail-row">
                  <span>Amount Harvested:</span>
                  <strong>${formatCurrency(D.taxCalendar.lastHarvestedAmount)}</strong>
                </div>
                <div class="detail-row">
                  <span>Harvest Date:</span>
                  <strong>${D.taxCalendar.lastLTCGHarvestDate || 'N/A'}</strong>
                </div>
              </div>
            </div>
          ` : `
            <div class="last-harvest-card empty-harvest">
              <h4>Last Harvest Record</h4>
              <p>No tax harvest recorded for this financial year yet.</p>
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  // Attach Event Handlers
  const recordBtn = targetContainer.querySelector('#record-harvest-btn');
  if (recordBtn) {
    recordBtn.addEventListener('click', () => {
      D.taxCalendar.lastHarvestedAmount = (D.taxCalendar.lastHarvestedAmount || 0) + plan.totalRecommendedHarvestGain;
      
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      D.taxCalendar.lastLTCGHarvestDate = `${year}-${month}-${day}`;

      saveData(D);
      showToast('Tax harvest recorded successfully');
      renderTax(targetContainer);
    });
  }

  const resetBtn = targetContainer.querySelector('#reset-harvest-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      D.taxCalendar.lastHarvestedAmount = 0;
      D.taxCalendar.lastLTCGHarvestDate = '';

      saveData(D);
      showToast('Tax harvest reset successfully');
      renderTax(targetContainer);
    });
  }

  const epfInput = targetContainer.querySelector('#epf-annual-contribution') as HTMLInputElement;
  if (epfInput) {
    epfInput.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const val = parseFloat(target.value) || 0;
      localStorage.setItem('epf_annual_contribution', val.toString());

      // Live updates to Section 80C UI without re-rendering to prevent focus loss
      const updatedTotal = val + termPremium;
      const updatedProgressPercent = Math.min(100, (updatedTotal / limit80C) * 100);
      const updatedRemaining = Math.max(0, limit80C - updatedTotal);

      const totalLabel = targetContainer.querySelector('.progress-labels strong');
      if (totalLabel) totalLabel.textContent = formatCurrency(updatedTotal);

      const progressBar = targetContainer.querySelector('.progress-bar-fill') as HTMLElement;
      if (progressBar) progressBar.style.width = `${updatedProgressPercent}%`;

      const progressPercentLabel = targetContainer.querySelector('.progress-percentage');
      if (progressPercentLabel) progressPercentLabel.textContent = `${updatedProgressPercent.toFixed(1)}% Completed`;

      const remainingVal = targetContainer.querySelector('.remaining-value');
      if (remainingVal) remainingVal.textContent = formatCurrency(updatedRemaining);
    });
  }
}
