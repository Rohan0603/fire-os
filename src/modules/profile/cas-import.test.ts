import { describe, expect, it } from 'vitest';
import { planCasImport } from './cas-import';
import type { SIPFund } from '../../types/portfolio';
import type { DematHolding } from '../../types/portfolio';
import type { CASParseResult, CASHolding } from './pdf-parser';
import { initializeState } from '../../types/state';

function makeState() {
  const state = initializeState();
  state.sip = {
    sip1: {
      name: 'Parag Parikh Flexi Cap Direct Growth',
      schemeCode: '122639',
      units: 1000,
      startDate: '2023-01',
      monthlyAmount: 5000,
      costBasis: 400000,
    },
  };
  state.demat = {
    demat1: {
      isin: 'INE002A01019',
      name: 'Infosys Limited',
      quantity: 50,
      currentValue: 50000,
    },
  };
  return state;
}

/**
 * Regression for CAS import (issue #14): a CAS import must merge into existing
 * holdings instead of wiping the section. Existing monthlyAmount / startDate /
 * costBasis and demat ISINs are preserved; only statement-derived values are
 * updated.
 */
describe('CAS import merge', () => {
  it('preserves user-set SIP fields and only updates statement-derived values', () => {
    const state = makeState();
    const holding: CASHolding = {
      type: 'soa',
      identifier: '123456789',
      schemeName: 'Parag Parikh Flexi Cap Direct Growth',
      investedValue: 500000,
      balanceUnits: 1200,
      navDate: '2026-09-15',
      nav: 420.5,
      marketValue: 500000,
      gainLossAbs: 0,
      gainLossPct: 0,
    };
    const result: CASParseResult = {
      asOnDate: '2026-09-30',
      investor: { name: 'Test', pan: 'ABCDE1234F', email: '', mobile: '' },
      holdings: [holding],
    };

    const plan = planCasImport(
      { sip: state.sip, demat: state.demat },
      result,
    );

    const merged: Record<string, SIPFund> = plan.sip;
    const existingKey = Object.keys(merged)[0];
    expect(existingKey).toBe('sip1');
    expect(merged[existingKey].monthlyAmount).toBe(5000);
    expect(merged[existingKey].startDate).toBe('2023-01');
    expect(merged[existingKey].costBasis).toBe(400000);
    expect(merged[existingKey].units).toBe(1200);
    expect(merged[existingKey].schemeCode).toBe('122639');
    expect(plan.added.length).toBe(0);
  });

  it('adds new SIP funds from a new CAS statement', () => {
    const state = makeState();
    const result: CASParseResult = {
      asOnDate: '2026-09-30',
      investor: { name: 'Test', pan: 'ABCDE1234F', email: '', mobile: '' },
      holdings: [
        {
          type: 'soa',
          identifier: '999',
          schemeName: 'Nippon India Growth Fund',
          investedValue: 100000,
          balanceUnits: 500,
          navDate: '2026-09-01',
          nav: 200,
          marketValue: 100000,
          gainLossAbs: 0,
          gainLossPct: 0,
        },
      ],
    };

    const plan = planCasImport({ sip: state.sip, demat: state.demat }, result);
    const keys = Object.keys(plan.sip);
    expect(keys).toContain('sip1');
    expect(keys).toContain('sip2');
    expect(plan.sip['sip2'].monthlyAmount).toBe(0);
    expect(plan.sip['sip2'].units).toBe(500);
    expect(plan.added.length).toBe(1);
  });

  it('does not delete SIPs absent from the statement', () => {
    const state = makeState();
    state.sip.sip2 = {
      name: 'HDFC Top 100',
      units: 200,
      startDate: '2022-01',
      monthlyAmount: 3000,
      costBasis: 50000,
    };
    const result: CASParseResult = {
      asOnDate: '2026-09-30',
      investor: { name: 'Test', pan: 'ABCDE1234F', email: '', mobile: '' },
      holdings: [],
    };
    const plan = planCasImport({ sip: state.sip, demat: state.demat }, result);
    expect(Object.keys(plan.sip).sort()).toEqual(['sip1', 'sip2']);
    expect(plan.untouched.length).toBe(2);
  });

  it('merges demat holdings by name and preserves an existing ISIN', () => {
    const state = makeState();
    const result: CASParseResult = {
      asOnDate: '2026-09-30',
      investor: { name: 'Test', pan: 'ABCDE1234F', email: '', mobile: '' },
      holdings: [
        {
          type: 'demat',
          identifier: 'ACCT-1',
          schemeName: 'Infosys Limited',
          investedValue: 50000,
          balanceUnits: 60,
          navDate: '',
          nav: 850,
          marketValue: 51000,
          gainLossAbs: 1000,
          gainLossPct: 0.02,
        },
      ],
    };
    const plan = planCasImport({ sip: state.sip, demat: state.demat }, result);
    const merged: Record<string, DematHolding> = plan.demat;
    const key = Object.keys(merged)[0];
    expect(merged[key].isin).toBe('INE002A01019');
    expect(merged[key].quantity).toBe(60);
    expect(merged[key].name).toBe('Infosys Limited');
  });
});
