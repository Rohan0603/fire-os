import { describe, expect, it } from 'vitest';
import { initializeState } from '../types/state';
import type { FireOSState } from '../types/state';
import { buildPortfolioCsv } from './portfolioCsv';

const HEADER = '"Category","Name","Units","Monthly contribution","Cost basis","Value","Currency"';

function sipState(
  name: string,
  opts: { schemeCode?: string; costBasis?: number; nav?: boolean } = {},
): FireOSState {
  const state = initializeState();
  state.sip.fund1 = {
    name,
    schemeCode: opts.schemeCode ?? '123',
    units: 2,
    startDate: '2024-01',
    monthlyAmount: 5000,
    costBasis: opts.costBasis,
  };
  if (opts.nav !== false) {
    state.nav['123'] = { schemeCode: '123', nav: 10, timestamp: new Date().toISOString(), ttl: 1000 };
  }
  return state;
}

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

  it('keeps exact headers, CRLF row endings, and no trailing newline', () => {
    const state = initializeState();
    state.fd.fd1 = { amount: 100000, currency: 'INR' };

    const csv = buildPortfolioCsv(state);
    expect(csv).toBe(`${HEADER}\r\n"FD","fd1","","","","100000","INR"`);
    expect(csv.startsWith(`${HEADER}\r\n`)).toBe(true);
    expect(csv.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('quotes embedded commas', () => {
    const csv = buildPortfolioCsv(sipState('HDFC, Flexi Cap Growth'));
    expect(csv).toContain('"SIP","HDFC, Flexi Cap Growth","2","5000","","20","INR"');
  });

  it('doubles embedded quotes', () => {
    const csv = buildPortfolioCsv(sipState('Fund "A" Growth'));
    expect(csv).toContain('"SIP","Fund ""A"" Growth","2","5000","","20","INR"');
  });

  it('quotes multiline cells containing LF', () => {
    const csv = buildPortfolioCsv(sipState('line one\nline two'));
    expect(csv).toBe(`${HEADER}\r\n"SIP","line one\nline two","2","5000","","20","INR"`);
  });

  it('quotes cells containing CR and CRLF without breaking row separators', () => {
    const csv = buildPortfolioCsv(sipState('Windows\r\nrow break'));
    expect(csv).toBe(`${HEADER}\r\n"SIP","Windows\r\nrow break","2","5000","","20","INR"`);

    const crOnly = buildPortfolioCsv(sipState('old\rmac'));
    expect(crOnly).toBe(`${HEADER}\r\n"SIP","old\rmac","2","5000","","20","INR"`);
  });

  it('escapes formula-like text with leading space or tab', () => {
    expect(buildPortfolioCsv(sipState(' =SUM(A1)'))).toContain('"SIP","\' =SUM(A1)","2"');
    expect(buildPortfolioCsv(sipState('\t@handle'))).toContain('"SIP","\'\t@handle","2"');
    expect(buildPortfolioCsv(sipState('  -500 adjustment'))).toContain('"SIP","\'  -500 adjustment","2"');
  });

  it('escapes formula-like text preceded by a newline', () => {
    const csv = buildPortfolioCsv(sipState('\n=1+1'));
    expect(csv).toContain('"SIP","\'\n=1+1","2"');
  });

  it('escapes formula-like text preceded by non-breaking space', () => {
    const csv = buildPortfolioCsv(sipState('\u00A0@handle'));
    expect(csv).toContain('"SIP","\'\u00A0@handle","2"');
  });

  it('keeps negative numeric values numeric', () => {
    const state = sipState('Neg Basis', { costBasis: -100, nav: false });
    state.liabilities.car = { name: 'Car loan', amount: -50000 };

    const csv = buildPortfolioCsv(state);
    expect(csv).toBe(
      `${HEADER}\r\n"SIP","Neg Basis","2","5000","-100","","INR"\r\n"Liability","Car loan","","","","-50000","INR"`,
    );
    expect(csv).not.toContain("'-100");
    expect(csv).not.toContain("'-50000");
  });

  it('leaves value empty when NAV is missing', () => {
    const csv = buildPortfolioCsv(sipState('No NAV Fund', { schemeCode: '999', nav: false }));
    expect(csv).toContain('"SIP","No NAV Fund","2","5000","","","INR"');
  });

  it('keeps unicode and Indian names intact', () => {
    const state = initializeState();
    state.sip.fund1 = {
      name: 'म्यूचुअल फंड - ग्रोथ',
      schemeCode: '123',
      units: 2,
      startDate: '2024-01',
      monthlyAmount: 5000,
    };
    state.nav['123'] = { schemeCode: '123', nav: 10, timestamp: new Date().toISOString(), ttl: 1000 };
    state.epf['ईपीएफ खाता'] = { amount: 250000, currency: 'INR' };
    state.otherHoldings.gold1 = { name: 'सोना@घर', amount: 80000, annualReturn: 0 };

    const csv = buildPortfolioCsv(state);
    expect(csv).toContain('"SIP","म्यूचुअल फंड - ग्रोथ","2","5000","","20","INR"');
    expect(csv).toContain('"EPF","ईपीएफ खाता","","","","250000","INR"');
    expect(csv).toContain('"Other","सोना@घर","","","","80000","INR"');
  });
});
