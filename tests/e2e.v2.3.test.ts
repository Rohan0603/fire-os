/**
 * E2E Test for v2.3 Integration
 * Verifies all v2.3 features work together:
 * - Task 1: Coorg Goal Tracker (Kerala home purchase by 2036)
 * - Task 2: Scenario Modeler (FI age calculation with CAGR sliders)
 * - Task 3: (Placeholder for Task 3)
 * - Task 4: Crash Alerts (real-time Nifty monitoring)
 * - Task 5: Portfolio Rebalancing (allocation drift detection)
 * - Task 6: Watchdog Rules (fund health monitoring)
 */

import { test, expect } from '@playwright/test';
import type { FireOSState } from '../src/types/state';
import { calculateCoorgProgress } from '../src/modules/dashboard/coorg-tracker';
import { calculateFIAge, generateScenarios } from '../src/modules/calculators/scenario-modeler';
import { calculateAllocationDrift } from '../src/modules/calculators/portfolio-rebalancing';
import { detectCrashAlert } from '../src/modules/api/nifty-monitor';
import { checkWatchdogRules } from '../src/modules/watchdog/fund-manager-alerts';

/**
 * Create a mock FireOSState with all v2.3 fields populated
 * This represents a realistic user scenario with portfolio data
 */
function createMockFireOSState(): FireOSState {
  return {
    // User Profile
    profile: {
      name: 'Test User',
      age: 32,
      email: 'test@example.com',
      annualExpenses: 1464000, // ₹122K/month × 12
      fiTarget: 5500000, // ₹5.5Cr FI target
    },

    // Holdings
    mf: {},
    fd: {
      fd1: {
        name: 'HDFC FD',
        amount: 500000,
        rate: 7,
        maturityDate: '2026-12-31',
      },
    },
    epf: {
      epf1: {
        name: 'EPF Account',
        amount: 1200000,
      },
    },
    sip: {
      sip1: {
        name: 'Parag Parikh Fund (PPFCF)',
        schemeCode: '122639',
        units: 1000,
        investedAmount: 100000,
        costBasis1: 100000,
        sipStartDate: '2024-01-01',
      },
      sip2: {
        name: 'Nippon India Growth Fund',
        schemeCode: '118668',
        units: 800,
        investedAmount: 90000,
        costBasis2: 90000,
        sipStartDate: '2024-02-01',
      },
      sip3: {
        name: 'Nippon India Small Cap Fund',
        schemeCode: '118778',
        units: 500,
        investedAmount: 60000,
        costBasis3: 60000,
        sipStartDate: '2024-03-01',
      },
      sip4: {
        name: 'Gold ETF',
        schemeCode: '135106',
        units: 300,
        investedAmount: 30000,
        costBasis4: 30000,
        sipStartDate: '2024-04-01',
      },
    },
    esop: {},
    bonds: {},
    demat: {},

    // API Cache and Live Data
    nav: {
      '122639': { nav: 120, date: new Date().toISOString() },
      '118668': { nav: 115, date: new Date().toISOString() },
      '118778': { nav: 125, date: new Date().toISOString() },
      '135106': { nav: 105, date: new Date().toISOString() },
    },
    niftyHigh: 25000,
    niftyData: {
      level: 24000, // 4% down from 52W high
      high52Week: 25000,
      timestamp: new Date().toISOString(),
      source: 'Yahoo Finance',
    },
    eurInr: 90,
    eurInrData: {
      rate: 90,
      timestamp: new Date().toISOString(),
    },

    // Alpha Tracking
    alphaTrackerData: {
      PPFCF: {
        fundReturn: 18.5,
        benchmarkReturn: 14.2,
        outperformance: 4.3,
      },
      NipponGrowth: {
        fundReturn: 22.1,
        benchmarkReturn: 14.2,
        outperformance: 7.9,
      },
    },

    // Task 1: Coorg Goal Tracking (Kerala home purchase by 2036)
    coorgCorpus: 500000, // ₹5L current
    coorgStartDate: '2031-01', // SIP starts Jan 2031
    coorgTarget: 20000000, // ₹2Cr target
    coorgMonthlyAmount: 10000, // ₹10K monthly

    // Task 6: Watchdog Rules & Alerts (fund health monitoring)
    watchdogRules: {
      ppfcfAumLimit: 175000000000, // ₹1.75L Cr
      nipponGrowthBlockThreshold: 14, // days
      nipponSmallCapBlockThreshold: 60, // days
      currentAum: {
        PPFCF: 150000000000, // Current AUM (healthy)
      },
      blockedDays: {
        NipponGrowth: 0, // No blocks
        NipponSmallCap: 0, // No blocks
      },
      managerExits: {
        PPFCF: false, // Rajeev Thakkar still managing
        NipponSmallCap: false, // Manager still managing
      },
    },

    // Authentication & Sync
    currentUser: null,
    _lastSavedAt: new Date().toISOString(),
  };
}

