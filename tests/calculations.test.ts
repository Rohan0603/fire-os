import { test, expect } from '@playwright/test';
import {
  xirr,
  sipCorpus,
  sipCostBasis,
  emergencyRunway,
  crashProtocol,
  fiGoalProgress,
  sipPauseImpact,
} from '../src/lib/calculations';

// XIRR Tests
test('XIRR: Simple investment + return', () => {
  const cashFlows = [
    { date: new Date('2024-01-01'), amount: -100000 },
    { date: new Date('2025-01-01'), amount: 112000 },
  ];
  const result = xirr(cashFlows);
  expect(result).not.toBeNull();
  expect(result).toBeCloseTo(0.12, 2); // 12% annual return
});

test('XIRR: Multiple irregular cash flows', () => {
  const cashFlows = [
    { date: new Date('2023-01-01'), amount: -50000 },
    { date: new Date('2023-06-01'), amount: -50000 },
    { date: new Date('2024-01-01'), amount: 60000 },
    { date: new Date('2024-12-01'), amount: 50000 },
  ];
  const result = xirr(cashFlows);
  expect(result).not.toBeNull();
  expect(typeof result).toBe('number');
});

test('XIRR: No solution returns null', () => {
  const cashFlows = [
    { date: new Date('2024-01-01'), amount: 100000 },
    { date: new Date('2025-01-01'), amount: 100000 },
  ];
  const result = xirr(cashFlows);
  expect(result).toBeNull();
});

test('XIRR: Single flow returns null', () => {
  const cashFlows = [{ date: new Date('2024-01-01'), amount: -100000 }];
  const result = xirr(cashFlows);
  expect(result).toBeNull();
});

test('XIRR: Empty array returns null', () => {
  const cashFlows: Array<{ date: Date; amount: number }> = [];
  const result = xirr(cashFlows);
  expect(result).toBeNull();
});

// SIP Corpus Tests
test('SIP Corpus: 10-year SIP at 12% annual return', () => {
  const result = sipCorpus(10000, 0.12, 10);
  // Formula: FV = P × [((1 + r)^n - 1) / r]
  // r = 0.12 / 12 = 0.01 (monthly)
  // n = 120 months
  // FV = 10000 × [((1.01)^120 - 1) / 0.01] ≈ 2,300,387
  expect(result).toBeGreaterThan(2250000);
  expect(result).toBeLessThan(2350000);
});

test('SIP Corpus: 0% return (simple sum)', () => {
  const result = sipCorpus(5000, 0, 12);
  // With 0% return: 5000 × 144 months = 720,000
  expect(result).toBeCloseTo(720000, -2);
});

test('SIP Corpus: 5-year SIP at 15% annual', () => {
  const result = sipCorpus(10000, 0.15, 5);
  // Formula: FV = 10000 × [((1.0125)^60 - 1) / 0.0125] ≈ 885,745
  expect(result).toBeGreaterThan(850000);
  expect(result).toBeLessThan(920000);
});

test('SIP Corpus: Negative return handled', () => {
  const result = sipCorpus(5000, -0.05, 2);
  // Should still calculate, even with negative return
  expect(typeof result).toBe('number');
  expect(isFinite(result)).toBe(true);
});

// SIP Cost Basis Tests
test('SIP Cost Basis: 10 months × ₹5000 = ₹50,000', () => {
  const result = sipCostBasis(5000, 10);
  expect(result).toBe(50000);
});

test('SIP Cost Basis: 0 months = ₹0', () => {
  const result = sipCostBasis(5000, 0);
  expect(result).toBe(0);
});

test('SIP Cost Basis: Large numbers', () => {
  const result = sipCostBasis(50000, 120);
  expect(result).toBe(6000000);
  expect(isFinite(result)).toBe(true);
});

// Emergency Runway Tests
test('Emergency Runway: ₹500,000 liquid, ₹10,000/month = 50 months', () => {
  const result = emergencyRunway(500000, 10000);
  expect(result).toBe(50);
});

test('Emergency Runway: ₹0 liquid = 0 months', () => {
  const result = emergencyRunway(0, 10000);
  expect(result).toBe(0);
});

test('Emergency Runway: ₹1,000,000 liquid, ₹0 expenses = 999 (indefinite)', () => {
  const result = emergencyRunway(1000000, 0);
  expect(result).toBe(999);
});

test('Emergency Runway: Negative expenses handled gracefully', () => {
  const result = emergencyRunway(500000, -10000);
  expect(isFinite(result) || result === Infinity).toBe(true);
});

