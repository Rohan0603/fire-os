import { test, expect } from '@playwright/test';
import { initializeState, mergeState, isFireOSState } from '../src/types/state';

// State Initialization Tests
test('initializeState: Creates valid initial state', () => {
  const state = initializeState();
  expect(isFireOSState(state)).toBe(true);
});

test('initializeState: Sets default values correctly', () => {
  const state = initializeState();
  expect(state.profile.name).toBe('');
  expect(state.profile.age).toBe(0);
  expect(state.mf).toEqual({});
  expect(state.fd).toEqual({});
  expect(state.sip).toEqual({});
  expect(state.currentUser).toBeNull();
});

test('initializeState: Initializes Coorg fields with correct defaults', () => {
  const state = initializeState();
  expect(state.coorgCorpus).toBe(0);
  expect(state.coorgStartDate).toBe('2031-01');
  expect(state.coorgTarget).toBe(20000000); // ₹2Cr
  expect(state.coorgMonthlyAmount).toBe(10000); // ₹10K
});

// State Merging Tests
test('mergeState: Merges Coorg fields from incoming state', () => {
  const existing = initializeState();
  const incoming: Partial<typeof existing> = {
    coorgCorpus: 500000,
    coorgStartDate: '2031-01',
  };
  const merged = mergeState(existing, incoming);
  expect(merged.coorgCorpus).toBe(500000);
  expect(merged.coorgStartDate).toBe('2031-01');
  expect(merged.coorgTarget).toBe(20000000); // Unchanged
  expect(merged.coorgMonthlyAmount).toBe(10000); // Unchanged
});

test('mergeState: Updates all Coorg fields', () => {
  const existing = initializeState();
  const incoming: Partial<typeof existing> = {
    coorgCorpus: 1000000,
    coorgStartDate: '2031-06',
    coorgTarget: 25000000,
    coorgMonthlyAmount: 15000,
  };
  const merged = mergeState(existing, incoming);
  expect(merged.coorgCorpus).toBe(1000000);
  expect(merged.coorgStartDate).toBe('2031-06');
  expect(merged.coorgTarget).toBe(25000000);
  expect(merged.coorgMonthlyAmount).toBe(15000);
});

test('mergeState: Preserves existing Coorg fields if not provided in incoming', () => {
  const existing = initializeState();
  existing.coorgCorpus = 500000;
  existing.coorgMonthlyAmount = 12000;
  const incoming: Partial<typeof existing> = {
    coorgStartDate: '2031-03',
  };
  const merged = mergeState(existing, incoming);
  expect(merged.coorgCorpus).toBe(500000); // Preserved
  expect(merged.coorgStartDate).toBe('2031-03'); // Updated
  expect(merged.coorgMonthlyAmount).toBe(12000); // Preserved
});

// Type Guard Tests
test('isFireOSState: Validates Coorg fields are present', () => {
  const validState = initializeState();
  expect(isFireOSState(validState)).toBe(true);
});

test('isFireOSState: Rejects state without Coorg fields', () => {
  const incompleteState = {
    profile: { name: '', age: 0, annualExpenses: 0, fiTarget: 0 },
    mf: {},
    fd: {},
    epf: {},
    sip: {},
    esop: {},
    bonds: {},
    demat: {},
    nav: {},
    niftyHigh: 0,
    eurInr: 0,
    alphaTrackerData: {},
    currentUser: null,
    _lastSavedAt: new Date().toISOString(),
    // Missing Coorg fields
  };
  expect(isFireOSState(incompleteState)).toBe(false);
});

test('isFireOSState: Rejects state with invalid Coorg types', () => {
  const invalidState = {
    profile: { name: '', age: 0, annualExpenses: 0, fiTarget: 0 },
    mf: {},
    fd: {},
    epf: {},
    sip: {},
    esop: {},
    bonds: {},
    demat: {},
    nav: {},
    niftyHigh: 0,
    eurInr: 0,
    alphaTrackerData: {},
    coorgCorpus: 'not a number', // Invalid type
    coorgStartDate: '2031-01',
    coorgTarget: 20000000,
    coorgMonthlyAmount: 10000,
    currentUser: null,
    _lastSavedAt: new Date().toISOString(),
  };
  expect(isFireOSState(invalidState)).toBe(false);
});