// ============================================================================
// TASK 1: COORG GOAL TRACKER TESTS
// ============================================================================

test.describe('Task 1: Coorg Goal Tracker', () => {
  test('should calculate Coorg progress correctly in planning phase', () => {
    const progress = calculateCoorgProgress({
      currentCorpus: 500000,
      targetCorpus: 20000000,
      currentDate: '2026-06-03',
      sipStartDate: '2031-01',
    });

    expect(progress.percentage).toBe(2.5); // ₹5L / ₹20Cr
    expect(progress.status).toBe('planning');
    expect(progress.yearsUntilStart).toBeCloseTo(4.58, 1);
  });

  test('should transition to in_progress status when SIP starts', () => {
    const progress = calculateCoorgProgress({
      currentCorpus: 5000000,
      targetCorpus: 20000000,
      currentDate: '2031-06-03',
      sipStartDate: '2031-01',
    });

    expect(progress.status).toBe('in_progress');
    expect(progress.percentage).toBe(25);
  });

  test('should show target_reached when corpus >= target', () => {
    const progress = calculateCoorgProgress({
      currentCorpus: 20000000,
      targetCorpus: 20000000,
      currentDate: '2036-06-03',
      sipStartDate: '2031-01',
    });

    expect(progress.status).toBe('target_reached');
    expect(progress.percentage).toBe(100);
  });
});

// ============================================================================
// TASK 2: SCENARIO MODELER TESTS
// ============================================================================

test.describe('Task 2: Scenario Modeler (FI Age Calculator)', () => {
  test('should calculate FI age with 15% CAGR', () => {
    const result = calculateFIAge({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.15,
      currentAge: 32,
    });

    expect(result.fiAge).toBeCloseTo(38.2, 1);
    expect(result.cagr).toBe('15% CAGR');
    expect(result.finalCorpus).toBeGreaterThanOrEqual(5500000);
  });

  test('should calculate FI age with 17% CAGR (optimal)', () => {
    const result = calculateFIAge({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.17,
      currentAge: 32,
    });

    expect(result.fiAge).toBeCloseTo(37.9, 1);
    expect(result.fiAge).toBeLessThan(45); // Should reach FI before 45
  });

  test('should calculate FI age with 13% CAGR (conservative)', () => {
    const result = calculateFIAge({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.13,
      currentAge: 32,
    });

    expect(result.fiAge).toBeCloseTo(38.4, 1);
    expect(result.fiAge).toBeGreaterThan(37); // Conservative estimate
  });

  test('should generate all 4 scenarios (13%, 14%, 15%, 17%)', () => {
    const scenarios = generateScenarios({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      currentAge: 32,
    });

    expect(scenarios.length).toBe(4);
    expect(scenarios[0].cagr).toContain('13%');
    expect(scenarios[1].cagr).toContain('14%');
    expect(scenarios[2].cagr).toContain('15%');
    expect(scenarios[3].cagr).toContain('17%');
  });

  test('scenarios should have earlier FI age with higher CAGR', () => {
    const scenarios = generateScenarios({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      currentAge: 32,
    });

    // 17% CAGR should be earliest (index 3)
    // 13% CAGR should be latest (index 0)
    expect(scenarios[3].fiAge).toBeLessThan(scenarios[0].fiAge);
  });

  test('higher SIP amount should reach FI earlier', () => {
    const result30K = calculateFIAge({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.15,
      currentAge: 32,
    });

    const result50K = calculateFIAge({
      currentCorpus: 500000,
      monthlyAmount: 50000,
      targetCorpus: 5500000,
      cagr: 0.15,
      currentAge: 32,
    });

    expect(result50K.fiAge).toBeLessThan(result30K.fiAge);
  });

  test('annual step-up should reach FI earlier', () => {
    const resultNoStepUp = calculateFIAge({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.15,
      currentAge: 32,
      annualStepUp: 0,
    });

    const resultWithStepUp = calculateFIAge({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.15,
      currentAge: 32,
      annualStepUp: 0.1,
    });

    expect(resultWithStepUp.fiAge).toBeLessThan(resultNoStepUp.fiAge);
  });
});

