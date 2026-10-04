import { describe, expect, it, vi } from 'vitest';
import { createFeatureContext } from '../../core/feature-context';
import { buildPortfolioCsv } from '../../lib/portfolioCsv';
import { initializeState, isPersistedPortfolioData, type FireOSState } from '../../types/state';
import { applyPortfolioCsvImport, parsePortfolioCsv } from './csv-import';

const HEADER = 'Category,Name,Units,Monthly contribution,Cost basis,Value,Currency';

function csvText(...rows: string[]): string {
  return [HEADER, ...rows].join('\r\n');
}

describe('parsePortfolioCsv', () => {
  it('maps every recognized category into its state section', () => {
    const preview = parsePortfolioCsv(csvText(
      'Mutual fund,MF Fund,10,1000,5000,15000,INR',
      'SIP,SIP Fund,5,500,,,INR',
      'FD,fd,,,,100000,INR',
      'EPF,epf1,,,,250000,INR',
      'ESOP,esop1,,,,12000,INR',
      'Bonds,bond1,,,,50000,INR',
      'Other,Gold,,,,80000,INR',
      'Demat,TCS,7,,,1400,INR',
      'Liability,Car loan,,,,50000,INR',
    ));

    expect(preview.issues).toEqual([]);
    expect(preview.validRows).toBe(9);
    expect(preview.candidate).toEqual({
      mf: { mf1: { name: 'MF Fund', units: 10, startDate: '', monthlyAmount: 1000, costBasis: 5000 } },
      sip: { sip1: { name: 'SIP Fund', units: 5, startDate: '', monthlyAmount: 500 } },
      fd: { fd: { amount: 100000, currency: 'INR' } },
      epf: { epf1: { amount: 250000, currency: 'INR' } },
      esop: { esop1: { amount: 12000, currency: 'INR' } },
      bonds: { bond1: { amount: 50000, currency: 'INR' } },
      otherHoldings: { otherHolding1: { name: 'Gold', amount: 80000, annualReturn: 0 } },
      demat: { demat1: { isin: '', quantity: 7, currentValue: 1400, name: 'TCS' } },
      liabilities: { liability1: { name: 'Car loan', amount: 50000 } },
    });
    expect(isPersistedPortfolioData(preview.candidate)).toBe(true);
    expect(preview.candidate).not.toHaveProperty('currentUser');
    expect(preview.candidate).not.toHaveProperty('_syncMetadata');
  });

  it('treats blank numeric cells as absent instead of zero', () => {
    const preview = parsePortfolioCsv(csvText('SIP,Fund,2,500,,,INR'));
    expect(preview.issues).toEqual([]);
    expect(preview.candidate.sip!.sip1).toStrictEqual({
      name: 'Fund',
      units: 2,
      startDate: '',
      monthlyAmount: 500,
    });
    expect(preview.candidate.sip!.sip1).not.toHaveProperty('costBasis');
  });

  it('surfaces duplicate rows and keeps the first occurrence', () => {
    const preview = parsePortfolioCsv(csvText(
      'FD,fd,,,,100000,INR',
      'FD,fd,,,,200000,INR',
    ));
    expect(preview.validRows).toBe(1);
    expect(preview.candidate.fd).toEqual({ fd: { amount: 100000, currency: 'INR' } });
    expect(preview.issues).toEqual([
      { row: 3, field: 'Name', message: expect.stringContaining('Duplicate') },
    ]);
  });

  it('reports malformed and missing numbers as row issues and skips those rows', () => {
    const preview = parsePortfolioCsv(csvText(
      'SIP,Broken,abc,500,,,INR',
      'FD,fd,,,,12..5,INR',
      'Liability,Car loan,,,,-5000,INR',
      'EPF,epf1,,,,,INR',
    ));
    expect(preview.validRows).toBe(0);
    expect(preview.candidate).toEqual({});
    expect(preview.issues).toEqual([
      { row: 2, field: 'Units', message: expect.stringContaining('abc') },
      { row: 3, field: 'Value', message: expect.stringContaining('12..5') },
      { row: 4, field: 'Value', message: expect.stringContaining('zero or greater') },
      { row: 5, field: 'Value', message: expect.stringContaining('required') },
    ]);
  });

  it('reads quoted multiline names as a single row', () => {
    const preview = parsePortfolioCsv([
      HEADER,
      'SIP,"line one\nline two",2,500,,,INR',
      'FD,fd,,,,1,INR',
      'FD,bad,,,,oops,INR',
    ].join('\r\n'));

    expect(preview.candidate.sip!.sip1!.name).toBe('line one\nline two');
    expect(preview.validRows).toBe(2);
    expect(preview.issues).toEqual([
      { row: 4, field: 'Value', message: expect.stringContaining('oops') },
    ]);
  });

  it('surfaces unknown categories without importing them', () => {
    const preview = parsePortfolioCsv(csvText('Crypto,Bitcoin,,,,100,INR'));
    expect(preview.validRows).toBe(0);
    expect(preview.candidate).toEqual({});
    expect(preview.issues).toEqual([
      { row: 2, field: 'Category', message: expect.stringContaining('Crypto') },
    ]);
  });

  it('strips the export formula apostrophe and surfaces the recovered text', () => {
    const preview = parsePortfolioCsv(csvText(
      "SIP,'=SUM(A1),2,500,,,INR",
      "Other,'  -500 adjustment,,,,10,INR",
    ));
    expect(preview.validRows).toBe(2);
    expect(preview.candidate.sip!.sip1!.name).toBe('=SUM(A1)');
    expect(preview.candidate.otherHoldings!.otherHolding1!.name).toBe('  -500 adjustment');
    expect(preview.issues).toHaveLength(2);
    expect(preview.issues.every((issue) => issue.field === 'Name' && issue.message.includes('apostrophe'))).toBe(true);
  });

  it('keeps ordinary apostrophes in names untouched', () => {
    const preview = parsePortfolioCsv(csvText("FD,O'Brien,,,,1000,INR"));
    expect(preview.issues).toEqual([]);
    expect(preview.candidate.fd).toEqual({ "O'Brien": { amount: 1000, currency: 'INR' } });
  });

  it('rejects raw formula-like names with an issue', () => {
    const preview = parsePortfolioCsv(csvText('SIP,=1+1,2,500,,,INR'));
    expect(preview.validRows).toBe(0);
    expect(preview.candidate).toEqual({});
    expect(preview.issues).toEqual([
      { row: 2, field: 'Name', message: expect.stringContaining('formula') },
    ]);
  });

  it('refuses names that would pollute object prototypes', () => {
    const preview = parsePortfolioCsv(csvText('FD,__proto__,,,,1,INR'));
    expect(preview.validRows).toBe(0);
    expect(preview.candidate).toEqual({});
    expect(preview.issues).toEqual([
      { row: 2, field: 'Name', message: expect.any(String) },
    ]);
  });

  it('rejects files that do not match the export header', () => {
    const preview = parsePortfolioCsv('A,B\r\n1,2');
    expect(preview.candidate).toEqual({});
    expect(preview.validRows).toBe(0);
    expect(preview.issues).toEqual([
      { row: 1, field: 'header', message: expect.stringContaining('Category') },
    ]);
  });

  it('accepts a header-only file as an empty preview', () => {
    expect(parsePortfolioCsv(HEADER)).toEqual({ candidate: {}, validRows: 0, issues: [] });
  });

  it('ignores a UTF-8 BOM before the header', () => {
    const preview = parsePortfolioCsv(`\uFEFF${csvText('FD,fd,,,,1,INR')}`);
    expect(preview.validRows).toBe(1);
    expect(preview.issues).toEqual([]);
  });

  it('surfaces unterminated quotes from the parser', () => {
    const preview = parsePortfolioCsv([
      HEADER,
      'FD,fd,,,,1,INR',
      'SIP,"oops,2,500,,,INR',
    ].join('\r\n'));
    expect(preview.issues).toContainEqual({
      row: 3,
      field: 'row',
      message: expect.stringContaining('Quoted field unterminated'),
    });
  });

  it('round-trips an exported portfolio back into matching sections', () => {
    const state = initializeState();
    state.sip.sip1 = {
      name: 'Parag Parikh Flexi Cap',
      schemeCode: '120503',
      units: 10.5,
      startDate: '2024-01',
      monthlyAmount: 5000,
      costBasis: 60000,
    };
    state.fd.fd = { amount: 100000, currency: 'INR' };
    state.epf.epf1 = { amount: 250000, currency: 'INR' };
    state.bonds.bond1 = { amount: 50000, currency: 'INR' };
    state.otherHoldings.otherHolding1 = { name: 'Gold', amount: 80000, annualReturn: 0 };
    state.demat.demat1 = { isin: 'INE00001', quantity: 7, currentValue: 1400, name: 'TCS' };
    state.liabilities.liability1 = { name: 'Car loan', amount: 50000 };

    const preview = parsePortfolioCsv(buildPortfolioCsv(state));
    expect(preview.issues).toEqual([]);
    expect(preview.validRows).toBe(7);
    expect(isPersistedPortfolioData(preview.candidate)).toBe(true);
    expect(preview.candidate.fd).toEqual(state.fd);
    expect(preview.candidate.epf).toEqual(state.epf);
    expect(preview.candidate.bonds).toEqual(state.bonds);
    expect(preview.candidate.otherHoldings).toEqual(state.otherHoldings);
    expect(preview.candidate.liabilities).toEqual(state.liabilities);
    // Documented losses: export has no scheme code/start date/ISIN columns.
    expect(preview.candidate.sip).toEqual({
      sip1: {
        name: 'Parag Parikh Flexi Cap',
        units: 10.5,
        startDate: '',
        monthlyAmount: 5000,
        costBasis: 60000,
      },
    });
    expect(preview.candidate.demat).toEqual({
      demat1: { isin: '', quantity: 7, currentValue: 1400, name: 'TCS' },
    });
  });
});

