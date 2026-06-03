/**
 * Profile Module
 * Manages user portfolio data, holdings forms, CAS PDF import, and data export/import
 */

import { D } from '../../main';
import { formatCurrency, formatDateISO } from '../../lib/formatters';
import { saveData } from '../../lib/storage';
import { showToast } from '../ui';
import { parseCASPDF } from './pdf-parser';
import { validateFormInput, validateFormFields, handleError, ValidationError, ValidationRules } from '../../lib/error-handler';
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
            <input type="number" id="fi-target" placeholder="25x annual expenses" value="${D.profile.fiTarget || ''}">
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
        <div class="data-actions">
          <button id="import-pdf-btn" class="btn-primary">📄 Import CAS PDF</button>
          <button id="export-json-btn" class="btn-primary">💾 Export Data</button>
          <button id="import-json-btn" class="btn-primary">📂 Import Data</button>
        </div>
        <input type="file" id="pdf-input" accept=".pdf" style="display: none;">
        <input type="file" id="json-input" accept=".json" style="display: none;">
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
  let html = '';
  for (let i = 1; i <= 4; i++) {
    const sip = D.sip[`sip${i}`];
    html += `
      <fieldset class="sip-fieldset">
        <legend>SIP ${i}</legend>
        <div class="form-row">
          <div class="form-group">
            <label>Name</label>
            <input type="text" class="sip-name" data-index="${i}" placeholder="Fund name" value="${sip?.name || ''}">
          </div>
          <div class="form-group">
            <label>Scheme Code</label>
            <input type="text" class="sip-code" data-index="${i}" placeholder="Code" value="${sip?.schemeCode || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Units</label>
            <input type="number" class="sip-units" data-index="${i}" placeholder="Units" value="${sip?.units || ''}">
          </div>
          <div class="form-group">
            <label>Monthly Amount (₹)</label>
            <input type="number" class="sip-amount" data-index="${i}" placeholder="Monthly SIP" value="${sip?.monthlyAmount || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Start Date (YYYY-MM)</label>
            <input type="text" class="sip-start" data-index="${i}" placeholder="2023-01" value="${sip?.startDate || ''}">
          </div>
          <div class="form-group">
            <label>Cost Basis Override (₹)</label>
            <input type="number" class="sip-cost-basis" data-index="${i}" placeholder="Optional" value="${sip?.costBasis || ''}">
          </div>
        </div>
      </fieldset>
    `;
  }
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
        <span>Value: ₹${formatCurrency(h.currentValue)}</span>
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
      for (let i = 5; i <= 10; i++) {
        if (!D.sip[`sip${i}`]) {
          D.sip[`sip${i}`] = {
            name: '',
            schemeCode: '',
            units: 0,
            startDate: '',
            monthlyAmount: 0,
          };
          saveProfile();
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

  // JSON export
  document.getElementById('export-json-btn')?.addEventListener('click', exportPortfolioJSON);

  // JSON import
  document.getElementById('import-json-btn')?.addEventListener('click', () => {
    document.getElementById('json-input')?.click();
  });

  document.getElementById('json-input')?.addEventListener('change', handleJSONImport);

  // Confirmation modal
  document.getElementById('pdf-confirm-btn')?.addEventListener('click', confirmPDFImport);
  document.getElementById('pdf-cancel-btn')?.addEventListener('click', cancelPDFImport);
}

/**
 * Debounced profile save
 */
function debounceProfileSave() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(saveProfile, DEBOUNCE_MS);
}

/**
 * Save profile data from form with comprehensive validation
 */