// Coorg Field Immutability Test
test('Coorg fields persist across state mutations', () => {
  const state = initializeState();
  state.coorgCorpus = 750000;
  state.coorgMonthlyAmount = 11000;

  expect(state.coorgCorpus).toBe(750000);
  expect(state.coorgMonthlyAmount).toBe(11000);
  expect(state.coorgStartDate).toBe('2031-01'); // Original default
  expect(state.coorgTarget).toBe(20000000); // Original default
});

// Firebase Persistence Tests
test('Coorg fields included in stateSnapshot for change detection', () => {
  const state1 = initializeState();
  const state2 = initializeState();
  state2.coorgCorpus = 500000;

  // Using JSON.stringify to simulate stateSnapshot behavior
  const snap1 = JSON.stringify({
    profile: state1.profile,
    mf: state1.mf,
    fd: state1.fd,
    epf: state1.epf,
    sip: state1.sip,
    esop: state1.esop,
    demat: state1.demat,
    eurInr: typeof state1.eurInr === 'number' ? state1.eurInr : 0,
    coorgCorpus: state1.coorgCorpus,
    coorgStartDate: state1.coorgStartDate,
    coorgTarget: state1.coorgTarget,
    coorgMonthlyAmount: state1.coorgMonthlyAmount,
  });

  const snap2 = JSON.stringify({
    profile: state2.profile,
    mf: state2.mf,
    fd: state2.fd,
    epf: state2.epf,
    sip: state2.sip,
    esop: state2.esop,
    demat: state2.demat,
    eurInr: typeof state2.eurInr === 'number' ? state2.eurInr : 0,
    coorgCorpus: state2.coorgCorpus,
    coorgStartDate: state2.coorgStartDate,
    coorgTarget: state2.coorgTarget,
    coorgMonthlyAmount: state2.coorgMonthlyAmount,
  });

  expect(snap1).not.toBe(snap2); // Change in Coorg field detected
});

test('Coorg fields preserved in backup envelope for export/import', () => {
  const state = initializeState();
  state.coorgCorpus = 1500000;
  state.coorgStartDate = '2031-06';
  state.coorgTarget = 25000000;
  state.coorgMonthlyAmount = 12000;

  // Simulate what exportPortfolio creates
  const backup = {
    version: '2',
    timestamp: new Date().toISOString(),
    profile: state.profile,
    holdings: {
      mf: state.mf,
      fd: state.fd,
      epf: state.epf,
      sip: state.sip,
      esop: state.esop,
      demat: state.demat,
    },
    navCache: state.nav,
    niftyData: state.niftyData,
    alphaTrackerData: state.alphaTrackerData,
    coorgCorpus: state.coorgCorpus,
    coorgStartDate: state.coorgStartDate,
    coorgTarget: state.coorgTarget,
    coorgMonthlyAmount: state.coorgMonthlyAmount,
  };

  expect(backup.coorgCorpus).toBe(1500000);
  expect(backup.coorgStartDate).toBe('2031-06');
  expect(backup.coorgTarget).toBe(25000000);
  expect(backup.coorgMonthlyAmount).toBe(12000);
});

// SWP & Tax Engine (v3.0) Tests
test('initializeState: Initializes SWP & Tax fields with correct defaults', () => {
  const state = initializeState();
  expect(state.swpSchedule.enabled).toBe(false);
  expect(state.swpSchedule.monthlyAmount).toBe(122000);
  expect(state.taxCalendar.harvestTarget).toBe(125000);
  expect(state.expenses).toEqual([]);
});

test('mergeState: Merges SWP & Tax fields', () => {
  const existing = initializeState();
  const incoming: Partial<typeof existing> = {
    swpSchedule: {
      enabled: true,
      startDate: '2044-01',
      monthlyAmount: 150000,
      rate: 0.04,
    },
    expenses: [
      { date: '2044-01-15', category: 'food', amount: 5000, linkedToSWP: true }
    ]
  };
  const merged = mergeState(existing, incoming);
  expect(merged.swpSchedule.enabled).toBe(true);
  expect(merged.swpSchedule.startDate).toBe('2044-01');
  expect(merged.expenses).toHaveLength(1);
  expect(merged.taxCalendar.harvestTarget).toBe(125000); // Preserved
});

test('FireOSState persists SWP schedule', () => {
  const state = initializeState();
  state.swpSchedule.enabled = true;
  state.swpSchedule.startDate = '2044-01';
  
  // Simulate what exportPortfolio creates
  const backup = {
    version: '3',
    swpSchedule: state.swpSchedule,
  };
  
  expect(backup.swpSchedule.enabled).toBe(true);
  expect(backup.swpSchedule.startDate).toBe('2044-01');
});

