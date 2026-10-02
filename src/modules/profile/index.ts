/**
 * Profile Module
 * Manages user portfolio data, holdings forms, CAS PDF import, and Firestore sync
 */

import { formatCurrency } from '../../lib/formatters';
import { createFeatureContext, type FeatureContext } from '../../core/feature-context';
import { parseCASPDF, CASParseResult } from './pdf-parser';
import { validateFormInput, handleError, ValidationRules } from '../../lib/error-handler';
import { getFundSchemeCode } from '../../lib/fundMatcher';
import { calculateAgeFromDateOfBirth } from '../../types/portfolio';
import './styles.css';

const DEBOUNCE_MS = 500;
const CORE_HOLDING_ROWS = {
  51: { name: 'Fixed Deposits', stateKey: 'fd' },
  52: { name: 'EPF', stateKey: 'epf' },
  53: { name: 'Bonds', stateKey: 'bonds' },
  54: { name: 'ESOP', stateKey: 'esop' },
} as const;
let debounceTimer: NodeJS.Timeout | null = null;
let activeContext = createFeatureContext();
let D = activeContext.state;
let esopValueRequest: Promise<void> | null = null;

/**
 * Initialize profile module
 */
export function initProfileModule(containerId: string, context: FeatureContext = activeContext) {
  activeContext = context;
  D = context.state;
  const container = document.getElementById(containerId);
  if (!container) return;
  renderProfile(container, context);
}

/**
 * Render profile form
 */
export function renderProfile(container: HTMLElement, context: FeatureContext = activeContext) {
  activeContext = context;
  D = context.state;
  ensureCoreHoldingRows();
  container.innerHTML = `
    <div class="profile-container">
      <h2>Portfolio Profile</h2>

      <div class="profile-section">
        <h3>Personal Info</h3>
        <form id="profile-form" class="profile-form">
          <div class="form-group">
            <label for="name">Name</label>
            <input type="text" id="name" placeholder="Your name" value="${D.profile.name || ''}">
          </div>
          <div class="form-group">
            <label for="date-of-birth">Date of Birth</label>
            <input type="date" id="date-of-birth" value="${D.profile.dateOfBirth || ''}" max="${new Date().toISOString().slice(0, 10)}">
          </div>
          <div class="form-group">
            <label for="expenses">Monthly Expenses (₹)</label>
            <input type="number" id="expenses" placeholder="Monthly expenses" value="${D.profile.annualExpenses || ''}">
          </div>
          <div class="form-group">
            <label for="fi-target">FI Target (₹)</label>
            <input type="number" id="fi-target" placeholder="e.g., 550000000 for ₹5.5Cr" value="${D.profile.fiTarget || ''}">
          </div>
          <div class="form-group">
            <label for="monthly-income">Monthly Income (₹)</label>
            <input type="number" id="monthly-income" placeholder="Monthly income" value="${D.profile.monthlyIncome || ''}">
          </div>
          <div class="form-group">
            <label for="tax-slab-rate">Income Tax Slab (%)</label>
            <input type="number" id="tax-slab-rate" min="0" max="100" step="0.1" value="${D.profile.taxSlabRate ?? 30}">
          </div>
        </form>
      </div>

      <div class="profile-section">
        <h3>Demat Holdings</h3>
        <div id="demat-list" class="demat-list">
          ${renderDematHoldings()}
        </div>
      </div>

      <div class="profile-section">
        <h3>Mutual Funds & SIPs</h3>
        <form id="sip-form" class="sip-form">
          ${renderSIPFields()}
        </form>
        <button id="add-sip-btn" class="btn-secondary">+ Add SIP</button>
      </div>

      <div class="profile-section">
        <h3>ESOP</h3>
        <div id="esop-profile-fields" class="esop-profile-fields">
          ${renderEsopProfileFields()}
        </div>
      </div>

      <div class="profile-section">
        <h3>Other Holdings</h3>
        <div id="other-holdings-list" class="other-holdings-list">
          ${renderOtherHoldingsFields()}
        </div>
        <button id="add-other-holding-btn" class="btn-secondary" type="button">+ Add Holding</button>
      </div>

      <div class="profile-section">
        <h3>Data Management</h3>
        <div class="data-actions" style="display: flex; gap: 1rem; align-items: center; margin-top: 0.5rem;">
          <button id="import-pdf-btn" class="btn-primary">📄 Import CAS PDF</button>
          <button id="save-cloud-btn" class="btn-primary">☁ Save to Firestore</button>
          <span class="save-cloud-hint" style="display: none; color: var(--text-secondary); font-size: 0.875rem;">Log in to sync to Firestore</span>
        </div>
        <input type="file" id="pdf-input" accept=".pdf" style="display: none;">
      </div>

      <div id="pdf-confirmation" style="display: none;" class="modal-overlay">
        <div class="modal-content">
          <h3>Confirm CAS Import</h3>
          <div id="pdf-preview"></div>
          <div class="modal-actions">
            <button id="pdf-confirm-btn" class="btn-primary">Confirm Import</button>
            <button id="pdf-cancel-btn" class="btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `;

  attachProfileHandlers(context);
  refreshEsopProfileValue(context);
}

