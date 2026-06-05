import type { FireOSState } from '../../types/state';
import { checkWatchdogRules } from '../watchdog/fund-manager-alerts';
import { floatIndicator } from '../dashboard/kpis';
import { calculateAllocationDrift } from '../calculators/portfolio-rebalancing';
import { getFundSchemeCode } from '../../lib/fundMatcher';

export interface ActionItem {
  id: string;              // Unique key for checkbox persistence
  priority: 'urgent' | 'this-month' | 'upcoming' | 'future';
  title: string;
  description: string;
  category: 'invest' | 'protect' | 'tax' | 'review';
  completed: boolean;      // From D.completedActions[id]
}

export function generateActionItems(state: FireOSState): ActionItem[] {
  const actions: ActionItem[] = [];
  const now = new Date();
  const currentMonth = now.getMonth(); // 0 = Jan, 3 = Apr
  const currentYear = now.getFullYear();

  // Helper to add actions
  const addAction = (item: Omit<ActionItem, 'completed'>) => {
    const completedRecord = state.completedActions[item.id];
    let completed = false;
    if (completedRecord) {
      const completedAt = new Date(completedRecord.completedAt);
      const daysSince = (now.getTime() - completedAt.getTime()) / (1000 * 3600 * 24);
      // Reset after 30 days for recurring actions, otherwise keep completed
      if (daysSince < 30) {
        completed = true;
      }
    }
    actions.push({ ...item, completed });
  };

  // 1. Watchdog alerts (urgent)
  const alerts = checkWatchdogRules({
    ppfcfAum: state.watchdogRules?.currentAum?.PPFCF || 0,
    ppfcfAumLimit: state.watchdogRules?.ppfcfAumLimit || 175000000000,
    nipponGrowthBlockedDays: state.watchdogRules?.blockedDays?.NipponGrowth || 0,
    nipponSmallCapBlockedDays: state.watchdogRules?.blockedDays?.NipponSmallCap || 0,
    ppfcfManagerExit: state.watchdogRules?.managerExits?.PPFCF || false,
    nipponSmallCapManagerExit: state.watchdogRules?.managerExits?.NipponSmallCap || false,
  });
  
  alerts.forEach(alert => {
    addAction({
      id: `watchdog-${alert.fund}-${alert.type}`,
      priority: 'urgent',
      category: 'review',
      title: 'Address Fund Health Alert',
      description: alert.message + ' - ' + alert.action,
    });
  });

  // 2. Drawdown > 10% (urgent)
  const float = floatIndicator(state);
  if (float.drawdownPercent > 10) {
    addAction({
      id: `drawdown-crash-${currentYear}-${currentMonth}`,
      priority: 'urgent',
      category: 'invest',
      title: 'Market Drawdown > 10%',
      description: 'Deploy crash protocol. Check Calculators tab for exact deployment amounts.',
    });
  }

  // 3 & 4. Insurance (urgent / this-month)
  const ins = state.insurance;
  const annualIncome = state.profile.monthlyIncome ? state.profile.monthlyIncome * 12 : 0;
  if (!ins || (ins.termLife.currentCover === 0 && ins.health.currentCover === 0)) {
    addAction({
      id: 'insurance-missing',
      priority: 'urgent',
      category: 'protect',
      title: 'Configure Insurance Data',
      description: 'Set up your insurance data in the Insurance tab to evaluate your protection.',
    });
  } else {
    const requiredTerm = Math.max(annualIncome * 10, 10000000);
    const requiredHealth = ins.health.familySize <= 2 ? 2000000 : 5000000;
    
    let gaps = [];
    if (ins.termLife.currentCover < requiredTerm) gaps.push(`term gap ₹${((requiredTerm - ins.termLife.currentCover)/100000).toFixed(1)}L`);
    if (ins.health.currentCover < requiredHealth) gaps.push(`health gap ₹${((requiredHealth - ins.health.currentCover)/100000).toFixed(1)}L`);
    
    if (gaps.length > 0) {
      addAction({
        id: 'insurance-gap',
        priority: 'this-month',
        category: 'protect',
        title: 'Review Insurance Coverage',
        description: `You have an insurance gap: ${gaps.join(', ')}. Review and consider top-up plans.`,
      });
    }
  }

  // 5. Portfolio drift > 5% (this-month)
  const holdings: Record<string, number> = {
    PPFCF: 0,
    NipponGrowth: 0,
    NipponSmallCap: 0,
    Gold: 0,
  };

  const processFund = (fund: any) => {
    const schemeCode = fund.schemeCode || getFundSchemeCode(fund.name);
    const nav = schemeCode ? state.nav[schemeCode]?.nav ?? 0 : 0;
    const value = fund.units * nav;
    if (value > 0) {
      if (schemeCode === '122639') holdings.PPFCF += value;
      else if (schemeCode === '118668') holdings.NipponGrowth += value;
      else if (schemeCode === '118778') holdings.NipponSmallCap += value;
      else if (schemeCode === '135106') holdings.Gold += value;
    }
  };

  if (state.sip) {
    Object.values(state.sip).forEach(processFund);
  }
  if (state.mf) {
    Object.values(state.mf).forEach(processFund);
  }

  const totalValue = holdings.PPFCF + holdings.NipponGrowth + holdings.NipponSmallCap + holdings.Gold;
  const drift = calculateAllocationDrift(holdings, totalValue);
  if (drift.recommendations.length > 0) {
    addAction({
      id: `portfolio-drift-${currentYear}-${currentMonth}`,
      priority: 'this-month',
      category: 'invest',
      title: 'Rebalance Portfolio',
      description: 'Your asset allocation has drifted >5% from targets. ' + drift.recommendations.join(', '),
    });
  }

  // 6. Tax harvest overdue (>11 months since last) (this-month)
  const lastHarvestStr = state.taxCalendar?.lastLTCGHarvestDate;
  if (lastHarvestStr) {
    const lastHarvest = new Date(lastHarvestStr);
    const monthsSince = (now.getTime() - lastHarvest.getTime()) / (1000 * 3600 * 24 * 30);
    if (monthsSince > 11) {
      addAction({
        id: `tax-harvest-${currentYear}`,
        priority: 'this-month',
        category: 'tax',
        title: 'Harvest LTCG Tax Free Exemption',
        description: 'It has been >11 months since your last LTCG harvest. Harvest up to ₹1.25L tax-free.',
      });
    }
  } else if (state.profile.age > 25) {
     // If no harvest recorded, remind to do it.
     addAction({
        id: `tax-harvest-initial`,
        priority: 'this-month',
        category: 'tax',
        title: 'Plan First LTCG Harvest',
        description: 'You haven\'t recorded any LTCG harvests. Use the tax planner to harvest up to ₹1.25L tax-free.',
      });
  }

  // 7. Current month = April (this-month)
  if (currentMonth === 3) {
    addAction({
      id: `step-up-sip-${currentYear}`,
      priority: 'this-month',
      category: 'invest',
      title: 'Step Up SIP',
      description: 'It\'s April! Time to step up your SIP amounts by at least 10%.',
    });
  }

  // 8. FD maturity within 30 days (this-month)
  /*
  Object.entries(state.fd).forEach(([key, fd]) => {
    if (fd.date) {
      const maturityDate = new Date(fd.date);
      const daysToMaturity = (maturityDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
      if (daysToMaturity > 0 && daysToMaturity <= 30) {
        addAction({
          id: `fd-maturity-${key}`,
          priority: 'this-month',
          category: 'review',
          title: 'FD Maturing Soon',
          description: `FD matures on ${fd.date}. Plan for reinvestment.`,
        });
      }
    }
  });
  */

  // 9. Coorg SIP start approaching (< 6 months) (upcoming)
  if (state.coorgStartDate) {
    const [cYear, cMonth] = state.coorgStartDate.split('-').map(Number);
    const coorgStart = new Date(cYear, cMonth - 1, 1);
    const monthsToStart = (coorgStart.getTime() - now.getTime()) / (1000 * 3600 * 24 * 30);
    if (monthsToStart > 0 && monthsToStart < 6) {
      addAction({
        id: 'coorg-sip-approaching',
        priority: 'upcoming',
        category: 'invest',
        title: 'Prepare for Coorg SIP',
        description: `Coorg SIP (₹${state.coorgMonthlyAmount}/mo) starts in ${Math.ceil(monthsToStart)} months (${state.coorgStartDate}). Ensure cashflow.`,
      });
    }
  }

  // 10. LTCG harvest year approaching (year >= 2032) (future)
  // Reusing tax planner logic, but if year >= 2032
  if (currentYear >= 2032) {
    addAction({
      id: `future-harvest-${currentYear}`,
      priority: 'future',
      category: 'tax',
      title: 'Annual LTCG Harvest',
      description: 'Plan your annual LTCG harvest. The ₹1.25L exemption resets every fiscal year.',
    });
  }

  // Sort by priority
  const priorityScore = {
    'urgent': 4,
    'this-month': 3,
    'upcoming': 2,
    'future': 1
  };
  
  return actions.sort((a, b) => {
    // Uncompleted first
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    // Then by priority
    return priorityScore[b.priority] - priorityScore[a.priority];
  });
}

export function renderActionItems(state: FireOSState): string {
  const items = generateActionItems(state);
  
  if (items.length === 0) {
    return `
      <div class="empty-state">
        <p>No pending actions. You're completely up to date!</p>
      </div>
    `;
  }
  
  return items.map(item => `
    <label class="action-item action-item--${item.priority} ${item.completed ? 'action-item--completed' : ''}">
      <input type="checkbox" data-action-id="${item.id}" ${item.completed ? 'checked' : ''} class="cursor-pointer action-checkbox">
      <div class="action-content">
        <div class="action-header">
          <span class="action-category-badge">${item.category}</span>
          <span class="action-title" style="font-weight: 500;">${item.title}</span>
        </div>
        <span class="action-desc" style="display: block; font-size: 0.9rem; opacity: 0.8; margin-top: 0.25rem;">${item.description}</span>
      </div>
    </label>
  `).join('');
}
