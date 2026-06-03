import { test, expect } from '@playwright/test';
import { calculateAllocationDrift } from '../src/modules/calculators/portfolio-rebalancing';

test('calculateAllocationDrift detects over-allocation in PPFCF', () => {
  const holdings = {
    PPFCF: 1500000, // ₹15L
    NipponGrowth: 600000, // ₹6L
    NipponSmallCap: 400000, // ₹4L
    Gold: 300000, // ₹3L
  };
  const totalValue = 2800000;

  const drift = calculateAllocationDrift(holdings, totalValue);
  expect(drift.current).toEqual({
    PPFCF: 53.6,
    NipponGrowth: 21.4,
    NipponSmallCap: 14.3,
    Gold: 10.7,
  });
  expect(drift.target).toEqual({
    PPFCF: 40,
    NipponGrowth: 30,
    NipponSmallCap: 20,
    Gold: 10,
  });
  expect(drift.driftAmount.PPFCF).toBeCloseTo(13.6, 1);
  expect(drift.recommendations).toContain('Reduce PPFCF by ₹3.8L (13.6% drift)');
});

test('calculateAllocationDrift detects under-allocation in Gold', () => {
  const holdings = {
    PPFCF: 800000,
    NipponGrowth: 600000,
    NipponSmallCap: 400000,
    Gold: 200000,
  };
  const totalValue = 2000000;

  const drift = calculateAllocationDrift(holdings, totalValue);
  expect(drift.current.Gold).toBe(10); // Exactly target
  expect(drift.driftAmount.Gold).toBe(0);
  expect(drift.recommendations).not.toContain('Gold');
});

test('calculateAllocationDrift recommends when drift > 5%', () => {
  const holdings = {
    PPFCF: 1000000, // 50% (target 40%, drift +10%)
    NipponGrowth: 600000, // 30% (target 30%, drift 0%)
    NipponSmallCap: 300000, // 15% (target 20%, drift -5%)
    Gold: 100000, // 5% (target 10%, drift -5%)
  };
  const totalValue = 2000000;

  const drift = calculateAllocationDrift(holdings, totalValue);
  expect(drift.recommendations.length).toBe(1); // Only PPFCF > 5% drift
  expect(drift.recommendations[0]).toContain('Reduce PPFCF');
});

test('calculateAllocationDrift with zero total value', () => {
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

test('calculateAllocationDrift with missing funds (zero value)', () => {
  const holdings = {
    PPFCF: 1000000,
    NipponGrowth: 1000000,
    // NipponSmallCap and Gold missing
  };
  const totalValue = 2000000;

  const drift = calculateAllocationDrift(holdings, totalValue);
  expect(drift.current.PPFCF).toBe(50);
  expect(drift.current.NipponGrowth).toBe(50);
  // Missing funds should be treated as 0%
  expect('NipponSmallCap' in drift.current).toBe(true);
  expect('Gold' in drift.current).toBe(true);
});

test('calculateAllocationDrift recommends increase for under-allocated fund', () => {
  const holdings = {
    PPFCF: 800000, // 40% - at target
    NipponGrowth: 600000, // 30% - at target
    NipponSmallCap: 200000, // 10% - below 20% target
    Gold: 400000, // 20% - above 10% target
  };
  const totalValue = 2000000;

  const drift = calculateAllocationDrift(holdings, totalValue);
  // Should recommend reducing Gold and increasing NipponSmallCap
  expect(drift.recommendations).toContain('Reduce Gold by ₹2.0L (10.0% drift)');
  expect(drift.recommendations).toContain('Increase NipponSmallCap by ₹2.0L (10.0% drift)');
});
