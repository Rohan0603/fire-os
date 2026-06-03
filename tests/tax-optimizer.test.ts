import { test, expect } from '@playwright/test';
import { calculateTaxComparison, calculateLTCGHarvestAmount } from '../src/modules/calculators/tax-optimizer';

test("calculateTaxComparison shows SIP vs lump-sum tax impact", () => {
  const comparisonSIP = calculateTaxComparison({
    gainAmount: 500000,
    strategy: "sip", // Spread over 12 months
    taxRate: 0.20, // 20% long-term capital gains
  });

  const comparisonLumpSum = calculateTaxComparison({
    gainAmount: 500000,
    strategy: "lumpSum", // All at once
    taxRate: 0.20,
  });

  // Both should result in same tax (20% of gain)
  expect(comparisonSIP.taxPayable).toBe(100000); // 20% of 500K
  expect(comparisonLumpSum.taxPayable).toBe(100000);
});

test("calculateLTCGHarvestAmount determines optimal harvest", () => {
  const harvest = calculateLTCGHarvestAmount({
    yearlyLimit: 125000, // ₹1.25L
    currentGains: 200000, // Set to 200K so it exceeds the limit
    taxableIncome: 500000,
  });
  expect(harvest.recommendedAmount).toBe(125000); // Full limit
  expect(harvest.taxPayable).toBe(25000); // 20% of 125K
});
