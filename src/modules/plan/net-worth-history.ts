import type { FireOSState } from '../../types/state';

export function renderNetWorthHistory(state: FireOSState): string {
  const history = state.netWorthHistory || [];
  
  if (history.length === 0) {
    return `
      <div class="empty-state">
        <p>No history recorded yet. Snapshots are taken automatically.</p>
      </div>
    `;
  }
  
  // Sort history chronologically just in case
  const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Take last 6 months for chart
  const displayData = sorted.slice(-6);
  
  const maxNetWorth = Math.max(...displayData.map(d => d.value), 1); // Avoid div by zero
  
  const barsHtml = displayData.map(d => {
    const heightPct = (d.value / maxNetWorth) * 100;
    const dateObj = new Date(d.date);
    const label = dateObj.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    const tooltip = `₹${(d.value / 100000).toFixed(2)}L`;
    
    return `
      <div class="nw-chart-bar-container" title="${tooltip}">
        <div class="nw-chart-bar" style="height: ${heightPct}%;"></div>
        <div class="nw-chart-label">${label}</div>
      </div>
    `;
  }).join('');
  
  const trend = displayData.length > 1 
    ? displayData[displayData.length - 1].value - displayData[0].value
    : 0;
  const trendFmt = `${trend >= 0 ? '+' : ''}₹${(trend / 100000).toFixed(2)}L`;
  const trendClass = trend >= 0 ? 'text-green' : 'text-red';
  
  return `
    <div class="nw-history-container">
      <div class="nw-history-header" style="display:flex; justify-content:space-between; margin-bottom: 1rem;">
        <h3 style="font-family:'Fira Code', monospace; font-size:1.1rem; color: var(--color-primary);">6-Month Trend</h3>
        <span class="${trendClass}" style="font-weight:bold;">${trendFmt}</span>
      </div>
      <div class="nw-chart" style="display: flex; align-items: flex-end; justify-content: space-around; height: 150px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; margin-bottom: 1rem;">
        ${barsHtml}
      </div>
    </div>
  `;
}