// ============================================================================
// TASK 4: CRASH ALERT TESTS (Real-time Nifty Monitoring)
// ============================================================================

test.describe('Task 4: Crash Alerts', () => {
  test('should detect 10% market crash (medium severity)', () => {
    const alert = detectCrashAlert({
      current52WeekHigh: 25000,
      currentLevel: 22500, // 10% down
    });

    expect(alert.shouldAlert).toBe(true);
    expect(alert.crashPercentage).toBe(10);
    expect(alert.severity).toBe('medium');
    expect(alert.deployAmount).toBe(20000); // Deploy ₹20K
  });

  test('should detect 15% market crash (high severity)', () => {
    const alert = detectCrashAlert({
      current52WeekHigh: 25000,
      currentLevel: 21250, // 15% down
    });

    expect(alert.shouldAlert).toBe(true);
    expect(alert.crashPercentage).toBe(15);
    expect(alert.severity).toBe('high');
    expect(alert.deployAmount).toBe(35000); // Deploy ₹35K
  });

  test('should detect 25% market crash (critical severity)', () => {
    const alert = detectCrashAlert({
      current52WeekHigh: 25000,
      currentLevel: 18750, // 25% down
    });

    expect(alert.shouldAlert).toBe(true);
    expect(alert.crashPercentage).toBe(25);
    expect(alert.severity).toBe('critical');
    expect(alert.deployAmount).toBe(60000); // Deploy ₹60K
  });

  test('should ignore crashes < 10%', () => {
    const alert = detectCrashAlert({
      current52WeekHigh: 25000,
      currentLevel: 23500, // 6% down
    });

    expect(alert.shouldAlert).toBe(false);
  });

  test('should return healthy state when market is down 4% (current scenario)', () => {
    const alert = detectCrashAlert({
      current52WeekHigh: 25000,
      currentLevel: 24000, // 4% down
    });

    expect(alert.shouldAlert).toBe(false);
  });
});

// ============================================================================
// TASK 5: PORTFOLIO REBALANCING TESTS
// ============================================================================

test.describe('Task 5: Portfolio Rebalancing (Allocation Drift)', () => {
  test('should detect over-allocation in PPFCF (>5% drift)', () => {
    const holdings = {
      PPFCF: 1500000, // 53.6% (target 40%, drift +13.6%)
      NipponGrowth: 600000, // 21.4%
      NipponSmallCap: 400000, // 14.3%
      Gold: 300000, // 10.7%
    };
    const totalValue = 2800000;

    const drift = calculateAllocationDrift(holdings, totalValue);

    expect(drift.current.PPFCF).toBeCloseTo(53.6, 1);
    expect(drift.target.PPFCF).toBe(40);
    expect(drift.driftAmount.PPFCF).toBeCloseTo(13.6, 1);
    expect(drift.recommendations).toContain('Reduce PPFCF by ₹3.8L (13.6% drift)');
  });

  test('should not recommend action when allocation is target', () => {
    const holdings = {
      PPFCF: 800000, // 40% (target 40%)
      NipponGrowth: 600000, // 30% (target 30%)
      NipponSmallCap: 400000, // 20% (target 20%)
      Gold: 200000, // 10% (target 10%)
    };
    const totalValue = 2000000;

    const drift = calculateAllocationDrift(holdings, totalValue);

    expect(drift.driftAmount.PPFCF).toBeCloseTo(0, 1);
    expect(drift.recommendations.length).toBe(0);
  });

  test('should recommend rebalancing for drift > 5%', () => {
    const holdings = {
      PPFCF: 1000000, // 50% (target 40%, drift +10%)
      NipponGrowth: 600000, // 30% (target 30%)
      NipponSmallCap: 300000, // 15% (target 20%, drift -5%)
      Gold: 100000, // 5% (target 10%, drift -5%)
    };
    const totalValue = 2000000;

    const drift = calculateAllocationDrift(holdings, totalValue);

    // Should recommend Reduce PPFCF (drift +10%)
    // NipponSmallCap and Gold are at boundary (-5%), may or may not trigger
    expect(drift.recommendations.some(r => r.includes('PPFCF'))).toBe(true);
  });

  test('should handle zero portfolio gracefully', () => {
    const holdings = {
      PPFCF: 0,
      NipponGrowth: 0,
      NipponSmallCap: 0,
      Gold: 0,
    };
    const totalValue = 0;

    const drift = calculateAllocationDrift(holdings, totalValue);

    expect(drift.current.PPFCF).toBe(0);
    expect(drift.recommendations.length).toBe(0);
  });

  test('should allocate properly with partial portfolio', () => {
    const holdings = {
      PPFCF: 1000000, // 50% (over by 10%)
      NipponGrowth: 1000000, // 50% (over by 20%, under in Gold/SmallCap)
    };
    const totalValue = 2000000;

    const drift = calculateAllocationDrift(holdings, totalValue);

    // Both are over-allocated
    expect(drift.current.PPFCF).toBe(50);
    expect(drift.current.NipponGrowth).toBe(50);
  });
});

