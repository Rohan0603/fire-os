import { test, expect } from '@playwright/test';
import { detectCrashAlert } from '../src/modules/api/nifty-monitor';

test('detectCrashAlert identifies 10% crash', () => {
  const alert = detectCrashAlert({
    current52WeekHigh: 25000,
    currentLevel: 22500,
  });
  expect(alert.crashPercentage).toBe(10);
  expect(alert.severity).toBe('medium');
  expect(alert.shouldAlert).toBe(true);
  expect(alert.deployAmount).toBe(20000);
});

test('detectCrashAlert identifies 25% crash', () => {
  const alert = detectCrashAlert({
    current52WeekHigh: 25000,
    currentLevel: 18750,
  });
  expect(alert.crashPercentage).toBe(25);
  expect(alert.severity).toBe('critical');
  expect(alert.shouldAlert).toBe(true);
  expect(alert.deployAmount).toBe(60000);
});

test('detectCrashAlert ignores <10% drops', () => {
  const alert = detectCrashAlert({
    current52WeekHigh: 25000,
    currentLevel: 23500,
  });
  expect(alert.shouldAlert).toBe(false);
});

test('detectCrashAlert handles 15% crash (boundary)', () => {
  const alert = detectCrashAlert({
    current52WeekHigh: 25000,
    currentLevel: 21250,
  });
  expect(alert.crashPercentage).toBe(15);
  expect(alert.severity).toBe('high');
  expect(alert.deployAmount).toBe(35000);
});

test('detectCrashAlert handles exactly 10% boundary', () => {
  const alert = detectCrashAlert({
    current52WeekHigh: 100000,
    currentLevel: 90000,
  });
  expect(alert.crashPercentage).toBe(10);
  expect(alert.severity).toBe('medium');
  expect(alert.shouldAlert).toBe(true);
  expect(alert.deployAmount).toBe(20000);
});

test('detectCrashAlert handles exactly 15% boundary', () => {
  const alert = detectCrashAlert({
    current52WeekHigh: 100000,
    currentLevel: 85000,
  });
  expect(alert.crashPercentage).toBe(15);
  expect(alert.severity).toBe('high');
  expect(alert.deployAmount).toBe(35000);
});

test('detectCrashAlert handles 24% crash (high severity)', () => {
  const alert = detectCrashAlert({
    current52WeekHigh: 25000,
    currentLevel: 19000,
  });
  expect(alert.crashPercentage).toBe(24);
  expect(alert.severity).toBe('high');
  expect(alert.shouldAlert).toBe(true);
  expect(alert.deployAmount).toBe(35000);
});

test('detectCrashAlert handles 9.9% crash (no alert)', () => {
  const alert = detectCrashAlert({
    current52WeekHigh: 100000,
    currentLevel: 90100,
  });
  expect(alert.crashPercentage).toBeCloseTo(9.9, 1);
  expect(alert.shouldAlert).toBe(false);
  expect(alert.severity).toBe('low');
});
