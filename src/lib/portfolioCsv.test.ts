import { describe, expect, it } from 'vitest';
import { initializeState } from '../types/state';
import { buildPortfolioCsv } from './portfolioCsv';

describe('buildPortfolioCsv', () => {
  it('exports cached fund values and escapes spreadsheet text', () => {
    const state = initializeState();
    state.sip.fund1 = {
      name: '=SUM(A1:A2), "test"',
      schemeCode: '123',
      units: 2,
      startDate: '2024-01',
      monthlyAmount: 5000,
    };
    state.nav['123'] = { schemeCode: '123', nav: 10, timestamp: new Date().toISOString(), ttl: 1000 };

    expect(buildPortfolioCsv(state)).toContain('"SIP","\'=SUM(A1:A2), ""test""","2","5000","","20","INR"');
  });
});
