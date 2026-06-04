import type { FireOSState } from '../../types/state';
import { totalNetWorth, fiProgress } from '../dashboard/kpis';

export function renderPlainEnglishSummary(state: FireOSState): string {
  const profile = state.profile;
  const nw = totalNetWorth(state).netWorth;
  const fi = fiProgress(state);
  
  if (!profile.age || !profile.annualExpenses || !profile.fiTarget) {
    return `
      <div class="plain-english-card">
        <p class="text-secondary">Please complete your profile to see your plain English summary.</p>
      </div>
    `;
  }
  
  const nwStr = `₹${(nw / 100000).toFixed(1)} Lakh`;
  const annualExpenses = profile.annualExpenses * 12;
  const expStr = `₹${(annualExpenses / 100000).toFixed(1)} Lakh`;
  const targetStr = `₹${(profile.fiTarget / 10000000).toFixed(2)} Crore`;
  
  let trackStr = "You are currently building your foundation.";
  if (fi.yearsRemaining !== null) {
    if (fi.yearsRemaining === 0) {
      trackStr = "You have already reached your FI target! 🎉";
    } else {
      trackStr = `You are on track to reach your goal in approximately ${Math.ceil(fi.yearsRemaining)} years.`;
    }
  } else if (fi.progressPercent > 0) {
     trackStr = `You are ${fi.progressPercent.toFixed(1)}% of the way to your goal.`;
  }

  return `
    <div class="plain-english-card" style="padding: 1.25rem; background: rgba(255,255,255,0.03); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); font-family: 'Fira Sans', sans-serif; line-height: 1.6; font-size: 1.05rem;">
      <p>
        You are <strong class="text-primary">${profile.age}</strong> years old with a net worth of <strong class="text-primary">${nwStr}</strong>. 
        You spend <strong class="text-primary">${expStr}</strong> a year and aim to reach <strong class="text-primary">${targetStr}</strong>. 
        ${trackStr}
      </p>
    </div>
  `;
}
