/**
 * Watchdog Module - Alpha vs Benchmark Tracker
 * Displays fund performance vs benchmark indices and historical returns
 */

import { D } from '../../main';
import { formatPercentage, formatCurrency } from '../../lib/formatters';
import './styles.css';

export function initWatchdogModule(containerId: string) {
  const container = document.getElementById(containerId);
  if (!container) return;
  renderWatchdog(container);
}

function renderWatchdog(container: HTMLElement) {
  container.innerHTML = `
    <div class="watchdog-container">
      <h2>Alpha vs Benchmark Tracker</h2>
      <p class="watchdog-info">Compare your fund performance against benchmark indices</p>

      ${renderAlphaTracking()}
    </div>
  `;
}

function renderAlphaTracking(): string {
  const alphaData = D.alphaTrackerData || {};

  if (Object.keys(alphaData).length === 0) {
    return `
      <div class="watchdog-empty">
        <p>No benchmark data available.</p>
        <p>Add funds in Profile tab and import CAS PDF to track performance against benchmarks.</p>
      </div>
    `;
  }

  let html = '<div class="alpha-grid">';

  Object.entries(alphaData).forEach(([fundKey, data]: [string, any]) => {
    html += `
      <div class="alpha-card">
        <h3>${data.fundName || fundKey}</h3>
        <div class="benchmark-pair">
          <span class="benchmark-label">Benchmark: ${data.benchmarkName || 'N/A'}</span>
        </div>

        <div class="returns-section">
          <div class="return-item">
            <span class="label">1Y Return</span>
            <span class="fund-value">${data.returns1Y ? formatPercentage(data.returns1Y) : 'N/A'}</span>
            <span class="bench-value">vs ${data.bench1Y ? formatPercentage(data.bench1Y) : 'N/A'}</span>
          </div>
          <div class="return-item">
            <span class="label">3Y Return</span>
            <span class="fund-value">${data.returns3Y ? formatPercentage(data.returns3Y) : 'N/A'}</span>
            <span class="bench-value">vs ${data.bench3Y ? formatPercentage(data.bench3Y) : 'N/A'}</span>
          </div>
          <div class="return-item">
            <span class="label">5Y Return</span>
            <span class="fund-value">${data.returns5Y ? formatPercentage(data.returns5Y) : 'N/A'}</span>
            <span class="bench-value">vs ${data.bench5Y ? formatPercentage(data.bench5Y) : 'N/A'}</span>
          </div>
        </div>

        <div class="alpha-result">
          <span class="label">Alpha (Fund - Benchmark)</span>
          <span class="alpha-value ${data.alpha3Y >= 0 ? 'positive' : 'negative'}">
            ${data.alpha3Y ? formatPercentage(data.alpha3Y) : 'N/A'}
          </span>
        </div>
      </div>
    `;
  });

  html += '</div>';
  return html;
}
