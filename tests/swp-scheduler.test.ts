import { test, expect } from '@playwright/test';
import { calculateFIFORedemption } from '../src/modules/calculators/swp-scheduler';

test("calculateFIFORedemption redeems PPFCF first", () => {
  const holdings = {
    PPFCF: { units: 500, nav: 100 }, // ₹50K
    NipponGrowth: { units: 1000, nav: 150 }, // ₹150K
    NipponSmallCap: { units: 100, nav: 200 }, // ₹20K
    Gold: { units: 50, nav: 400 }, // ₹20K
  };

  const redemption = calculateFIFORedemption(holdings, 122000);
  
  // Should redeem all PPFCF first (₹50K)
  expect(redemption.PPFCF).toBe(500); // All units
  // Then ₹72K from NipponGrowth
  expect(redemption.NipponGrowth).toBe(480); // 72000/150 = 480 units
  expect(redemption.NipponSmallCap).toBe(0);
  expect(redemption.Gold).toBe(0);
});

test("calculateFIFORedemption handles ₹122K monthly withdrawal", () => {
  const holdings = {
    PPFCF: { units: 10000, nav: 100 }, // ₹100L
    NipponGrowth: { units: 5000, nav: 150 }, // ₹75L
    NipponSmallCap: { units: 3000, nav: 200 }, // ₹60L
    Gold: { units: 1000, nav: 400 }, // ₹40L
  };

  const redemption = calculateFIFORedemption(holdings, 122000);
  // ₹122K from PPFCF = 1220 units (122000/100)
  expect(redemption.PPFCF).toBe(1220);
  expect(redemption.NipponGrowth).toBe(0);
});
