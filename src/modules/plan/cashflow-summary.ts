import type { FireOSState } from '../../types/state';

export function renderCashflowSummary(state: FireOSState): string {
  const annualIncome = state.profile.monthlyIncome ? state.profile.monthlyIncome * 12 : 0;
  const annualExpenses = state.profile.annualExpenses ? state.profile.annualExpenses * 12 : 0;
  
  if (!annualIncome) {
    return `
      <div class="cashflow-card" style="padding: 1.25rem; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
        <p class="text-secondary">Please add monthly income to your profile to see cashflow analysis.</p>
      </div>
    `;
  }
  
  const surplus = annualIncome - annualExpenses;
  const savingsRate = (surplus / annualIncome) * 100;
  
  const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  
  return `
    <div class="cashflow-card" style="padding: 1.25rem; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
       <h3 style="font-family:'Fira Code', monospace; font-size:1.1rem; color: var(--color-primary); margin-bottom: 1rem;">Annual Cashflow</h3>
       <div style="display: flex; flex-direction: column; gap: 0.5rem; font-family: 'Fira Sans', sans-serif;">
         <div style="display:flex; justify-content:space-between;">
           <span class="text-secondary">Income (Post-tax estimate)</span>
           <span>${formatter.format(annualIncome)}</span>
         </div>
         <div style="display:flex; justify-content:space-between;">
           <span class="text-secondary">Expenses</span>
           <span class="text-red">-${formatter.format(annualExpenses)}</span>
         </div>
         <div style="height:1px; background: rgba(255,255,255,0.1); margin: 0.5rem 0;"></div>
         <div style="display:flex; justify-content:space-between; font-weight: bold;">
           <span>Surplus</span>
           <span class="${surplus >= 0 ? 'text-green' : 'text-red'}">${formatter.format(surplus)}</span>
         </div>
         <div style="display:flex; justify-content:space-between; margin-top: 0.5rem; font-size: 0.9rem;">
           <span class="text-secondary">Savings Rate</span>
           <span class="text-primary">${savingsRate.toFixed(1)}%</span>
         </div>
       </div>
    </div>
  `;
}