// ============================================================================
// TASK 6: WATCHDOG RULES TESTS (Fund Health Monitoring)
// ============================================================================

test.describe('Task 6: Watchdog Rules (Fund Health Monitoring)', () => {
  test('should detect PPFCF AUM breach (>₹1.75L Cr)', () => {
    const alerts = checkWatchdogRules({
      ppfcfAum: 180000000000, // ₹1.8L Cr (exceeds limit)
      ppfcfAumLimit: 175000000000,
      nipponGrowthBlockedDays: 0,
      nipponSmallCapBlockedDays: 0,
      ppfcfManagerExit: false,
      nipponSmallCapManagerExit: false,
    });

    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some(a => a.type === 'aum-breach' && a.fund === 'PPFCF')).toBe(true);
    expect(alerts.some(a => a.action.includes('Mirae Asset'))).toBe(true);
  });

  test('should detect Nippon Growth block >14 days', () => {
    const alerts = checkWatchdogRules({
      ppfcfAum: 150000000000,
      ppfcfAumLimit: 175000000000,
      nipponGrowthBlockedDays: 15, // Exceeds 14-day threshold
      nipponSmallCapBlockedDays: 0,
      ppfcfManagerExit: false,
      nipponSmallCapManagerExit: false,
    });

    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some(a => a.type === 'block-threshold' && a.fund === 'NipponGrowth')).toBe(true);
    expect(alerts.some(a => a.action.includes('Motilal Oswal'))).toBe(true);
  });

  test('should detect Nippon Small Cap block >60 days', () => {
    const alerts = checkWatchdogRules({
      ppfcfAum: 150000000000,
      ppfcfAumLimit: 175000000000,
      nipponGrowthBlockedDays: 0,
      nipponSmallCapBlockedDays: 65, // Exceeds 60-day threshold
      ppfcfManagerExit: false,
      nipponSmallCapManagerExit: false,
    });

    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some(a => a.type === 'block-threshold' && a.fund === 'NipponSmallCap')).toBe(true);
  });

  test('should detect PPFCF manager exit (Rajeev Thakkar)', () => {
    const alerts = checkWatchdogRules({
      ppfcfAum: 150000000000,
      ppfcfAumLimit: 175000000000,
      nipponGrowthBlockedDays: 0,
      nipponSmallCapBlockedDays: 0,
      ppfcfManagerExit: true, // Manager exited
      nipponSmallCapManagerExit: false,
    });

    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some(a => a.type === 'manager-exit' && a.fund === 'PPFCF')).toBe(true);
    expect(alerts.some(a => a.action.toLowerCase().includes('pause'))).toBe(true);
  });

  test('should detect Nippon Small Cap manager exit (Samir Rachh)', () => {
    const alerts = checkWatchdogRules({
      ppfcfAum: 150000000000,
      ppfcfAumLimit: 175000000000,
      nipponGrowthBlockedDays: 0,
      nipponSmallCapBlockedDays: 0,
      ppfcfManagerExit: false,
      nipponSmallCapManagerExit: true, // Manager exited
    });

    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some(a => a.type === 'manager-exit' && a.fund === 'NipponSmallCap')).toBe(true);
  });

  test('should handle healthy fund state (no alerts)', () => {
    const alerts = checkWatchdogRules({
      ppfcfAum: 150000000000, // Below limit
      ppfcfAumLimit: 175000000000,
      nipponGrowthBlockedDays: 5, // Below 14-day threshold
      nipponSmallCapBlockedDays: 30, // Below 60-day threshold
      ppfcfManagerExit: false,
      nipponSmallCapManagerExit: false,
    });

    // Should have no critical alerts
    expect(alerts.filter(a => a.severity === 'critical').length).toBe(0);
  });

  test('should handle multiple simultaneous alerts', () => {
    const alerts = checkWatchdogRules({
      ppfcfAum: 180000000000, // AUM breach
      ppfcfAumLimit: 175000000000,
      nipponGrowthBlockedDays: 15, // Block threshold
      nipponSmallCapBlockedDays: 65, // Block threshold
      ppfcfManagerExit: true, // Manager exit
      nipponSmallCapManagerExit: true, // Manager exit
    });

    // Should have 5 alerts: PPFCF (AUM + Manager), NipponGrowth (Block), NipponSmallCap (Block + Manager)
    expect(alerts.length).toBeGreaterThanOrEqual(4);
  });
});