describe('applyPortfolioCsvImport', () => {
  const candidate: Partial<FireOSState> = { fd: { fd: { amount: 999, currency: 'INR' } } };

  function fixture(): FireOSState {
    const state = initializeState();
    state.profile.name = 'Ravi';
    state.sip.sip1 = { name: 'Existing SIP', units: 3, startDate: '2024-01', monthlyAmount: 1000 };
    state.fd.fd = { amount: 100, currency: 'INR' };
    state.currentUser = { uid: 'active-user' } as FireOSState['currentUser'];
    state._syncMetadata = { lastSavedAt: '2026-10-03T00:00:00.000Z', isDirty: true };
    return state;
  }

  it('does not save or mutate when the user has not confirmed', async () => {
    const state = fixture();
    const context = createFeatureContext(state);
    const save = vi.spyOn(context.portfolio, 'save');
    const before = structuredClone(state);
    await applyPortfolioCsvImport(candidate, context, 'replace', false);
    expect(state).toEqual(before);
    expect(save).not.toHaveBeenCalled();
  });

  it('treats an empty candidate as a safe no-op', async () => {
    const state = fixture();
    const context = createFeatureContext(state);
    const save = vi.spyOn(context.portfolio, 'save');
    const before = structuredClone(state);
    await applyPortfolioCsvImport({}, context, 'replace', true);
    expect(state).toEqual(before);
    expect(save).not.toHaveBeenCalled();
  });

  it('leaves state untouched when the candidate fails schema validation', async () => {
    const state = fixture();
    const context = createFeatureContext(state);
    const save = vi.spyOn(context.portfolio, 'save');
    const before = structuredClone(state);
    await applyPortfolioCsvImport({ profile: { age: 'old' } } as unknown as Partial<FireOSState>, context, 'replace', true);
    expect(state).toEqual(before);
    expect(save).not.toHaveBeenCalled();
  });

  it('merge overwrites only the sections present in the candidate', async () => {
    const state = fixture();
    const context = createFeatureContext(state);
    const save = vi.spyOn(context.portfolio, 'save').mockResolvedValue();
    await applyPortfolioCsvImport(candidate, context, 'merge', true);
    expect(state.fd).toEqual({ fd: { amount: 999, currency: 'INR' } });
    expect(state.sip.sip1).toEqual({ name: 'Existing SIP', units: 3, startDate: '2024-01', monthlyAmount: 1000 });
    expect(state.profile.name).toBe('Ravi');
    expect(state.currentUser).toEqual({ uid: 'active-user' });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('replace performs a full normalized replacement while keeping runtime identity', async () => {
    const state = fixture();
    const context = createFeatureContext(state);
    const save = vi.spyOn(context.portfolio, 'save').mockResolvedValue();
    await applyPortfolioCsvImport(candidate, context, 'replace', true);
    expect(state.fd).toEqual({ fd: { amount: 999, currency: 'INR' } });
    expect(state.sip).toEqual({});
    // CSV cannot carry profile, so replace resets unlisted sections to defaults.
    expect(state.profile.name).toBe('');
    expect(state.currentUser).toEqual({ uid: 'active-user' });
    expect(state._syncMetadata?.isDirty).toBe(true);
    expect(save).toHaveBeenCalledWith(state);
  });

  it('leaves active state unchanged when the repository save rejects', async () => {
    const state = fixture();
    const context = createFeatureContext(state);
    vi.spyOn(context.portfolio, 'save').mockRejectedValue(new Error('storage failed'));
    const before = structuredClone(state);
    await expect(applyPortfolioCsvImport(candidate, context, 'merge', true)).rejects.toThrow('storage failed');
    expect(state).toEqual(before);
  });
});
