import { describe, expect, it } from 'vitest';
import { buildImportSummary, captureStateSnapshot } from './import-summary';
import type { FireOSState } from '../../types/state';
import type { Holding, SIPFund } from '../../types/portfolio';

/**
 * This module had no coverage, which is how the CSV and backup-restore summary
 * dialogs could silently stop rendering: both callers were refactored to
 * Promise<void> and guarded on a truthy result that never arrived, with nothing
 * failing. The dialogs are pure DOM, so this pins the data they are fed.
 */

/** Minimal state with only the fields these tests touch. */
function makeState(overrides: Partial<FireOSState> = {}): FireOSState {
  return {
    mf: {},
    fd: {},
    sip: {},
    esop: {},
    demat: {},
    ...overrides,
  } as unknown as FireOSState;
}

const sip = (name: string, units: number): SIPFund => ({
  name,
  units,
  startDate: '2024-01',
  monthlyAmount: 5000,
});

const fd = (name: string, amount: number): Holding => ({ amount, currency: 'INR' });

describe('captureStateSnapshot', () => {
  it('deep copies, so later mutation cannot alter the snapshot', () => {
    const state = makeState({ sip: { s1: sip('A', 1) } });
    const snapshot = captureStateSnapshot(state);

    state.sip.s1.units = 999;

    expect(snapshot.sip.s1.units).toBe(1);
  });

  it('does not share object identity with the live state', () => {
    const state = makeState();
    const snapshot = captureStateSnapshot(state);
    expect(snapshot.sip).not.toBe(state.sip);
  });
});

describe('buildImportSummary', () => {
  it('reports no sections when nothing changed', () => {
    const state = makeState({ sip: { s1: sip('A', 1) } });
    const summary = buildImportSummary(captureStateSnapshot(state), state);

    expect(summary.sections).toEqual([]);
    expect(summary.totals).toEqual({ sections: 0, added: 0, removed: 0, replaced: 0 });
  });

  it('counts an added holding in its own section', () => {
    const before = makeState();
    const after = makeState({ sip: { s1: sip('A', 1) } });
    const summary = buildImportSummary(captureStateSnapshot(before), after);

    expect(summary.totals.added).toBe(1);
    expect(summary.sections[0].section).toBe('sip');
  });

  it('counts a removed holding as removed, not added', () => {
    const before = makeState({ sip: { s1: sip('A', 1) } });
    const summary = buildImportSummary(captureStateSnapshot(before), makeState());

    expect(summary.totals.removed).toBe(1);
    expect(summary.totals.added).toBe(0);
  });

  it('aggregates multiple changes within one section into a single row', () => {
    const before = makeState({ sip: { s1: sip('A', 1) } });
    const after = makeState({ sip: { s1: sip('A', 2), s2: sip('B', 1) } });
    const summary = buildImportSummary(captureStateSnapshot(before), after);

    // One row for the section, not one per changed holding.
    expect(summary.sections).toHaveLength(1);
    const row = summary.sections[0];
    expect(row.section).toBe('sip');
    // s1 changed value (replaced); s2 is new (added).
    expect(row.added).toBe(1);
    expect(row.replaced).toBe(1);
    expect(summary.totals.added + summary.totals.replaced).toBe(2);
  });

  /**
   * This is the question that motivated the test: the summary is built by
   * diffing full before/after state, so it is correct for CSV *merge* mode as
   * well as replace. In merge mode untouched sections must not appear.
   */
  it('reports only the touched section in merge mode', () => {
    const before = makeState({ sip: { s1: sip('A', 1) }, fd: { f1: fd('FD', 5000) } });
    // Merge: only sip is replaced; fd carries over untouched.
    const after = makeState({ sip: { s2: sip('B', 2) }, fd: { f1: fd('FD', 5000) } });

    const summary = buildImportSummary(captureStateSnapshot(before), after);

    expect(summary.sections.map((row) => row.section)).toEqual(['sip']);
    expect(summary.totals.sections).toBe(1);
  });

  it('ignores runtime-only fields, so a save timestamp is not an import change', () => {
    const before = makeState({ _lastSavedAt: '2024-01-01' } as Partial<FireOSState>);
    const after = makeState({ _lastSavedAt: '2024-06-01' } as Partial<FireOSState>);

    expect(buildImportSummary(captureStateSnapshot(before), after).sections).toEqual([]);
  });
});