async function refreshEsopProfileValue(context: FeatureContext): Promise<void> {
  const valueElement = document.getElementById('esop-inr-value');
  if (!valueElement) return;
  if (!esopValueRequest) {
    esopValueRequest = Promise.all([
      context.ports.marketData.fetchSocGenPrice(),
      context.ports.marketData.fetchEURINR(),
    ]).then(([sharePrice, eurInr]) => {
      const resolvedPrice = sharePrice ?? 24.5;
      const resolvedRate = eurInr ?? (D.eurInr || 90);
      if (resolvedRate > 0) {
        D.esop.esop = { amount: D.esopDetails.shares * resolvedPrice * resolvedRate, currency: 'INR' };
        const source = sharePrice !== null && eurInr !== null ? 'live' : 'fallback';
        valueElement.textContent = `Current value: ${formatCurrency(D.esop.esop.amount)} (${source})`;
      } else {
        valueElement.textContent = 'Current value unavailable';
      }
    }).catch(() => {
      valueElement.textContent = 'Current value unavailable';
    }).finally(() => {
      esopValueRequest = null;
    });
  }
  await esopValueRequest;
}

/**
 * Render SIP form fields
 */
function renderSIPFields(): string {
  const existingIndices = Object.keys(D.sip)
    .map(k => parseInt(k.replace('sip', '')))
    .filter(n => !isNaN(n));
  
  // If no SIPs, provide at least one empty slot
  if (existingIndices.length === 0) {
    existingIndices.push(1);
  }

  // Sort indices to display them in order
  existingIndices.sort((a, b) => a - b);

  let html = `
    <div class="sip-table-wrapper" style="overflow-x: auto; margin-bottom: 1rem;">
      <table class="sip-table" style="width: 100%; border-collapse: collapse; text-align: left; background: var(--card-bg); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <thead style="background: var(--bg-tertiary); border-bottom: 2px solid var(--border-primary);">
          <tr>
            <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary); min-width: 300px;">Fund Name</th>
            <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary);">Scheme Code</th>
            <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary);">Units</th>
            <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary);">Monthly (₹)</th>
            <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary);">Start Date</th>
            <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary);">Invested (₹)</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (const i of existingIndices) {
    const sip = D.sip[`sip${i}`];
    html += `
          <tr style="border-bottom: 1px solid var(--border-primary); transition: background-color 0.2s;">
            <td style="padding: 8px 16px;">
              <input type="text" class="sip-name" data-index="${i}" placeholder="Fund name" value="${sip?.name || ''}" style="width: 100%; min-width: 280px; padding: 8px; border: 1px solid var(--border-primary); border-radius: 4px; background: var(--input-bg); color: var(--input-text);">
            </td>
            <td style="padding: 8px 16px;">
              <input type="text" class="sip-code" data-index="${i}" placeholder="Code" value="${sip?.schemeCode || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--border-primary); border-radius: 4px; background: var(--input-bg); color: var(--input-text);">
            </td>
            <td style="padding: 8px 16px;">
              <input type="number" class="sip-units" data-index="${i}" placeholder="Units" value="${sip?.units || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--border-primary); border-radius: 4px; background: var(--input-bg); color: var(--input-text);">
            </td>
            <td style="padding: 8px 16px;">
              <input type="number" class="sip-amount" data-index="${i}" placeholder="₹0" value="${sip?.monthlyAmount || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--border-primary); border-radius: 4px; background: var(--input-bg); color: var(--input-text);">
            </td>
            <td style="padding: 8px 16px;">
              <input type="text" class="sip-start" data-index="${i}" placeholder="YYYY-MM" value="${sip?.startDate || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--border-primary); border-radius: 4px; background: var(--input-bg); color: var(--input-text);">
            </td>
            <td style="padding: 8px 16px;">
              <input type="number" class="sip-cost-basis" data-index="${i}" placeholder="Optional" value="${sip?.costBasis || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--border-primary); border-radius: 4px; background: var(--input-bg); color: var(--input-text);">
            </td>
          </tr>
    `;
  }
  
  html += `
        </tbody>
      </table>
    </div>
  `;
  return html;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character] || character));
}

function ensureCoreHoldingRows(): void {
  if (!D.otherHoldings || typeof D.otherHoldings !== 'object') D.otherHoldings = {};
  for (const [index, config] of Object.entries(CORE_HOLDING_ROWS)) {
    const key = `otherHolding${index}`;
    if (D.otherHoldings[key]) continue;
    const source = D[config.stateKey][config.stateKey];
    const amount = source?.amount || 0;
    if (amount > 0) D.otherHoldings[key] = { name: config.name, amount, annualReturn: 0 };
  }
}

function renderOtherHoldingsFields(): string {
  const otherHoldings = D.otherHoldings || {};
  const indices = Object.keys(otherHoldings)
    .map((key) => Number(key.replace('otherHolding', '')))
    .filter((index) => Number.isInteger(index) && index > 0)
    .sort((a, b) => a - b);

  if (indices.length === 0) indices.push(1);

  return `
    <div class="sip-table-wrapper" style="overflow-x: auto; margin-bottom: 1rem;">
      <table class="sip-table" style="width: 100%; border-collapse: collapse; text-align: left; background: var(--card-bg); border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <thead style="background: var(--bg-tertiary); border-bottom: 2px solid var(--border-primary);">
          <tr>
            <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary); min-width: 220px;">Holding Name</th>
            <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary);">Amount (₹)</th>
            <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary);">Annual Return (%)</th>
            <th style="padding: 12px 16px; font-weight: 600; color: var(--text-secondary);">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${indices.map((index) => {
            const holding = otherHoldings[`otherHolding${index}`];
            return `
              <tr style="border-bottom: 1px solid var(--border-primary);">
                <td style="padding: 8px 16px;">
                  <input type="text" class="other-holding-name" data-index="${index}" placeholder="e.g. Gold, Crypto" value="${escapeHtml(holding?.name || '')}" style="width: 100%; min-width: 200px; padding: 8px; border: 1px solid var(--border-primary); border-radius: 4px; background: var(--input-bg); color: var(--input-text);">
                </td>
                <td style="padding: 8px 16px;">
                  <input type="number" class="other-holding-amount" data-index="${index}" min="0" step="0.01" placeholder="₹0" value="${holding?.amount || ''}" style="width: 100%; padding: 8px; border: 1px solid var(--border-primary); border-radius: 4px; background: var(--input-bg); color: var(--input-text);">
                </td>
                <td style="padding: 8px 16px;">
                  <input type="number" class="other-holding-return" data-index="${index}" min="0" max="100" step="0.1" placeholder="0" value="${holding?.annualReturn ?? ''}" style="width: 100%; padding: 8px; border: 1px solid var(--border-primary); border-radius: 4px; background: var(--input-bg); color: var(--input-text);">
                </td>
                <td style="padding: 8px 16px;">
                  <button type="button" class="btn-secondary delete-other-holding-btn" data-index="${index}" aria-label="Delete ${escapeHtml(holding?.name || 'holding')}">Delete</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderEsopProfileFields(): string {
  const details = D.esopDetails;
  return `
    <div class="profile-form">
      <div class="form-group"><label for="esop-shares">Total Shares</label><input type="number" id="esop-shares" min="0" step="1" value="${details.shares || ''}"></div>
    </div>
    <p id="esop-inr-value" class="esop-inr-value">Fetching live value in INR...</p>
  `;
}

/**
 * Render demat holdings list
 */
function renderDematHoldings(): string {
  const holdings = Object.values(D.demat);
  if (holdings.length === 0) {
    return '<p class="empty-state">No demat holdings. Import a CAS PDF to add stocks.</p>';
  }

  return holdings
    .map(
      (h) => `
    <div class="demat-card">
      <div class="demat-header">
        <span class="demat-name">${h.name}</span>
        <span class="demat-isin">${h.isin}</span>
      </div>
      <div class="demat-details">
        <span>Qty: ${h.quantity}</span>
        <span>Value: ${formatCurrency(h.currentValue)}</span>
      </div>
    </div>
  `
    )
    .join('');
}

/**
 * Attach event handlers to form elements
 */
function attachProfileHandlers(context: FeatureContext) {
  // Profile form inputs
  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.querySelectorAll('input').forEach((input) => {
      input.addEventListener('blur', debounceProfileSave);
    });
  }

  // SIP form inputs
  const sipForm = document.getElementById('sip-form');
  if (sipForm) {
    sipForm.querySelectorAll('input').forEach((input) => {
      input.addEventListener('blur', debounceProfileSave);
    });

    // Event delegation for auto-populate scheme code when fund name changes
    sipForm.addEventListener('blur', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.classList.contains('sip-name')) {
        const index = target.getAttribute('data-index');
        if (index) {
          const fundName = target.value?.trim();
          const codeInput = sipForm.querySelector(`.sip-code[data-index="${index}"]`) as HTMLInputElement;
          if (fundName && codeInput && !codeInput.value) {
            const schemeCode = getFundSchemeCode(fundName);
            if (schemeCode) {
              codeInput.value = schemeCode;
              debounceProfileSave();
            }
          }
        }
      }
    }, true); // Use capture phase for blur event
  }

  // Other holdings form inputs and row actions
  const otherHoldingsList = document.getElementById('other-holdings-list');
  if (otherHoldingsList) {
    otherHoldingsList.querySelectorAll('input').forEach((input) => {
      input.addEventListener('blur', debounceProfileSave);
    });

    otherHoldingsList.querySelectorAll<HTMLButtonElement>('.delete-other-holding-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.index);
        const core = CORE_HOLDING_ROWS[index as keyof typeof CORE_HOLDING_ROWS];
        if (core) D[core.stateKey][core.stateKey] = { amount: 0, currency: 'INR' };
        delete D.otherHoldings[`otherHolding${index}`];
        const container = document.getElementById('profile');
        if (container) renderProfile(container, context);
        saveProfile();
      });
    });
  }

  const esopFields = document.getElementById('esop-profile-fields');
  esopFields?.querySelectorAll('input').forEach((input) => input.addEventListener('blur', debounceProfileSave));

  const addOtherHoldingBtn = document.getElementById('add-other-holding-btn');
  if (addOtherHoldingBtn) {
    addOtherHoldingBtn.addEventListener('click', () => {
      if (!D.otherHoldings) D.otherHoldings = {};
      for (let i = 1; i <= 50; i++) {
        if (!D.otherHoldings[`otherHolding${i}`]) {
          D.otherHoldings[`otherHolding${i}`] = { name: '', amount: 0, annualReturn: 0 };
          const container = document.getElementById('profile');
          if (container) renderProfile(container, context);
          return;
        }
      }
    });
  }

  // Add SIP button
  const addSipBtn = document.getElementById('add-sip-btn');
  if (addSipBtn) {
    addSipBtn.addEventListener('click', () => {
      // Find next available SIP slot
      for (let i = 1; i <= 50; i++) {
        if (!D.sip[`sip${i}`]) {
          D.sip[`sip${i}`] = {
            name: '',
            schemeCode: '',
            units: 0,
            startDate: '',
            monthlyAmount: 0,
          };
          saveProfile();
          const container = document.getElementById('profile');
          if (container) renderProfile(container);
          return;
        }
      }
    });
  }

  // PDF import
  document.getElementById('import-pdf-btn')?.addEventListener('click', () => {
    document.getElementById('pdf-input')?.click();
  });

  document.getElementById('pdf-input')?.addEventListener('change', handlePDFImport);

  // Confirmation modal
  document.getElementById('pdf-confirm-btn')?.addEventListener('click', confirmPDFImport);
  document.getElementById('pdf-cancel-btn')?.addEventListener('click', cancelPDFImport);

  // Save to Firestore button
  const saveCloudBtn = document.getElementById('save-cloud-btn') as HTMLButtonElement;
  if (saveCloudBtn) {
    const updateButtonState = () => {
      const isAuthed = !!D.currentUser?.uid;
      saveCloudBtn.disabled = !isAuthed;
      saveCloudBtn.classList.toggle('btn-disabled', !isAuthed);

      const hint = document.querySelector('.save-cloud-hint') as HTMLElement;
      if (hint) {
        hint.style.display = isAuthed ? 'none' : '';
      }
    };

    updateButtonState();

    saveCloudBtn.addEventListener('click', async () => {
      if (!D.currentUser?.uid) return;

      saveCloudBtn.textContent = '⏳ Saving...';
      saveCloudBtn.disabled = true;

      try {
        const valid = await saveProfile();
        if (!valid) {
          updateButtonState();
          return;
        }

        await context.portfolio.save(D, { awaitCloud: true });
        context.ports.ui.showToast('✓ Saved to Firestore');
        saveCloudBtn.textContent = '✓ Saved';
      } catch (e) {
        console.error('[Profile] Firestore save failed:', e);
        context.ports.ui.showToast('✗ Firestore sync failed', 3000, 'warning');
        saveCloudBtn.textContent = '☁ Save to Firestore';
        updateButtonState();
      } finally {
        setTimeout(() => {
          updateButtonState();
        }, 2000);
      }
    });
  }
}

/**
 * Debounced profile save - only if form changed
 */
function debounceProfileSave() {
  // Check if any form field differs from D (dirty detection)
  const nameInput = document.getElementById('name') as HTMLInputElement;
  const dateOfBirthInput = document.getElementById('date-of-birth') as HTMLInputElement;
  const expensesInput = document.getElementById('expenses') as HTMLInputElement;
  const fiTargetInput = document.getElementById('fi-target') as HTMLInputElement;
  const monthlyIncomeInput = document.getElementById('monthly-income') as HTMLInputElement;
  const taxSlabRateInput = document.getElementById('tax-slab-rate') as HTMLInputElement;

  let isDirty =
    (nameInput?.value || '') !== (D.profile.name || '') ||
    (dateOfBirthInput?.value || '') !== (D.profile.dateOfBirth || '') ||
    (expensesInput?.value ? parseFloat(expensesInput.value) : 0) !== (D.profile.annualExpenses || 0) ||
    (fiTargetInput?.value ? parseFloat(fiTargetInput.value) : 0) !== (D.profile.fiTarget || 0) ||
    (monthlyIncomeInput?.value ? parseFloat(monthlyIncomeInput.value) : 0) !== (D.profile.monthlyIncome || 0) ||
    (taxSlabRateInput?.value ? parseFloat(taxSlabRateInput.value) : 0) !== (D.profile.taxSlabRate ?? 30);

  // Check SIP fields
  if (!isDirty) {
    const esopSharesInput = document.getElementById('esop-shares') as HTMLInputElement;
    isDirty = (parseFloat(esopSharesInput?.value || '0') || 0) !== D.esopDetails.shares;
  }

  if (!isDirty) {
    for (let i = 1; i <= 10; i++) {
      const nameEl = document.querySelector(`.sip-name[data-index="${i}"]`) as HTMLInputElement;
      const codeEl = document.querySelector(`.sip-code[data-index="${i}"]`) as HTMLInputElement;
      const unitsEl = document.querySelector(`.sip-units[data-index="${i}"]`) as HTMLInputElement;
      const amountEl = document.querySelector(`.sip-amount[data-index="${i}"]`) as HTMLInputElement;
      const startEl = document.querySelector(`.sip-start[data-index="${i}"]`) as HTMLInputElement;
      const costBasisEl = document.querySelector(`.sip-cost-basis[data-index="${i}"]`) as HTMLInputElement;

      const sip = D.sip[`sip${i}`];
      if ((nameEl?.value || '') !== (sip?.name || '') ||
          (codeEl?.value || '') !== (sip?.schemeCode || '') ||
          (unitsEl?.value ? parseFloat(unitsEl.value) : 0) !== (sip?.units || 0) ||
          (amountEl?.value ? parseFloat(amountEl.value) : 0) !== (sip?.monthlyAmount || 0) ||
          (startEl?.value || '') !== (sip?.startDate || '') ||
          (costBasisEl?.value ? parseFloat(costBasisEl.value) : 0) !== (sip?.costBasis || 0)) {
        isDirty = true;
        break;
      }
    }
  }

  if (!isDirty) {
    for (let i = 1; i <= 54; i++) {
      const nameEl = document.querySelector(`.other-holding-name[data-index="${i}"]`) as HTMLInputElement;
      const amountEl = document.querySelector(`.other-holding-amount[data-index="${i}"]`) as HTMLInputElement;
      const returnEl = document.querySelector(`.other-holding-return[data-index="${i}"]`) as HTMLInputElement;
      const holding = D.otherHoldings?.[`otherHolding${i}`];
      if ((nameEl?.value || '') !== (holding?.name || '')
        || (amountEl?.value ? parseFloat(amountEl.value) : 0) !== (holding?.amount || 0)
        || (returnEl?.value ? parseFloat(returnEl.value) : 0) !== (holding?.annualReturn || 0)) {
        isDirty = true;
        break;
      }
    }
  }

  if (!isDirty) return;

  // Form changed - debounce save
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(saveProfile, DEBOUNCE_MS);
}

/**
 * Save profile data from form with comprehensive validation
 * Exported for manual trigger (e.g., before leaving tab)
 */
export async function saveProfile(): Promise<boolean> {
  try {
    const validationErrors: Array<{ field: string; message: string }> = [];

    // ==================== PROFILE SECTION ====================
    const nameInput = document.getElementById('name') as HTMLInputElement;
    const dateOfBirthInput = document.getElementById('date-of-birth') as HTMLInputElement;
    const expensesInput = document.getElementById('expenses') as HTMLInputElement;
    const fiTargetInput = document.getElementById('fi-target') as HTMLInputElement;
    const monthlyIncomeInput = document.getElementById('monthly-income') as HTMLInputElement;
    const taxSlabRateInput = document.getElementById('tax-slab-rate') as HTMLInputElement;

    // Validate name (optional but if provided, must be 2+ chars)
    if (nameInput?.value) {
      const nameError = validateFormInput(nameInput.value, [
        ValidationRules.minLength('Name', 2),
      ]);
      if (nameError) {
        validationErrors.push({ field: 'name', message: nameError });
      } else {
        D.profile.name = nameInput.value.trim();
      }
    }

    // Validate date of birth and derive age for existing calculations.
    if (dateOfBirthInput?.value) {
      const age = calculateAgeFromDateOfBirth(dateOfBirthInput.value);
      if (age === null || age > 150) {
        validationErrors.push({ field: 'date-of-birth', message: 'Date of birth must produce an age between 0 and 150' });
      } else {
        D.profile.dateOfBirth = dateOfBirthInput.value;
        D.profile.age = age;
      }
    } else {
      D.profile.dateOfBirth = '';
    }

    // Validate expenses (optional but if provided, must be non-negative)
    if (expensesInput?.value) {
      const expensesError = validateFormInput(expensesInput.value, [
        ValidationRules.positiveNumber('Monthly Expenses'),
      ]);
      if (expensesError) {
        validationErrors.push({ field: 'expenses', message: expensesError });
      } else {
        D.profile.annualExpenses = parseFloat(expensesInput.value);
      }
    }

    // Validate FI target (optional but if provided, must be non-negative)
    if (fiTargetInput?.value) {
      const fiError = validateFormInput(fiTargetInput.value, [
        ValidationRules.positiveNumber('FI Target'),
      ]);
      if (fiError) {
        validationErrors.push({ field: 'fi-target', message: fiError });
      } else {
        D.profile.fiTarget = parseFloat(fiTargetInput.value);
      }
    }

    // Validate Monthly Income (optional but if provided, must be non-negative)
    if (monthlyIncomeInput?.value) {
      const incomeError = validateFormInput(monthlyIncomeInput.value, [
        ValidationRules.positiveNumber('Monthly Income'),
      ]);
      if (incomeError) {
        validationErrors.push({ field: 'monthly-income', message: incomeError });
      } else {
        D.profile.monthlyIncome = parseFloat(monthlyIncomeInput.value);
      }
    }

    const taxSlabRate = parseFloat(taxSlabRateInput?.value || '0') || 0;
    if (taxSlabRate < 0 || taxSlabRate > 100) {
      validationErrors.push({ field: 'tax-slab-rate', message: 'Tax slab must be between 0% and 100%' });
    } else {
      D.profile.taxSlabRate = taxSlabRate;
    }

    // ==================== ESOP SECTION ====================
    const esopShares = parseFloat((document.getElementById('esop-shares') as HTMLInputElement)?.value || '0') || 0;
    if (esopShares < 0) {
      validationErrors.push({ field: 'esop', message: 'ESOP shares must be non-negative' });
    }
    D.esopDetails.shares = esopShares;
    refreshEsopProfileValue(activeContext);

    // ==================== SIP SECTION ====================
    for (let i = 1; i <= 10; i++) {
      const nameEl = document.querySelector(`.sip-name[data-index="${i}"]`) as HTMLInputElement;
      const codeEl = document.querySelector(`.sip-code[data-index="${i}"]`) as HTMLInputElement;
      const unitsEl = document.querySelector(`.sip-units[data-index="${i}"]`) as HTMLInputElement;
      const amountEl = document.querySelector(`.sip-amount[data-index="${i}"]`) as HTMLInputElement;
      const startEl = document.querySelector(`.sip-start[data-index="${i}"]`) as HTMLInputElement;
      const costBasisEl = document.querySelector(`.sip-cost-basis[data-index="${i}"]`) as HTMLInputElement;

      const name = nameEl?.value?.trim();
      const code = codeEl?.value?.trim();

      // Only validate if SIP has a name (name required, code optional)
      if (name || code) {
        if (!name) {
          validationErrors.push({ field: `sip${i}-name`, message: `SIP ${i}: Name is required` });
          continue;
        }

        // Validate scheme code format only if code is provided
        if (code) {
          const codeError = validateFormInput(code, [
            ValidationRules.schemeCode(`SIP ${i} Scheme Code`),
          ]);
          if (codeError) {
            validationErrors.push({ field: `sip${i}-code`, message: codeError });
            continue;
          }
        }

        // Validate units (non-negative)
        const units = parseFloat(unitsEl?.value || '0') || 0;
        if (units < 0) {
          validationErrors.push({ field: `sip${i}-units`, message: `SIP ${i}: Units cannot be negative` });
          continue;
        }

        // Validate monthly amount (non-negative)
        const amount = parseFloat(amountEl?.value || '0') || 0;
        if (amount < 0) {
          validationErrors.push({ field: `sip${i}-amount`, message: `SIP ${i}: Monthly amount cannot be negative` });
          continue;
        }

        // Validate start date if provided (YYYY-MM format)
        const start = startEl?.value?.trim();
        if (start) {
          const dateError = validateFormInput(start, [
            ValidationRules.dateYYYYMM(`SIP ${i} Start Date`),
          ]);
          if (dateError) {
            validationErrors.push({ field: `sip${i}-start`, message: dateError });
            continue;
          }
        }

        // Validate invested amount if provided (non-negative)
        const costBasis = parseFloat(costBasisEl?.value || '0') || 0;
        if (costBasis < 0) {
          validationErrors.push({ field: `sip${i}-cost-basis`, message: `SIP ${i}: Invested amount cannot be negative` });
          continue;
        }

        // If all validations pass, save SIP
        D.sip[`sip${i}`] = {
          name,
          schemeCode: code,
          units,
          monthlyAmount: amount,
          startDate: start || '',
          ...(costBasis > 0 ? { costBasis } : {}),
        };
      } else {
        // Clear SIP if both name and code are empty
        delete D.sip[`sip${i}`];
      }
    }

    // ==================== OTHER HOLDINGS SECTION ====================
    if (typeof D.otherHoldings !== 'object' || D.otherHoldings === null) D.otherHoldings = {};
    for (let i = 1; i <= 54; i++) {
      const nameEl = document.querySelector(`.other-holding-name[data-index="${i}"]`) as HTMLInputElement;
      const amountEl = document.querySelector(`.other-holding-amount[data-index="${i}"]`) as HTMLInputElement;
      const returnEl = document.querySelector(`.other-holding-return[data-index="${i}"]`) as HTMLInputElement;
      const name = nameEl?.value?.trim() || '';
      const amount = parseFloat(amountEl?.value || '0');
      const annualReturn = parseFloat(returnEl?.value || '0');

      if (!name && !amountEl?.value && !returnEl?.value) {
        const core = CORE_HOLDING_ROWS[i as keyof typeof CORE_HOLDING_ROWS];
        if (core) D[core.stateKey][core.stateKey] = { amount: 0, currency: 'INR' };
        delete D.otherHoldings[`otherHolding${i}`];
        continue;
      }
      if (!name) {
        validationErrors.push({ field: `otherHolding${i}-name`, message: `Holding ${i}: Name is required` });
        continue;
      }
      if (!Number.isFinite(amount) || amount < 0) {
        validationErrors.push({ field: `otherHolding${i}-amount`, message: `Holding ${i}: Amount must be non-negative` });
        continue;
      }
      if (!Number.isFinite(annualReturn) || annualReturn < 0 || annualReturn > 100) {
        validationErrors.push({ field: `otherHolding${i}-return`, message: `Holding ${i}: Annual return must be between 0% and 100%` });
        continue;
      }

      D.otherHoldings[`otherHolding${i}`] = { name, amount, annualReturn };

      const core = CORE_HOLDING_ROWS[i as keyof typeof CORE_HOLDING_ROWS];
      if (core) D[core.stateKey][core.stateKey] = { amount, currency: 'INR' };
    }

    // ==================== SHOW VALIDATION ERRORS ====================
    if (validationErrors.length > 0) {
      const errorMessages = validationErrors.map((e) => e.message).join('; ');
      activeContext.ports.ui.showToast(`⚠️ Validation failed: ${errorMessages}`, 4000, 'warning');
      console.warn('Profile validation errors:', validationErrors);
      return false;
    }

    // ==================== SAVE DATA ====================
    activeContext.portfolio.save(D, { sync: false });

    // Fetch NAVs for SIPs that now have units
    activeContext.ports.marketData.refreshPortfolioNAVs(D).catch(e => console.warn('[Profile] Failed to fetch SIP NAVs after save:', e));

    return true;
  } catch (e) {
    console.error('Profile save error:', e);
    handleError(e, 'Failed to save profile');
    return false;
  }
}

/**
 * Handle PDF import
 */
async function handlePDFImport(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const result = await parseCASPDF(file);
    const soaHoldings = result.holdings.filter(h => h.type === 'soa');

    const modal = document.getElementById('pdf-confirmation');
    const preview = document.getElementById('pdf-preview');
    if (modal && preview) {
      let html = `<h4>Detected Holdings (as on ${result.asOnDate}):</h4>`;
      html += `<p><strong>${result.investor.name}</strong> | PAN: ${result.investor.pan}</p>`;
      html += '<h5>Mutual Funds:</h5>';
      soaHoldings.forEach(h => {
        html += `<p>📈 ${h.schemeName}: ${h.balanceUnits.toFixed(3)} units`;
        html += ` | Invested: ₹${h.investedValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
        html += ` | Current: ₹${h.marketValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>`;
      });
      const dematHoldings = result.holdings.filter(h => h.type === 'demat');
      if (dematHoldings.length) {
        html += '<h5>Demat Holdings (not imported — ISIN unavailable in summary):</h5>';
        dematHoldings.forEach(h => {
          html += `<p>📊 ${h.schemeName}: ${h.balanceUnits.toFixed(3)} units | Current: ₹${h.marketValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>`;
        });
      }
      preview.innerHTML = html;
      (window as any)._pendingCASImport = result;
      modal.style.display = 'flex';
    }
  } catch (e) {
    console.error('PDF import error:', e);
    activeContext.ports.ui.showToast('✗ Failed to parse PDF');
  }
}

