import { describe, expect, it } from 'vitest';
import { calculateFIAge, compareFIScenarios, type FIScenarioInput, type FIScenarioResult } from './scenario-modeler';
import { initializeState } from '../../types/state';

const baseScenario: FIScenarioInput = {
  label: 'Base 12%',
  currentCorpus: 1_000_000,
  monthlySip: 50_000,
  annualStepUpPercent: 10,
  annualReturnPercent: 12,
  fiGoal: 50_000_000,
  currentAge: 32,
};

describe('calculateFIAge (preserved behavior)', () => {
  it('returns current age and corpus untouched when the goal is already met', () => {
    expect(
      calculateFIAge({
        currentCorpus: 6_000_000,
        monthlyAmount: 0,
        targetCorpus: 5_500_000,
        cagr: 0.15,
        currentAge: 32,
      }),
    ).toEqual({ fiAge: 32, monthsToFI: 0, finalCorpus: 6_000_000, cagr: '15% CAGR' });
  });

  it('throws on invalid parameters', () => {
    expect(() =>
      calculateFIAge({ currentCorpus: -1, monthlyAmount: 0, targetCorpus: 1, cagr: 0.1, currentAge: 30 }),
    ).toThrow('Invalid parameters for scenario calculation');
  });
});

describe('compareFIScenarios', () => {
  it('projects two scenarios with distinct returns/step-ups using the calculateFIAge math', () => {
    const conservative: FIScenarioInput = {
      ...baseScenario,
      label: 'Conservative 8%',
      annualReturnPercent: 8,
      annualStepUpPercent: 5,
    };

    const results = compareFIScenarios([baseScenario, conservative]);

    expect(results).toHaveLength(2);
    expect(results[0].monthsToGoal).toBeLessThan(results[1].monthsToGoal);

    for (const [index, input] of [baseScenario, conservative].entries()) {
      const expected = calculateFIAge({
        currentCorpus: input.currentCorpus,
        monthlyAmount: input.monthlySip,
        targetCorpus: input.fiGoal,
        cagr: input.annualReturnPercent / 100,
        currentAge: input.currentAge,
        annualStepUp: input.annualStepUpPercent / 100,
      });
      expect(results[index].monthsToGoal).toBe(expected.monthsToFI);
      expect(results[index].ageAtGoal).toBe(expected.fiAge);
      expect(results[index].projectedCorpus).toBe(expected.finalCorpus);
      expect(results[index].assumptions).toEqual(input);
    }
  });

  it('returns exactly the documented result and assumption field lists', () => {
    const [result] = compareFIScenarios([baseScenario]);

    expect(Object.keys(result).sort()).toEqual([
      'ageAtGoal',
      'assumptions',
      'label',
      'monthsToGoal',
      'projectedCorpus',
    ]);
    expect(Object.keys(result.assumptions).sort()).toEqual([
      'annualReturnPercent',
      'annualStepUpPercent',
      'currentAge',
      'currentCorpus',
      'fiGoal',
      'label',
      'monthlySip',
    ]);
  });

  it('returns results in input order regardless of which scenario is fastest', () => {
    const slow: FIScenarioInput = { ...baseScenario, label: 'Slow 6%', annualReturnPercent: 6, annualStepUpPercent: 0 };
    const fast: FIScenarioInput = { ...baseScenario, label: 'Fast 18%', annualReturnPercent: 18, annualStepUpPercent: 15 };

    const results = compareFIScenarios([slow, fast, baseScenario]);

    expect(results.map((r) => r.label)).toEqual(['Slow 6%', 'Fast 18%', 'Base 12%']);
    expect(results[0].monthsToGoal).toBeGreaterThan(results[1].monthsToGoal);
  });

  it('filters invalid assumptions deterministically without letting exceptions escape', () => {
    const invalidScenarios: FIScenarioInput[] = [
      { ...baseScenario, label: 'Negative corpus', currentCorpus: -1 },
      { ...baseScenario, label: 'Negative SIP', monthlySip: -500 },
      { ...baseScenario, label: 'Negative step-up', annualStepUpPercent: -5 },
      { ...baseScenario, label: 'Negative return', annualReturnPercent: -12 },
      { ...baseScenario, label: 'Zero goal', fiGoal: 0 },
      { ...baseScenario, label: 'Negative age', currentAge: -30 },
      { ...baseScenario, label: 'NaN return', annualReturnPercent: NaN },
      { ...baseScenario, label: 'Infinite SIP', monthlySip: Infinity },
      { ...baseScenario, label: 'Non-finite goal', fiGoal: Number.NaN },
    ];

    let mixed: FIScenarioResult[] | undefined;
    expect(() => {
      mixed = compareFIScenarios([baseScenario, ...invalidScenarios]);
    }).not.toThrow();
    expect(mixed!.map((r) => r.label)).toEqual(['Base 12%']);

    expect(() => compareFIScenarios(invalidScenarios)).not.toThrow();
    expect(compareFIScenarios(invalidScenarios)).toEqual([]);
    expect(compareFIScenarios([])).toEqual([]);
  });

  it('does not write to persisted portfolio state', () => {
    const state = initializeState();
    state.profile.fiTarget = 50_000_000;
    state.profile.age = 32;
    const before = structuredClone(state);

    compareFIScenarios([
      {
        label: 'State-derived',
        currentCorpus: 1_000_000,
        monthlySip: 30_000,
        annualStepUpPercent: 10,
        annualReturnPercent: 15,
        fiGoal: state.profile.fiTarget,
        currentAge: state.profile.age,
      },
    ]);

    expect(state).toEqual(before);
  });
});
