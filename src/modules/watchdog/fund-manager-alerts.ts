/**
 * Fund Manager Alert Rules Module
 * Monitors fund health: AUM limits, block thresholds, manager exits
 * Generates actionable alerts with severity levels and recommendations
 */

import type { FireOSState } from '../../types/state';

/**
 * Input parameters for watchdog rule checking
 */
export interface WatchdogCheckParams {
  ppfcfAum: number; // Current PPFCF AUM
  ppfcfAumLimit: number; // Threshold: ₹1.75L Cr
  nipponGrowthBlockedDays: number; // Days fund is blocked for redemptions
  nipponSmallCapBlockedDays: number; // Days fund is blocked for redemptions
  ppfcfManagerExit: boolean; // Rajeev Thakkar exit status
  nipponSmallCapManagerExit: boolean; // Samir Rachh exit status
}

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
 * Check all watchdog rules and return applicable alerts
 * @param params Input state for rule checking
 * @returns Array of alerts (empty if all rules pass)
 */
export function checkWatchdogRules(params: WatchdogCheckParams): WatchdogAlert[] {
  const alerts: WatchdogAlert[] = [];

  // Check PPFCF AUM breach
  if (params.ppfcfAum > params.ppfcfAumLimit) {
    const aumCr = (params.ppfcfAum / 10000000000).toFixed(1);
    alerts.push({
      type: 'aum-breach',
      fund: 'PPFCF',
      message: `PPFCF AUM has exceeded ₹${aumCr}L Cr (limit: ₹1.75L Cr)`,
      severity: 'high',
      action: 'Review Plan B = Mirae Asset Flexi Cap Direct (similar defensive profile)',
    });
  }

  // Check Nippon Growth block threshold (>14 days)
  if (params.nipponGrowthBlockedDays > 14) {
    alerts.push({
      type: 'block-threshold',
      fund: 'NipponGrowth',
      message: `Nippon Growth blocked for ${params.nipponGrowthBlockedDays} days (threshold: 14 days)`,
      severity: 'medium',
      action: 'Prepare Plan B = Motilal Oswal Midcap Direct (similar mid-cap exposure)',
    });
  }

  // Check Nippon Small Cap block threshold (>60 days)
  if (params.nipponSmallCapBlockedDays > 60) {
    alerts.push({
      type: 'block-threshold',
      fund: 'NipponSmallCap',
      message: `Nippon Small Cap blocked for ${params.nipponSmallCapBlockedDays} days (threshold: 60 days)`,
      severity: 'high',
      action: 'Temporary switch to SBI Small Cap Direct or Bandhan Small Cap Direct until liquidity returns',
    });
  }

  // Check PPFCF manager exit
  if (params.ppfcfManagerExit) {
    alerts.push({
      type: 'manager-exit',
      fund: 'PPFCF',
      message: 'PPFCF fund manager (Rajeev Thakkar) has exited',
      severity: 'critical',
      action: 'Pause lump-sum investments immediately; continue monthly SIP only. Evaluate replacement fund.',
    });
  }

  // Check Nippon Small Cap manager exit
  if (params.nipponSmallCapManagerExit) {
    alerts.push({
      type: 'manager-exit',
      fund: 'NipponSmallCap',
      message: 'Nippon Small Cap fund manager (Samir Rachh) has exited',
      severity: 'critical',
      action: 'Pause lump-sum investments immediately; continue monthly SIP only. Evaluate replacement fund.',
    });
  }

  return alerts;
}

/**
 * Continuously monitor watchdog rules at 24-hour intervals
 * @param D FireOSState object
 * @param callback Function called with alerts whenever check runs
 * @returns Function to stop monitoring
 */
export function monitorWatchdogRules(
  D: FireOSState,
  callback: (alerts: WatchdogAlert[]) => void,
): () => void {
  // Run check immediately on start
  runCheck();

  // Schedule daily check (24 hours = 86400000 ms)
  const intervalId = setInterval(() => {
    runCheck();
  }, 24 * 60 * 60 * 1000);

  function runCheck(): void {
    try {
      // Extract fund AUM and block data from D (source: external monitoring system)
      // For now, placeholder values - actual implementation would fetch from API/monitoring system
      const ppfcfAum = D.watchdogRules?.currentAum?.PPFCF || 0;
      const nipponGrowthBlockedDays = D.watchdogRules?.blockedDays?.NipponGrowth || 0;
      const nipponSmallCapBlockedDays = D.watchdogRules?.blockedDays?.NipponSmallCap || 0;

      const alerts = checkWatchdogRules({
        ppfcfAum,
        ppfcfAumLimit: D.watchdogRules.ppfcfAumLimit,
        nipponGrowthBlockedDays,
        nipponSmallCapBlockedDays,
        ppfcfManagerExit: D.watchdogRules.managerExits.PPFCF,
        nipponSmallCapManagerExit: D.watchdogRules.managerExits.NipponSmallCap,
      });

      callback(alerts);
    } catch (error) {
      console.error('[Watchdog] Error during monitoring check:', error);
      // Continue monitoring even if check fails
    }
  }

  // Return stop function
  return () => {
    clearInterval(intervalId);
  };
}
