import { test, expect } from '@playwright/test';
import { checkWatchdogRules } from '../src/modules/watchdog/fund-manager-alerts';

interface WatchdogCheckParams {
  ppfcfAum: number;
  ppfcfAumLimit: number;
  nipponGrowthBlockedDays: number;
  nipponSmallCapBlockedDays: number;
  ppfcfManagerExit: boolean;
  nipponSmallCapManagerExit: boolean;
}

interface WatchdogAlert {
  type: 'aum-breach' | 'block-threshold' | 'manager-exit';
  fund: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: string;
}

// Helper to create test params
const createTestParams = (overrides?: Partial<WatchdogCheckParams>): WatchdogCheckParams => ({
  ppfcfAum: 150000000000,
  ppfcfAumLimit: 175000000000,
  nipponGrowthBlockedDays: 0,
  nipponSmallCapBlockedDays: 0,
  ppfcfManagerExit: false,
  nipponSmallCapManagerExit: false,
  ...overrides,
});

test('checkWatchdogRules: detects PPFCF AUM breach', () => {
  const alerts = checkWatchdogRules({
    ppfcfAum: 180000000000, // ₹1.8L Cr
    ppfcfAumLimit: 175000000000, // ₹1.75L Cr
    nipponGrowthBlockedDays: 0,
    nipponSmallCapBlockedDays: 0,
    ppfcfManagerExit: false,
    nipponSmallCapManagerExit: false,
  });

  expect(alerts.length).toBeGreaterThan(0);
  expect(alerts).toContainEqual(expect.objectContaining({
    type: 'aum-breach',
    fund: 'PPFCF',
    severity: 'high',
    action: expect.stringContaining('Mirae Asset Flexi Cap'),
  }));
});

test('checkWatchdogRules: detects Nippon Growth >14 day block', () => {
  const alerts = checkWatchdogRules(createTestParams({
    nipponGrowthBlockedDays: 15,
  }));

  expect(alerts.length).toBeGreaterThan(0);
  expect(alerts).toContainEqual(expect.objectContaining({
    type: 'block-threshold',
    fund: 'NipponGrowth',
    message: expect.stringContaining('15'),
    severity: 'medium',
    action: expect.stringContaining('Motilal Oswal'),
  }));
});

test('checkWatchdogRules: detects Nippon Small Cap >60 day block', () => {
  const alerts = checkWatchdogRules(createTestParams({
    nipponSmallCapBlockedDays: 65,
  }));

  expect(alerts.length).toBeGreaterThan(0);
  expect(alerts).toContainEqual(expect.objectContaining({
    type: 'block-threshold',
    fund: 'NipponSmallCap',
    message: expect.stringContaining('65'),
    severity: 'high',
    action: expect.stringContaining('SBI') || expect.stringContaining('Bandhan'),
  }));
});

test('checkWatchdogRules: detects PPFCF manager exit (Rajeev Thakkar)', () => {
  const alerts = checkWatchdogRules(createTestParams({
    ppfcfManagerExit: true,
  }));

  expect(alerts.length).toBeGreaterThan(0);
  expect(alerts).toContainEqual(expect.objectContaining({
    type: 'manager-exit',
    fund: 'PPFCF',
    message: expect.stringContaining('Rajeev Thakkar') || expect.stringContaining('manager'),
    severity: 'critical',
    action: expect.stringContaining('Pause'),
  }));
});

test('checkWatchdogRules: detects Nippon Small Cap manager exit (Samir Rachh)', () => {
  const alerts = checkWatchdogRules(createTestParams({
    nipponSmallCapManagerExit: true,
  }));

  expect(alerts.length).toBeGreaterThan(0);
  expect(alerts).toContainEqual(expect.objectContaining({
    type: 'manager-exit',
    fund: 'NipponSmallCap',
    message: expect.stringContaining('Samir Rachh') || expect.stringContaining('manager'),
    severity: 'critical',
    action: expect.stringContaining('Pause'),
  }));
});

test('checkWatchdogRules: returns empty array when no alerts', () => {
  const alerts = checkWatchdogRules(createTestParams());
  expect(alerts).toEqual([]);
});

test('checkWatchdogRules: returns empty array for healthy state', () => {
  const alerts = checkWatchdogRules({
    ppfcfAum: 100000000000, // Well below limit
    ppfcfAumLimit: 175000000000,
    nipponGrowthBlockedDays: 5, // Below 14-day threshold
    nipponSmallCapBlockedDays: 30, // Below 60-day threshold
    ppfcfManagerExit: false,
    nipponSmallCapManagerExit: false,
  });

  expect(alerts).toEqual([]);
});

test('checkWatchdogRules: returns multiple alerts when multiple issues exist', () => {
  const alerts = checkWatchdogRules({
    ppfcfAum: 180000000000, // Breach
    ppfcfAumLimit: 175000000000,
    nipponGrowthBlockedDays: 20, // Block threshold
    nipponSmallCapBlockedDays: 0,
    ppfcfManagerExit: true, // Manager exit
    nipponSmallCapManagerExit: false,
  });

  expect(alerts.length).toBeGreaterThanOrEqual(3);
  expect(alerts.some(a => a.type === 'aum-breach')).toBe(true);
  expect(alerts.some(a => a.type === 'block-threshold')).toBe(true);
  expect(alerts.some(a => a.type === 'manager-exit')).toBe(true);
});

test('checkWatchdogRules: does not alert for Nippon Growth at exactly 14 days', () => {
  const alerts = checkWatchdogRules(createTestParams({
    nipponGrowthBlockedDays: 14,
  }));

  const blockAlerts = alerts.filter(a => a.fund === 'NipponGrowth' && a.type === 'block-threshold');
  expect(blockAlerts).toEqual([]);
});

test('checkWatchdogRules: does not alert for Small Cap at exactly 60 days', () => {
  const alerts = checkWatchdogRules(createTestParams({
    nipponSmallCapBlockedDays: 60,
  }));

  const blockAlerts = alerts.filter(a => a.fund === 'NipponSmallCap' && a.type === 'block-threshold');
  expect(blockAlerts).toEqual([]);
});
