import type { FireOSState } from '../../types/state';
import { totalNetWorth } from '../dashboard/kpis';

export interface MilestoneDef {
  id: string;
  title: string;
  threshold: number;
}

export const NET_WORTH_MILESTONES: MilestoneDef[] = [
  { id: 'nw-10l', title: '₹10 Lakh', threshold: 1000000 },
  { id: 'nw-25l', title: '₹25 Lakh', threshold: 2500000 },
  { id: 'nw-50l', title: '₹50 Lakh', threshold: 5000000 },
  { id: 'nw-1cr', title: '₹1 Crore', threshold: 10000000 },
  { id: 'nw-2cr', title: '₹2 Crore', threshold: 20000000 },
  { id: 'nw-5cr', title: '₹5 Crore', threshold: 50000000 },
  { id: 'nw-10cr', title: '₹10 Crore', threshold: 100000000 },
];

export function checkNewMilestones(state: FireOSState): Record<string, string> {
  const currentNW = totalNetWorth(state).netWorth;
  const newAchieved: Record<string, string> = {};
  const today = new Date().toISOString().split('T')[0];
  
  NET_WORTH_MILESTONES.forEach(m => {
    if (currentNW >= m.threshold && !state.achievedMilestones.includes(m.id)) {
      newAchieved[m.id] = today;
    }
  });
  
  // Custom FI Target milestone
  if (state.profile.fiTarget > 0 && currentNW >= state.profile.fiTarget && !state.achievedMilestones.includes('fi-target')) {
    newAchieved['fi-target'] = today;
  }
  
  return newAchieved;
}

export function renderMilestones(state: FireOSState): string {
  const currentNW = totalNetWorth(state).netWorth;
  const fiTarget = state.profile.fiTarget;
  
  const allMilestones = [...NET_WORTH_MILESTONES];
  if (fiTarget > 0 && !allMilestones.find(m => m.threshold === fiTarget)) {
    allMilestones.push({ id: 'fi-target', title: 'FI Target', threshold: fiTarget });
  }
  
  allMilestones.sort((a, b) => a.threshold - b.threshold);
  
  const newlyAchieved = checkNewMilestones(state);
  
  const combinedAchieved: Record<string, string | boolean> = {};
  state.achievedMilestones.forEach(id => { combinedAchieved[id] = true; });
  Object.keys(newlyAchieved).forEach(id => { combinedAchieved[id] = newlyAchieved[id]; });
  
  // Find the highest achieved and the next target
  let highestAchievedIdx = -1;
  for (let i = 0; i < allMilestones.length; i++) {
    if (combinedAchieved[allMilestones[i].id]) {
      highestAchievedIdx = i;
    }
  }
  
  // Display only 3 milestones: one before (if any), current, and next
  const displayMilestones = [];
  if (highestAchievedIdx >= 0) {
    displayMilestones.push(allMilestones[highestAchievedIdx]);
  }
  if (highestAchievedIdx + 1 < allMilestones.length) {
    displayMilestones.push(allMilestones[highestAchievedIdx + 1]);
  }
  if (highestAchievedIdx + 2 < allMilestones.length && displayMilestones.length < 3) {
    displayMilestones.push(allMilestones[highestAchievedIdx + 2]);
  }
  if (displayMilestones.length === 0 && allMilestones.length > 0) {
    displayMilestones.push(allMilestones[0], allMilestones[1], allMilestones[2]);
  }
  
  const listHtml = displayMilestones.filter(Boolean).map(m => {
    const isAchieved = !!combinedAchieved[m.id];
    const achievedDate = combinedAchieved[m.id] || '';
    
    // Progress calculation for unachieved
    let progressStr = '';
    if (!isAchieved) {
      const prevThreshold = highestAchievedIdx >= 0 ? allMilestones[highestAchievedIdx].threshold : 0;
      const progress = Math.max(0, Math.min(100, ((currentNW - prevThreshold) / (m.threshold - prevThreshold)) * 100));
      progressStr = `<div class="milestone-progress-bar"><div class="milestone-progress-fill" style="width: ${progress}%"></div></div>`;
    }
    
    return `
      <div class="milestone-item ${isAchieved ? 'milestone-item--achieved' : 'milestone-item--pending'}">
        <div class="milestone-icon">
          ${isAchieved ? '✓' : '○'}
        </div>
        <div class="milestone-content">
          <div class="milestone-title">${m.title}</div>
          ${isAchieved ? `<div class="milestone-date">${achievedDate}</div>` : progressStr}
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <div class="milestones-container">
      <h3 style="font-family:'Fira Code', monospace; font-size:1.1rem; color: var(--color-primary); margin-bottom: 1rem;">Milestones</h3>
      <div class="milestones-list" style="display:flex; flex-direction:column; gap:0.75rem;">
        ${listHtml}
      </div>
    </div>
  `;
}