// ============================================================================
// INTEGRATION TEST: All Features Together
// ============================================================================

test.describe('v2.3 Integration: All Features Working Together', () => {
  test('should process complete user state with all v2.3 features', () => {
    const D = createMockFireOSState();

    // Task 1: Coorg progress
    const coorgProgress = calculateCoorgProgress({
      currentCorpus: D.coorgCorpus,
      targetCorpus: D.coorgTarget,
      currentDate: '2026-06-03',
      sipStartDate: D.coorgStartDate,
    });

    // Task 2: FI age scenarios
    const fiAge = calculateFIAge({
      currentCorpus: 500000 + D.fd.fd1.amount + D.epf.epf1.amount, // Total corpus
      monthlyAmount: 30000, // ₹30K/month SIP
      targetCorpus: D.profile.fiTarget,
      cagr: 0.15,
      currentAge: D.profile.age,
    });

    // Task 4: Crash monitoring
    const crashAlert = detectCrashAlert({
      current52WeekHigh: D.niftyHigh,
      currentLevel: D.niftyData?.level || D.niftyHigh,
    });

    // Task 5: Rebalancing check
    const holdings = {
      PPFCF: 1000 * 120, // ₹1.2L
      NipponGrowth: 800 * 115, // ₹92K
      NipponSmallCap: 500 * 125, // ₹62.5K
      Gold: 300 * 105, // ₹31.5K
    };
    const totalHoldings = Object.values(holdings).reduce((a, b) => a + b, 0);
    const rebalancingDrift = calculateAllocationDrift(holdings, totalHoldings);

    // Task 6: Watchdog alerts
    const watchdogAlerts = checkWatchdogRules({
      ppfcfAum: D.watchdogRules.currentAum.PPFCF,
      ppfcfAumLimit: D.watchdogRules.ppfcfAumLimit,
      nipponGrowthBlockedDays: D.watchdogRules.blockedDays.NipponGrowth,
      nipponSmallCapBlockedDays: D.watchdogRules.blockedDays.NipponSmallCap,
      ppfcfManagerExit: D.watchdogRules.managerExits.PPFCF,
      nipponSmallCapManagerExit: D.watchdogRules.managerExits.NipponSmallCap,
    });

    // Verify all features computed without errors
    expect(coorgProgress.status).toBeDefined();
    expect(fiAge.fiAge).toBeGreaterThan(0);
    expect(crashAlert.shouldAlert).toBeDefined();
    expect(rebalancingDrift.current).toBeDefined();
    expect(watchdogAlerts).toBeDefined();

    // Verify realistic values
    expect(coorgProgress.status).toBe('planning'); // 2.5% to target
    expect(fiAge.fiAge).toBeCloseTo(35.6, 1); // ~35.6 years (with total holdings ~1.7L)
    expect(crashAlert.shouldAlert).toBe(false); // 4% down, no alert
    expect(watchdogAlerts.length).toBe(0); // Healthy state
  });

  test('should handle stress scenario: market crash + rebalancing needed', () => {
    const D = createMockFireOSState();
    D.niftyData!.level = 18750; // 25% crash

    // Crash alert should trigger
    const crashAlert = detectCrashAlert({
      current52WeekHigh: D.niftyHigh,
      currentLevel: D.niftyData.level,
    });
    expect(crashAlert.shouldAlert).toBe(true);
    expect(crashAlert.severity).toBe('critical');
    expect(crashAlert.deployAmount).toBe(60000);

    // Portfolio becomes unbalanced due to market crash
    // (growth funds down more than defensive)
    const holdings = {
      PPFCF: 1000 * 120, // Defensive, relatively unchanged
      NipponGrowth: 800 * 80, // Growth fund down significantly
      NipponSmallCap: 500 * 85, // Small cap down more
      Gold: 300 * 110, // Gold up (safe haven)
    };
    const totalHoldings = Object.values(holdings).reduce((a, b) => a + b, 0);
    const drift = calculateAllocationDrift(holdings, totalHoldings);

    // Portfolio should now be over-weighted in defensive/gold
    expect(drift.current.PPFCF).toBeGreaterThan(40); // Over target
    expect(drift.current.Gold).toBeGreaterThan(10); // Over target
    expect(drift.recommendations.length).toBeGreaterThan(0); // Rebalancing needed
  });

  test('should handle multiple fund alerts scenario', () => {
    const alerts = checkWatchdogRules({
      ppfcfAum: 180000000000, // AUM breach
      ppfcfAumLimit: 175000000000,
      nipponGrowthBlockedDays: 20, // Block threshold breach
      nipponSmallCapBlockedDays: 70, // Block threshold breach
      ppfcfManagerExit: true, // Manager exit
      nipponSmallCapManagerExit: false,
    });

    // Should have multiple alerts
    expect(alerts.length).toBeGreaterThanOrEqual(3);

    // Should include critical alerts
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    expect(criticalAlerts.length).toBeGreaterThan(0);

    // Verify action items are provided
    alerts.forEach(alert => {
      expect(alert.action).toBeTruthy();
      expect(alert.message).toBeTruthy();
    });
  });
});

