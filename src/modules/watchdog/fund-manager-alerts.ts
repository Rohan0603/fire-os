/**
 * Fund Manager Alert Rules Module
 * Monitors user-defined fund health rules: AUM limits, block thresholds,
 * manager changes. Generates actionable alerts with severity levels.
 */

import type { FundWatchdogRule } from '../../types/state';

/**
 * Watchdog alert object with actionable guidance
 */
export interface WatchdogAlert {
  type: 'aum-breach' | 'block-threshold' | 'manager-exit';
  fund: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: string;
}

/**
 * Check all watchdog rules and return applicable alerts. Each rule is
 * self-contained; a rule with no thresholds set never fires.
 * @param rules User-defined watchdog rules
 * @returns Array of alerts (empty if all rules pass)
 */
export function checkWatchdogRules(rules: FundWatchdogRule[]): WatchdogAlert[] {
  const alerts: WatchdogAlert[] = [];

  for (const rule of rules) {
    if (rule.aumLimit != null && rule.currentAum != null && rule.currentAum > rule.aumLimit) {
      alerts.push({
        type: 'aum-breach',
        fund: rule.label,
        message: `${rule.label} assets have exceeded the configured AUM limit`,
        severity: 'high',
        action: 'Review the holding and your pre-selected fallback fund.',
      });
    }

    if (
      rule.blockThresholdDays != null &&
      rule.blockedDays != null &&
      rule.blockedDays > rule.blockThresholdDays
    ) {
      alerts.push({
        type: 'block-threshold',
        fund: rule.label,
        message: `${rule.label} has been blocked from redemptions for ${rule.blockedDays} days (limit: ${rule.blockThresholdDays} days)`,
        severity: 'medium',
        action: 'Review liquidity and consider a temporary alternative until redemption resumes.',
      });
    }

    if (rule.managerExited) {
      alerts.push({
        type: 'manager-exit',
        fund: rule.label,
        message: `${rule.label} fund manager has changed`,
        severity: 'critical',
        action: 'Pause lump-sum investments immediately; continue monthly SIP only. Evaluate the fund.',
      });
    }
  }

  return alerts;
}
