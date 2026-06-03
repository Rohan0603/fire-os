import { test, expect } from '@playwright/test';
import { calculateFIAge, generateScenarios } from '../src/modules/calculators/scenario-modeler';

test.describe('Scenario Modeler Calculator', () => {
  test('calculateFIAge with 15% CAGR and ₹30K SIP gives FI at ~38.2 years', () => {
    const result = calculateFIAge({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.15,
      currentAge: 32,
    });

    expect(result.fiAge).toBeCloseTo(38.2, 1);
    expect(result.monthsToFI).toBeCloseTo((38.2 - 32) * 12, 0);
    expect(result.finalCorpus).toBeGreaterThanOrEqual(5500000);
    expect(result.cagr).toBe('15% CAGR');
  });

  test('calculateFIAge with 17% CAGR gives FI at ~37.9 years', () => {
    const result = calculateFIAge({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.17,
      currentAge: 32,
    });

    expect(result.fiAge).toBeCloseTo(37.9, 1);
    expect(result.monthsToFI).toBeCloseTo((37.9 - 32) * 12, 0);
    expect(result.finalCorpus).toBeGreaterThanOrEqual(5500000);
  });

  test('calculateFIAge with 13% CAGR (conservative) gives FI at ~38.4 years', () => {
    const result = calculateFIAge({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.13,
      currentAge: 32,
    });

    expect(result.fiAge).toBeCloseTo(38.4, 1);
    expect(result.monthsToFI).toBeCloseTo((38.4 - 32) * 12, 0);
    expect(result.finalCorpus).toBeGreaterThanOrEqual(5500000);
  });

  test('calculateFIAge with 14% CAGR (realistic) gives FI at ~38.3 years', () => {
    const result = calculateFIAge({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.14,
      currentAge: 32,
    });

    expect(result.fiAge).toBeCloseTo(38.3, 1);
  });

  test('calculateFIAge with zero current corpus', () => {
    const result = calculateFIAge({
      currentCorpus: 0,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.15,
      currentAge: 32,
    });

    expect(result.fiAge).toBeGreaterThan(32);
    expect(result.monthsToFI).toBeGreaterThan(0);
    expect(result.finalCorpus).toBeGreaterThanOrEqual(5500000);
  });

  test('calculateFIAge with higher monthly SIP reaches FI earlier', () => {
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
    expect(result50K.monthsToFI).toBeLessThan(result30K.monthsToFI);
  });

  test('calculateFIAge with higher CAGR reaches FI earlier', () => {
    const result13 = calculateFIAge({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.13,
      currentAge: 32,
    });

    const result17 = calculateFIAge({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.17,
      currentAge: 32,
    });

    expect(result17.fiAge).toBeLessThan(result13.fiAge);
  });

  test('calculateFIAge with annual step-up in SIP', () => {
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

    // With step-up should reach FI earlier
    expect(resultWithStepUp.fiAge).toBeLessThan(resultNoStepUp.fiAge);
  });

  test('calculateFIAge returns floating point FI age', () => {
    const result = calculateFIAge({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.15,
      currentAge: 32,
    });

    // Should have 1 decimal place max
    const decimalPlaces = (result.fiAge.toString().split('.')[1] || '').length;
    expect(decimalPlaces).toBeLessThanOrEqual(1);
  });

  test('calculateFIAge returns rounded monthsToFI', () => {
    const result = calculateFIAge({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.15,
      currentAge: 32,
    });

    expect(Number.isInteger(result.monthsToFI)).toBe(true);
  });

  test('calculateFIAge handles high CAGR', () => {
    const result = calculateFIAge({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.2,
      currentAge: 32,
    });

    expect(result.fiAge).toBeLessThan(50);
    expect(result.finalCorpus).toBeGreaterThanOrEqual(5500000);
  });

  test('calculateFIAge handles low CAGR', () => {
    const result = calculateFIAge({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.11,
      currentAge: 32,
    });

    expect(result.fiAge).toBeGreaterThan(38);
    expect(result.finalCorpus).toBeGreaterThanOrEqual(5500000);
  });

  test('generateScenarios creates multiple scenarios', () => {
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

  test('generateScenarios returns scenarios in order of CAGR', () => {
    const scenarios = generateScenarios({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      currentAge: 32,
    });

    // Higher CAGR should give earlier FI age
    expect(scenarios[0].fiAge).toBeGreaterThan(scenarios[1].fiAge);
    expect(scenarios[1].fiAge).toBeGreaterThan(scenarios[2].fiAge);
    expect(scenarios[2].fiAge).toBeGreaterThan(scenarios[3].fiAge);
  });

  test('calculateFIAge throws on invalid negative corpus', () => {
    expect(() => {
      calculateFIAge({
        currentCorpus: -100000,
        monthlyAmount: 30000,
        targetCorpus: 5500000,
        cagr: 0.15,
        currentAge: 32,
      });
    }).toThrow();
  });

  test('calculateFIAge throws on invalid negative SIP', () => {
    expect(() => {
      calculateFIAge({
        currentCorpus: 500000,
        monthlyAmount: -30000,
        targetCorpus: 5500000,
        cagr: 0.15,
        currentAge: 32,
      });
    }).toThrow();
  });

  test('calculateFIAge throws on zero target', () => {
    expect(() => {
      calculateFIAge({
        currentCorpus: 500000,
        monthlyAmount: 30000,
        targetCorpus: 0,
        cagr: 0.15,
        currentAge: 32,
      });
    }).toThrow();
  });

  test('calculateFIAge with already reached target', () => {
    const result = calculateFIAge({
      currentCorpus: 5500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.15,
      currentAge: 32,
    });

    // Should return very few months (likely 0 after first month calculation)
    expect(result.monthsToFI).toBeLessThanOrEqual(1);
    expect(result.fiAge).toBeCloseTo(32, 1);
  });

  test('calculateFIAge with large corpus already', () => {
    const result = calculateFIAge({
      currentCorpus: 3000000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.15,
      currentAge: 32,
    });

    expect(result.fiAge).toBeLessThan(45.2);
  });

  test('calculateFIAge CAGR display formatting', () => {
    const result13 = calculateFIAge({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.13,
      currentAge: 32,
    });

    const result20 = calculateFIAge({
      currentCorpus: 500000,
      monthlyAmount: 30000,
      targetCorpus: 5500000,
      cagr: 0.2,
      currentAge: 32,
    });

    expect(result13.cagr).toBe('13% CAGR');
    expect(result20.cagr).toBe('20% CAGR');
  });
});