function saveProfile() {
  try {
    const validationErrors: Array<{ field: string; message: string }> = [];

    // ==================== PROFILE SECTION ====================
    const nameInput = document.getElementById('name') as HTMLInputElement;
    const ageInput = document.getElementById('age') as HTMLInputElement;
    const expensesInput = document.getElementById('expenses') as HTMLInputElement;
    const fiTargetInput = document.getElementById('fi-target') as HTMLInputElement;

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
        ValidationRules.positiveNumber('Annual Expenses'),
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

      // Only validate if SIP has a name AND code (both or neither required)
      if (name || code) {
        if (!name) {
          validationErrors.push({ field: `sip${i}-name`, message: `SIP ${i}: Name is required` });
          continue;
        }
        if (!code) {
          validationErrors.push({ field: `sip${i}-code`, message: `SIP ${i}: Scheme Code is required` });
          continue;
        }

        // Validate scheme code format (6 digits)
        const codeError = validateFormInput(code, [
          ValidationRules.schemeCode(`SIP ${i} Scheme Code`),
        ]);
        if (codeError) {
          validationErrors.push({ field: `sip${i}-code`, message: codeError });
          continue;
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

        // Validate cost basis override if provided (non-negative)
        const costBasis = parseFloat(costBasisEl?.value || '0') || 0;
        if (costBasis < 0) {
          validationErrors.push({ field: `sip${i}-cost-basis`, message: `SIP ${i}: Cost basis cannot be negative` });
          continue;
        }

        // If all validations pass, save SIP
        D.sip[`sip${i}`] = {
          name,
          schemeCode: code,
          units,
          monthlyAmount: amount,
          startDate: start || '',
          costBasis: costBasis > 0 ? costBasis : undefined,
        };
      } else {
        // Clear SIP if both name and code are empty
        delete D.sip[`sip${i}`];
      }
    }

    // ==================== HOLDINGS SECTION ====================
    const fdInput = document.getElementById('fd') as HTMLInputElement;
    const epfInput = document.getElementById('epf') as HTMLInputElement;
    const esopInput = document.getElementById('esop') as HTMLInputElement;

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
      return;
    }

    // ==================== SAVE DATA ====================
    saveData(D);
    showToast('✓ Profile saved successfully');
  } catch (e) {
    console.error('Profile save error:', e);
    handleError(e, 'Failed to save profile');
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
    const text = await parseCASPDF(file);
    const { funds, stocks } = parseCASContent(text);

    // Show confirmation modal
    const modal = document.getElementById('pdf-confirmation');
    const preview = document.getElementById('pdf-preview');
    if (modal && preview) {
      let html = '<h4>Detected Holdings:</h4>';
      html += '<h5>Mutual Funds:</h5>';
      funds.forEach((f) => {
        html += `<p>📈 ${f.name}: ${f.units} units (Updated: ${f.date})</p>`;
      });
      html += '<h5>Demat Stocks:</h5>';
      stocks.forEach((s) => {
        html += `<p>📊 ${s.name} (${s.isin}): ${s.quantity} qty</p>`;
      });
      preview.innerHTML = html;

      // Store for confirmation
      (window as any)._pendingCASImport = { funds, stocks };

      modal.style.display = 'flex';
    }
  } catch (e) {
    console.error('PDF import error:', e);
    showToast('✗ Failed to parse PDF');
  }
}

/**
 * Parse CAS PDF content
 */
