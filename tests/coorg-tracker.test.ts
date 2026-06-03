import { test, expect } from '@playwright/test';
import { calculateCoorgProgress } from '../src/modules/dashboard/coorg-tracker';

test('Coorg tracker shows progress vs ₹2Cr target', () => {
  const progress = calculateCoorgProgress({
    currentCorpus: 500000,
    targetCorpus: 20000000,
    currentDate: '2026-06-03',
    sipStartDate: '2031-01',
  });

  expect(progress.percentage).toBe(2.5); // 500K / 20M = 2.5%
  expect(progress.remainingAmount).toBe(19500000);
  expect(progress.yearsUntilStart).toBeCloseTo(4.58, 1); // ~4.58 years
  expect(progress.status).toBe('planning');
});

test('should show in_progress status when SIP has started but target not reached', () => {
  const progress = calculateCoorgProgress({
    currentCorpus: 5000000,
    targetCorpus: 20000000,
    currentDate: '2031-06-03',
    sipStartDate: '2031-01',
  });

  expect(progress.percentage).toBe(25);
  expect(progress.status).toBe('in_progress');
});

test('should show target_reached status when corpus >= target', () => {
  const progress = calculateCoorgProgress({
    currentCorpus: 20000000,
    targetCorpus: 20000000,
    currentDate: '2036-06-03',
    sipStartDate: '2031-01',
  });

  expect(progress.percentage).toBe(100);
  expect(progress.remainingAmount).toBe(0);
  expect(progress.status).toBe('target_reached');
});

test('should handle edge case where corpus exceeds target', () => {
  const progress = calculateCoorgProgress({
    currentCorpus: 25000000,
    targetCorpus: 20000000,
    currentDate: '2036-06-03',
    sipStartDate: '2031-01',
  });

  expect(progress.percentage).toBe(125);
  expect(progress.remainingAmount).toBe(-5000000);
  expect(progress.status).toBe('target_reached');
});