// ============================================================================
// REGRESSION TESTS: Existing Features Still Work
// ============================================================================

test.describe('Regression: Existing Features Not Broken by v2.3', () => {
  test('Coorg tracker should still work with old state format', () => {
    // Verify backward compatibility
    const progress = calculateCoorgProgress({
      currentCorpus: 0,
      targetCorpus: 20000000,
      currentDate: '2026-06-03',
      sipStartDate: '2031-01',
    });

    expect(progress.status).toBe('planning');
    expect(progress.percentage).toBe(0);
  });

  test('FI age calculation should work with zero corpus', () => {
    const result = calculateFIAge({
      currentCorpus: 0,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.15,
      currentAge: 25,
    });

    expect(result.fiAge).toBeGreaterThan(25);
    expect(result.monthsToFI).toBeGreaterThan(0);
  });

  test('Rebalancing should handle empty portfolio', () => {
    const holdings = {
      PPFCF: 0,
      NipponGrowth: 0,
      NipponSmallCap: 0,
      Gold: 0,
    };

    const drift = calculateAllocationDrift(holdings, 0);

    expect(drift.recommendations.length).toBe(0);
  });

  test('Watchdog should not alert on healthy state', () => {
    const alerts = checkWatchdogRules({
      ppfcfAum: 100000000000, // Well below limit
      ppfcfAumLimit: 175000000000,
      nipponGrowthBlockedDays: 0,
      nipponSmallCapBlockedDays: 0,
      ppfcfManagerExit: false,
      nipponSmallCapManagerExit: false,
    });

    expect(alerts.length).toBe(0);
  });

  test('Crash alert should not trigger on minor downturn', () => {
    const alert = detectCrashAlert({
      current52WeekHigh: 25000,
      currentLevel: 24500, // 2% down
    });

    expect(alert.shouldAlert).toBe(false);
  });
});