/**
 * Confirm PDF import and update state
 */
function confirmPDFImport() {
  const result: CASParseResult | null = (window as any)._pendingCASImport;
  if (!result) return;

  // Clear existing SIPs before importing to avoid duplicates
  D.sip = {};

  let nextSipSlot = 1;
  result.holdings
    .filter(h => h.type === 'soa')
    .forEach((h) => {
      const sipKey = `sip${nextSipSlot}`;
      D.sip[sipKey] = {
        name: h.schemeName,
        units: h.balanceUnits,
        startDate: h.navDate ? h.navDate.substring(0, 7) : new Date().toISOString().substring(0, 7),
        monthlyAmount: 0,
        ...(h.investedValue > 0 ? { costBasis: h.investedValue } : {}),
      };
      nextSipSlot++;
    });

  // Clear existing demat before importing to match CAS exactly
  D.demat = {};

  result.holdings
    .filter(h => h.type === 'demat' && h.balanceUnits > 0)
    .forEach(h => {
      const key = h.identifier
        ? h.identifier.replace(/\W+/g, '_')
        : h.schemeName.replace(/\W+/g, '_').toLowerCase().substring(0, 20);
      D.demat[key] = {
        isin: '',
        name: h.schemeName,
        quantity: h.balanceUnits,
        currentValue: h.marketValue,
      };
    });

  const modal = document.getElementById('pdf-confirmation');
  if (modal) modal.style.display = 'none';

  const container = document.getElementById('profile');
  if (container) renderProfile(container);
  activeContext.ports.ui.showToast('✓ CAS imported (click Save to sync to cloud)', 4000, 'info');
}

/**
 * Cancel PDF import
 */
function cancelPDFImport() {
  const modal = document.getElementById('pdf-confirmation');
  if (modal) modal.style.display = 'none';
  (window as any)._pendingCASImport = null;
}