function parseCASContent(text: string): { funds: any[]; stocks: any[] } {
  const funds: any[] = [];
  const stocks: any[] = [];

  const lines = text.split('\n');
  console.log('CAS parsing: total lines:', lines.length);
  console.log('CAS parsing: sample lines:', lines.slice(0, 20));

  // Pass 1: Find all ISIN entries (both MF and Demat)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip header/metadata lines
    if (line.match(/Consolidated Account|As on Date|Report|Summary|Page|Date:/i)) {
      continue;
    }

    // Match ISIN pattern: XX999999999X (strict - must be exactly 12 chars)
    const isinMatch = line.match(/([A-Z]{2}\d{9}[A-Z]{1})/);
    if (!isinMatch) {
      // Log lines that might contain ISINs
      if (line.match(/[A-Z]{2}\d{8,10}[A-Z]?/)) {
        console.log('CAS: line with potential ISIN but no match:', line.substring(0, 100));
      }
      continue;
    }
    console.log('CAS: ISIN found:', isinMatch[1]);

    const isin = isinMatch[1];
    const parts = line.split(/\s+/);

    // Try to extract quantity/units from the line
    let quantity = 0;
    let fundName = '';

    if (parts.length >= 2) {
      // Extract all numbers from the line
      const numbers = [];
      for (const part of parts) {
        const num = parseFloat(part.replace(/,/g, ''));
        if (!isNaN(num) && num > 0) {
          numbers.push(num);
        }
      }

      // Use the last number as quantity (usually units/shares)
      if (numbers.length > 0) {
        quantity = numbers[numbers.length - 1];
        fundName = line.replace(isin, '')
          .replace(/[\d.,\s]+$/g, '') // Remove trailing numbers
          .trim();
      }
    }

    // Sanity checks: valid fund name and reasonable quantity
    if (quantity > 0 && fundName && fundName.length > 2) {
      // Classify as MF or Stock based on context
      const isMF = line.match(/Mutual Fund|MF|NSDL|Fund|Scheme|Growth|Dividend/i) ||
                   !line.match(/Equity|Stock|NSE|BSE|Demat|Shares/i);

      if (isMF) {
        funds.push({
          name: fundName.substring(0, 50),
          units: quantity,
          date: new Date().toISOString().split('T')[0],
        });
      } else {
        stocks.push({
          isin,
          name: fundName.substring(0, 100),
          quantity,
        });
      }
    }
  }

  console.log('Parsed CAS:', { fundCount: funds.length, stockCount: stocks.length, funds, stocks });
  return { funds, stocks };
}

/**
 * Confirm PDF import and update state
 */
function confirmPDFImport() {
  const pending = (window as any)._pendingCASImport;
  if (!pending) return;

  const { funds, stocks } = pending;

  // Update SIP data
  funds.forEach((fund: any, idx: number) => {
    const sipKey = `sip${idx + 1}`;
    if (!D.sip[sipKey]) {
      D.sip[sipKey] = {
        name: fund.name,
        schemeCode: '',
        units: fund.units,
        startDate: fund.date.substring(0, 7),
        monthlyAmount: 0,
      };
    }
  });

  // Update demat holdings
  stocks.forEach((stock: any) => {
    D.demat[stock.isin] = {
      isin: stock.isin,
      name: stock.name,
      quantity: stock.quantity,
      currentValue: 0,
    };
  });

  // Hide modal
  const modal = document.getElementById('pdf-confirmation');
  if (modal) modal.style.display = 'none';

  // Re-render profile FIRST to update form inputs with imported data
  const container = document.getElementById('profile');
  if (container) renderProfile(container);

  // THEN save to persist the imported data
  saveProfile();

  showToast('✓ CAS imported successfully');
}

/**
 * Cancel PDF import
 */
function cancelPDFImport() {
  const modal = document.getElementById('pdf-confirmation');
  if (modal) modal.style.display = 'none';
  (window as any)._pendingCASImport = null;
}

/**
 * Export portfolio as JSON
 */
function exportPortfolioJSON() {
  const data = {
    version: 'fireOS_v2',
    exportedAt: new Date().toISOString(),
    profile: D.profile,
    sip: D.sip,
    fd: D.fd,
    epf: D.epf,
    esop: D.esop,
    demat: D.demat,
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fireOS_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('✓ Data exported');
}

/**
 * Handle JSON import
 */
async function handleJSONImport(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (data.version === 'fireOS_v2') {
      // Merge imported data
      Object.assign(D.profile, data.profile);
      Object.assign(D.sip, data.sip);
      Object.assign(D.fd, data.fd);
      Object.assign(D.epf, data.epf);
      Object.assign(D.esop, data.esop);
      Object.assign(D.demat, data.demat);
    } else {
      // Legacy v1 format
      console.warn('Importing legacy format');
    }

    saveData(D);
    showToast('✓ Data imported');

    const container = document.getElementById('profile');
    if (container) renderProfile(container);
  } catch (e) {
    console.error('JSON import error:', e);
    showToast('✗ Failed to import JSON');
  }
}
