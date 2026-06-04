/**
 * Profile Module
 * Manages user portfolio data, holdings forms, CAS PDF import, and data export/import
 */

import { D } from '../../main';
import { formatCurrency, formatDateISO } from '../../lib/formatters';
import { savePortfolioToFirebase, saveData } from '../../lib/storage';
import { showToast } from '../ui';
import { parseCASPDF, CASParseResult } from './pdf-parser';
import { validateFormInput, validateFormFields, handleError, ValidationError, ValidationRules } from '../../lib/error-handler';
import { getFundSchemeCode } from '../../lib/fundMatcher';
import './styles.css';

const DEBOUNCE_MS = 500;
let debounceTimer: NodeJS.Timeout | null = null;

/**
 * Initialize profile module
 */
export function initProfileModule(containerId: string) {
  const container = document.getElementById(containerId);
  if (!container) return;
  renderProfile(container);
}

/**
 * Render profile form
 */
export function renderProfile(container: HTMLElement) {
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
            <label for="age">Age</label>
            <input type="number" id="age" placeholder="Age" value="${D.profile.age || ''}">
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
        </form>
      </div>

      <div class="profile-section">
        <h3>Mutual Funds & SIPs</h3>
        <form id="sip-form" class="sip-form">
          ${renderSIPFields()}
        </form>
        <button id="add-sip-btn" class="btn-secondary">+ Add SIP</button>
      </div>

      <div class="profile-section">
        <h3>Other Holdings</h3>
        <form id="holdings-form" class="holdings-form">
          <div class="form-group">
            <label for="fd">Fixed Deposits (₹)</label>
            <input type="number" id="fd" placeholder="FD amount" value="${D.fd.fd?.amount || ''}">
          </div>
          <div class="form-group">
            <label for="epf">EPF Balance (₹)</label>
            <input type="number" id="epf" placeholder="EPF balance" value="${D.epf.epf?.amount || ''}">
          </div>
          <div class="form-group">
            <label for="bonds">Bonds (₹)</label>
            <input type="number" id="bonds" placeholder="Bonds value" value="${D.bonds.bonds?.amount || ''}">
          </div>
          <div class="form-group">
            <label for="esop">ESOP Value (₹)</label>
            <input type="number" id="esop" placeholder="ESOP value" value="${D.esop.esop?.amount || ''}">
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
        <h3>Data Management</h3>
        <div class="data-actions" style="display: flex; gap: 1rem; align-items: center; margin-top: 0.5rem;">
          <button id="import-pdf-btn" class="btn-primary">📄 Import CAS PDF</button>
          <button id="save-cloud-btn" class="btn-primary">☁ Save to Cloud</button>
          <span class="save-cloud-hint" style="display: none; color: var(--text-secondary); font-size: 0.875rem;">Log in to sync to cloud</span>
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

  attachProfileHandlers();
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
function attachProfileHandlers() {
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

  // Holdings form inputs
  const holdingsForm = document.getElementById('holdings-form');
  if (holdingsForm) {
    holdingsForm.querySelectorAll('input').forEach((input) => {
      input.addEventListener('blur', debounceProfileSave);
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

  // Save to Cloud button
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

        const { savePortfolioToFirebase } = await import('../../lib/storage');
        await savePortfolioToFirebase(D.currentUser.uid, D);
        showToast('✓ Saved to cloud');
        saveCloudBtn.textContent = '✓ Saved';
      } catch (e) {
        console.error('[Profile] Save to cloud failed:', e);
        showToast('✗ Cloud sync failed', 3000, 'warning');
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
  const ageInput = document.getElementById('age') as HTMLInputElement;
  const expensesInput = document.getElementById('expenses') as HTMLInputElement;
  const fiTargetInput = document.getElementById('fi-target') as HTMLInputElement;
  const monthlyIncomeInput = document.getElementById('monthly-income') as HTMLInputElement;

  const isDirty =
    (nameInput?.value || '') !== (D.profile.name || '') ||
    (ageInput?.value ? parseInt(ageInput.value) : 0) !== (D.profile.age || 0) ||
    (expensesInput?.value ? parseFloat(expensesInput.value) : 0) !== (D.profile.annualExpenses || 0) ||
    (fiTargetInput?.value ? parseFloat(fiTargetInput.value) : 0) !== (D.profile.fiTarget || 0) ||
    (monthlyIncomeInput?.value ? parseFloat(monthlyIncomeInput.value) : 0) !== (D.profile.monthlyIncome || 0);

  // Check SIP fields
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
        return; // Form changed, save
      }
    }
  }

  // Check holdings fields
  if (!isDirty) {
    const fdInput = document.getElementById('fd') as HTMLInputElement;
    const epfInput = document.getElementById('epf') as HTMLInputElement;
    const bondsInput = document.getElementById('bonds') as HTMLInputElement;
    const esopInput = document.getElementById('esop') as HTMLInputElement;

    if ((fdInput?.value ? parseFloat(fdInput.value) : 0) !== (D.fd.fd?.amount || 0) ||
        (epfInput?.value ? parseFloat(epfInput.value) : 0) !== (D.epf.epf?.amount || 0) ||
        (bondsInput?.value ? parseFloat(bondsInput.value) : 0) !== (D.bonds.bonds?.amount || 0) ||
        (esopInput?.value ? parseFloat(esopInput.value) : 0) !== (D.esop.esop?.amount || 0)) {
      // Form changed, save
    } else {
      return; // No changes detected
    }
  }

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
    const ageInput = document.getElementById('age') as HTMLInputElement;
    const expensesInput = document.getElementById('expenses') as HTMLInputElement;
    const fiTargetInput = document.getElementById('fi-target') as HTMLInputElement;
    const monthlyIncomeInput = document.getElementById('monthly-income') as HTMLInputElement;

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

    // Validate age (optional but if provided, must be 0-150)
    if (ageInput?.value) {
      const ageError = validateFormInput(parseInt(ageInput.value), [
        ValidationRules.range('Age', 0, 150),
      ]);
      if (ageError) {
        validationErrors.push({ field: 'age', message: ageError });
      } else {
        D.profile.age = parseInt(ageInput.value);
      }
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

    // ==================== HOLDINGS SECTION ====================
    const fdInput = document.getElementById('fd') as HTMLInputElement;
    const epfInput = document.getElementById('epf') as HTMLInputElement;
    const bondsInput = document.getElementById('bonds') as HTMLInputElement;
    const esopInput = document.getElementById('esop') as HTMLInputElement;

    // Ensure holdings are objects (defensive for corrupted data)
    if (typeof D.fd !== 'object' || D.fd === null) D.fd = {};
    if (typeof D.epf !== 'object' || D.epf === null) D.epf = {};
    if (typeof D.bonds !== 'object' || D.bonds === null) D.bonds = {};
    if (typeof D.esop !== 'object' || D.esop === null) D.esop = {};

    // Validate FD
    if (fdInput?.value) {
      const fdError = validateFormInput(fdInput.value, [
        ValidationRules.positiveNumber('Fixed Deposits'),
      ]);
      if (fdError) {
        validationErrors.push({ field: 'fd', message: fdError });
      } else {
        D.fd.fd = { amount: parseFloat(fdInput.value), currency: 'INR' };
      }
    } else {
      D.fd.fd = { amount: 0, currency: 'INR' };
    }

    // Validate EPF
    if (epfInput?.value) {
      const epfError = validateFormInput(epfInput.value, [
        ValidationRules.positiveNumber('EPF Balance'),
      ]);
      if (epfError) {
        validationErrors.push({ field: 'epf', message: epfError });
      } else {
        D.epf.epf = { amount: parseFloat(epfInput.value), currency: 'INR' };
      }
    } else {
      D.epf.epf = { amount: 0, currency: 'INR' };
    }

    // Validate Bonds
    if (bondsInput?.value) {
      const bondsError = validateFormInput(bondsInput.value, [
        ValidationRules.positiveNumber('Bonds'),
      ]);
      if (bondsError) {
        validationErrors.push({ field: 'bonds', message: bondsError });
      } else {
        D.bonds.bonds = { amount: parseFloat(bondsInput.value), currency: 'INR' };
      }
    } else {
      D.bonds.bonds = { amount: 0, currency: 'INR' };
    }

    // Validate ESOP
    if (esopInput?.value) {
      const esopError = validateFormInput(esopInput.value, [
        ValidationRules.positiveNumber('ESOP Value'),
      ]);
      if (esopError) {
        validationErrors.push({ field: 'esop', message: esopError });
      } else {
        D.esop.esop = { amount: parseFloat(esopInput.value), currency: 'INR' };
      }
    } else {
      D.esop.esop = { amount: 0, currency: 'INR' };
    }

    // ==================== SHOW VALIDATION ERRORS ====================
    if (validationErrors.length > 0) {
      const errorMessages = validationErrors.map((e) => e.message).join('; ');
      showToast(`⚠️ Validation failed: ${errorMessages}`, 4000, 'warning');
      console.warn('Profile validation errors:', validationErrors);
      return false;
    }

    // ==================== SAVE DATA ====================
    saveData(D);

    // Fetch NAVs for SIPs that now have units
    import('./../../modules/dashboard').then(({ fetchSIPNAVs }) => {
      fetchSIPNAVs().catch(e => console.warn('[Profile] Failed to fetch SIP NAVs after save:', e));
    });

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
    showToast('✗ Failed to parse PDF');
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
  showToast('✓ CAS imported (click Save to sync to cloud)', 4000, 'info');
}

/**
 * Cancel PDF import
 */
function cancelPDFImport() {
  const modal = document.getElementById('pdf-confirmation');
  if (modal) modal.style.display = 'none';
  (window as any)._pendingCASImport = null;
}


