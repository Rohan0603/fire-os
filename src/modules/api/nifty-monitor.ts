/**
 * Real-Time Nifty Monitoring & Crash Alert Detection
 * Monitors Nifty 50 level and triggers alerts when significant crashes detected
 *
 * Crash Severity Levels:
 * - < 10%: No alert (normal market volatility)
 * - 10-14.9%: Medium severity, deploy ₹20K
 * - 15-24.9%: High severity, deploy ₹35K
 * - >= 25%: Critical severity, deploy ₹60K
 */

import { getLogger } from '../../lib/logger';
import { fetchNifty } from './nifty';

const logger = getLogger();

/**
 * Input parameters for crash detection
 */
export interface CrashAlertParams {
  current52WeekHigh: number;
  currentLevel: number;
}

/**
 * Crash alert detection result
 */
export interface CrashAlert {
  crashPercentage: number; // Percentage drop from 52W high, rounded to 1 decimal
  severity: 'low' | 'medium' | 'high' | 'critical'; // Alert severity level
  shouldAlert: boolean; // Whether to trigger alert (true if >= 10%)
  deployAmount?: number; // Suggested Wint deployment amount (only if shouldAlert = true)
}

/**
 * Constants for crash alert thresholds
 */
const CRASH_THRESHOLDS = {
  ALERT_MINIMUM: 10, // Minimum crash % to trigger alert
  MEDIUM_THRESHOLD: 15, // < 15% = medium severity
  HIGH_THRESHOLD: 25, // < 25% = high severity
  CRITICAL_THRESHOLD: 25, // >= 25% = critical severity
};

const DEPLOY_AMOUNTS = {
  MEDIUM: 20000, // ₹20K for 10-14.9% crash
  HIGH: 35000, // ₹35K for 15-24.9% crash
  CRITICAL: 60000, // ₹60K for >= 25% crash
};

/**
 * Detect crash alert based on current level vs 52-week high
 * Calculates crash percentage and determines severity level
 *
 * @param params - CrashAlertParams with current52WeekHigh and currentLevel
 * @returns CrashAlert object with severity, shouldAlert, and deployAmount
 */
export function detectCrashAlert(params: CrashAlertParams): CrashAlert {
  const { current52WeekHigh, currentLevel } = params;

  // Validate inputs
  if (!current52WeekHigh || !currentLevel || current52WeekHigh <= 0 || currentLevel <= 0) {
    return {
      crashPercentage: 0,
      severity: 'low',
      shouldAlert: false,
    };
  }

  // Calculate crash percentage: ((high - current) / high) * 100
  const crashPercentage = parseFloat(
    (((current52WeekHigh - currentLevel) / current52WeekHigh) * 100).toFixed(1)
  );

  // Determine severity and deploy amount
  let severity: 'low' | 'medium' | 'high' | 'critical';
  let deployAmount: number | undefined;
  let shouldAlert = false;

  if (crashPercentage < CRASH_THRESHOLDS.ALERT_MINIMUM) {
    // < 10%: No alert
    severity = 'low';
    shouldAlert = false;
  } else if (crashPercentage < CRASH_THRESHOLDS.MEDIUM_THRESHOLD) {
    // 10-14.9%: Medium severity
    severity = 'medium';
    shouldAlert = true;
    deployAmount = DEPLOY_AMOUNTS.MEDIUM;
  } else if (crashPercentage < CRASH_THRESHOLDS.CRITICAL_THRESHOLD) {
    // 15-24.9%: High severity
    severity = 'high';
    shouldAlert = true;
    deployAmount = DEPLOY_AMOUNTS.HIGH;
  } else {
    // >= 25%: Critical severity
    severity = 'critical';
    shouldAlert = true;
    deployAmount = DEPLOY_AMOUNTS.CRITICAL;
  }

  return {
    crashPercentage,
    severity,
    shouldAlert,
    deployAmount,
  };
}

/**
 * Monitor Nifty level in real-time and trigger alerts on crashes
 * Fetches Nifty data every 5 minutes and checks for crashes
 *
 * @param callback - Function to call when crash alert is detected
 *                   Receives CrashAlert object or null if no alert
 * @returns Cleanup function to stop monitoring
 */
export function monitorNiftyLevel(callback: (alert: CrashAlert | null) => void): () => void {
  let isRunning = true;
  let lastAlert: CrashAlert | null = null;

  // Poll every 5 minutes
  const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

  const pollNifty = async () => {
    if (!isRunning) return;

    try {
      const niftyData = await fetchNifty();

      if (niftyData && niftyData.level && niftyData.high52w) {
        const alert = detectCrashAlert({
          current52WeekHigh: niftyData.high52w,
          currentLevel: niftyData.level,
        });

        // Only trigger callback if alert status changed (to avoid duplicate notifications)
        if (alert.shouldAlert && (!lastAlert || lastAlert.severity !== alert.severity)) {
          logger.log('Nifty crash alert detected:', {
            level: niftyData.level,
            high52w: niftyData.high52w,
            crashPercentage: alert.crashPercentage,
            severity: alert.severity,
          });
          lastAlert = alert;
          callback(alert);
        } else if (!alert.shouldAlert && lastAlert?.shouldAlert) {
          // Alert cleared (market recovered)
          logger.log('Nifty crash alert cleared');
          lastAlert = null;
          callback(null);
        }
      }
    } catch (error) {
      logger.warn('Nifty monitoring poll failed:', error);
      // Continue polling on error - don't crash
    }

    // Schedule next poll if still running
    if (isRunning) {
      setTimeout(pollNifty, POLL_INTERVAL);
    }
  };

  // Start polling immediately
  pollNifty();

  // Return cleanup function
  return () => {
    isRunning = false;
    logger.log('Nifty monitoring stopped');
  };
}