test('Emergency Runway: Partial month calculation', () => {
  const result = emergencyRunway(250000, 7500);
  expect(result).toBeCloseTo(33.33, 1);
});

// Crash Protocol Tests
test('Crash Protocol: Portfolio ₹10L, Nifty 52W high ₹21,000, current ₹18,900 (10% down)', () => {
  const result = crashProtocol(1000000, 21000, 18900);
  expect(result.drawdownPercent).toBeCloseTo(10, 1);
  expect(result.deployAmount10).toBeGreaterThan(0);
  expect(result.deployAmount15).toBeGreaterThan(result.deployAmount10);
  expect(result.deployAmount25).toBeGreaterThan(result.deployAmount15);
});

test('Crash Protocol: No crash (current = high) = 0% drawdown', () => {
  const result = crashProtocol(1000000, 20000, 20000);
  expect(result.drawdownPercent).toBeCloseTo(0, 1);
});

test('Crash Protocol: Extreme crash (current = 0)', () => {
  const result = crashProtocol(1000000, 20000, 0);
  expect(result.drawdownPercent).toBeCloseTo(100, 1);
  expect(result.deployAmount25).toBeGreaterThan(0);
});

test('Crash Protocol: Negative drawdown handled', () => {
  const result = crashProtocol(1000000, 20000, 25000);
  // If current > high, drawdown should be 0 or negative
  expect(typeof result.drawdownPercent).toBe('number');
  expect(isFinite(result.deployAmount10)).toBe(true);
});

// FI Goal Progress Tests
test('FI Goal Progress: Corpus ₹6,000,000, expenses ₹300,000/year = 80% progress, not achieved', () => {
  const result = fiGoalProgress(6000000, 300000);
  // FI target = 25 × 300,000 = 7,500,000
  // Progress = (6,000,000 / 7,500,000) × 100 = 80%
  expect(result.fiTarget).toBe(7500000);
  expect(result.progressPercent).toBeCloseTo(80, 1);
  expect(result.yearsRemaining).toBeNull(); // Not yet achieved
});

test('FI Goal Progress: Corpus ₹10,000,000, expenses ₹250,000/year → already achieved FI', () => {
  const result = fiGoalProgress(10000000, 250000);
  expect(result.fiTarget).toBe(6250000);
  expect(result.progressPercent).toBeCloseTo(160, 0);
  expect(result.yearsRemaining).toBe(0); // Already achieved
});

test('FI Goal Progress: Corpus ₹0, expenses ₹0 = edge case', () => {
  const result = fiGoalProgress(0, 0);
  // When expenses are 0, fiTarget = 0, treat as already achieved
  expect(result.fiTarget).toBe(0);
});

test('FI Goal Progress: Verify 25× rule applied correctly', () => {
  const result = fiGoalProgress(5000000, 200000);
  expect(result.fiTarget).toBe(5000000); // 25 × 200,000
  expect(result.progressPercent).toBe(100);
});

// SIP Pause Impact Tests
test('SIP Pause Impact: ₹5,000/month, 6-month pause, 12% annual', () => {
  const result = sipPauseImpact(5000, 6, 0.12);
  expect(result.missedContributions).toBe(30000);
  // Lost growth: FV of 6-month SIP at 12% minus principal
  // sipCorpus(5000, 0.12, 0.5) ≈ 30760
  // Lost growth = 30760 - 30000 ≈ 760
  expect(result.lostGrowth).toBeGreaterThan(700);
  expect(result.lostGrowth).toBeLessThan(850);
  expect(result.totalCost).toBe(result.missedContributions + result.lostGrowth);
});

test('SIP Pause Impact: 0-month pause = ₹0 total cost', () => {
  const result = sipPauseImpact(5000, 0, 0.12);
  expect(result.missedContributions).toBe(0);
  expect(result.lostGrowth).toBe(0);
  expect(result.totalCost).toBe(0);
});

test('SIP Pause Impact: Very high return rate', () => {
  const result = sipPauseImpact(10000, 3, 0.5);
  expect(result.missedContributions).toBe(30000);
  expect(result.lostGrowth).toBeGreaterThan(0);
  expect(result.totalCost).toBeGreaterThan(result.missedContributions);
});

test('SIP Pause Impact: Negative return handled', () => {
  const result = sipPauseImpact(5000, 6, -0.05);
  expect(result.missedContributions).toBe(30000);
  expect(typeof result.lostGrowth).toBe('number');
  expect(typeof result.totalCost).toBe('number');
});
