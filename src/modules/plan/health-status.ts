import type { FireOSState } from '../../types/state';
import { fiProgress } from '../dashboard/kpis';
import { checkWatchdogRules } from '../watchdog/fund-manager-alerts';

export interface HealthAssessment {
  status: 'green' | 'yellow' | 'red';
  headline: string;
  details: string[];
  dimensions: {
    fiProgress: 'green' | 'yellow' | 'red';
    protection: 'green' | 'yellow' | 'red';
    savingsRate: 'green' | 'yellow' | 'red';
    portfolioHealth: 'green' | 'yellow' | 'red';
  };
}

export function assessHealth(state: FireOSState): HealthAssessment {
  const fi = fiProgress(state);
  // Default assumptions for missing values to avoid crashes
  const annualIncome = state.profile.monthlyIncome ? state.profile.monthlyIncome * 12 : 0;
  
  // Dimensions
  let fiStatus: 'green' | 'yellow' | 'red' = 'green';
  let fiDetail = 'FI target is on track.';
  if (fi.fiTarget > 0 && fi.currentCorpus > 0) {
    if (fi.progressPercent < 10) {
       fiStatus = 'yellow';
       fiDetail = 'FI progress is low, consider reviewing growth rate.';
    }
  } else if (fi.fiTarget === 0) {
    fiStatus = 'yellow';
    fiDetail = 'FI target is not configured.';
  }

  let protectionStatus: 'green' | 'yellow' | 'red' = 'green';
  let protectionDetail = 'Insurance coverage adequate.';
  const ins = state.insurance;
  if (!ins || (ins.termLife.currentCover === 0 && ins.health.currentCover === 0)) {
    protectionStatus = 'red';
    protectionDetail = 'No insurance data configured.';
  } else {
    const requiredTerm = Math.max(annualIncome * 10, 10000000);
    const requiredHealth = ins.health.familySize <= 2 ? 2000000 : 5000000;
    if (ins.termLife.currentCover < requiredTerm || ins.health.currentCover < requiredHealth) {
      protectionStatus = 'yellow';
      protectionDetail = `Insurance gap detected. Need term cover of ₹${(requiredTerm/100000).toFixed(1)}L and health cover of ₹${(requiredHealth/100000).toFixed(1)}L.`;
    }
  }

  let savingsStatus: 'green' | 'yellow' | 'red' = 'green';
  let savingsDetail = 'Savings rate is excellent (>30%).';
  if (annualIncome > 0) {
    const annualExpenses = (state.profile.annualExpenses || 0) * 12;
    const savingsRate = (annualIncome - annualExpenses) / annualIncome;
    if (savingsRate < 0.15) {
      savingsStatus = 'red';
      savingsDetail = `Savings rate is critically low at ${(savingsRate * 100).toFixed(1)}%.`;
    } else if (savingsRate < 0.3) {
      savingsStatus = 'yellow';
      savingsDetail = `Savings rate is ${(savingsRate * 100).toFixed(1)}%, aiming for >30%.`;
    } else {
      savingsDetail = `Savings rate is healthy at ${(savingsRate * 100).toFixed(1)}%.`;
    }
  } else {
    savingsStatus = 'red';
    savingsDetail = 'No income data configured.';
  }

  let portfolioStatus: 'green' | 'yellow' | 'red' = 'green';
  let portfolioDetail = 'No active watchdog alerts.';
  const alerts = checkWatchdogRules({
    ppfcfAum: state.watchdogRules?.currentAum?.PPFCF || 0,
    ppfcfAumLimit: state.watchdogRules?.ppfcfAumLimit || 175000000000,
    nipponGrowthBlockedDays: state.watchdogRules?.blockedDays?.NipponGrowth || 0,
    nipponSmallCapBlockedDays: state.watchdogRules?.blockedDays?.NipponSmallCap || 0,
    ppfcfManagerExit: state.watchdogRules?.managerExits?.PPFCF || false,
    nipponSmallCapManagerExit: state.watchdogRules?.managerExits?.NipponSmallCap || false,
  });

  if (alerts.length > 0) {
    const hasCritical = alerts.some(a => a.severity === 'critical');
    const hasHigh = alerts.some(a => a.severity === 'high');
    if (hasCritical || hasHigh) {
      portfolioStatus = 'red';
      portfolioDetail = 'Critical or High severity watchdog alerts active!';
    } else {
      portfolioStatus = 'yellow';
      portfolioDetail = 'Minor watchdog alerts active.';
    }
  }

  // Aggregate Status
  const statuses = [fiStatus, protectionStatus, savingsStatus, portfolioStatus];
  let overall: 'green' | 'yellow' | 'red' = 'green';
  if (statuses.includes('red')) overall = 'red';
  else if (statuses.includes('yellow')) overall = 'yellow';

  let headline = 'All systems go. No immediate action needed.';
  if (overall === 'red') headline = 'Critical attention required in your plan.';
  else if (overall === 'yellow') headline = 'Some areas need review.';

  return {
    status: overall,
    headline,
    details: [fiDetail, protectionDetail, savingsDetail, portfolioDetail],
    dimensions: {
      fiProgress: fiStatus,
      protection: protectionStatus,
      savingsRate: savingsStatus,
      portfolioHealth: portfolioStatus,
    }
  };
}

export function renderHealthStatusBanner(state: FireOSState): string {
  const assessment = assessHealth(state);
  
  // Icon based on status using Lucide/Heroicons standard SVG paths
  const iconMap = {
    green: `<svg class="health-icon health-icon--green" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
    yellow: `<svg class="health-icon health-icon--yellow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
    red: `<svg class="health-icon health-icon--red" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px;height:24px;"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
  };

  const dimLabels = {
    fiProgress: 'FI Progress',
    protection: 'Protection',
    savingsRate: 'Savings Rate',
    portfolioHealth: 'Portfolio Health'
  };

  const detailsHtml = assessment.details.map((detail, idx) => {
    const dimKey = Object.keys(assessment.dimensions)[idx] as keyof typeof assessment.dimensions;
    const dimStatus = assessment.dimensions[dimKey];
    return `
      <div class="health-detail-row">
        <span class="health-detail-indicator indicator--${dimStatus}"></span>
        <span class="health-detail-label">${dimLabels[dimKey]}:</span>
        <span class="health-detail-text">${detail}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="health-banner health-banner--${assessment.status}">
      <div class="health-banner-header cursor-pointer" id="health-banner-toggle" style="display:flex; justify-content:space-between; align-items:center;">
        <div class="health-banner-title" style="display:flex; align-items:center; gap:0.5rem; font-family:'Fira Code', monospace;">
          ${iconMap[assessment.status]}
          <span>${assessment.headline}</span>
        </div>
        <div class="health-banner-chevron" style="transition: transform 0.3s ease;">▼</div>
      </div>
      <div class="health-banner-details" id="health-banner-details" style="display: none; margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem;">
        ${detailsHtml}
      </div>
    </div>
  `;
}

export function attachHealthBannerListeners(): void {
  const toggle = document.getElementById('health-banner-toggle');
  const details = document.getElementById('health-banner-details');
  const chevron = toggle?.querySelector('.health-banner-chevron') as HTMLElement;
  
  if (toggle && details && chevron) {
    toggle.addEventListener('click', () => {
      const isHidden = details.style.display === 'none';
      details.style.display = isHidden ? 'block' : 'none';
      chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    });
  }
}
