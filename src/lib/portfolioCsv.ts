import Papa from 'papaparse';
import type { FireOSState } from '../types/state';
import { getFundSchemeCode } from './fundMatcher';

type CsvValue = string | number | undefined;

function formulaSafe(value: CsvValue): string | number {
  if (typeof value !== 'string') return value ?? '';
  return /^\s*[=+@-]/.test(value) ? `'${value}` : value;
}

export function buildPortfolioCsv(state: FireOSState): string {
  const rows: CsvValue[][] = [
    ['Category', 'Name', 'Units', 'Monthly contribution', 'Cost basis', 'Value', 'Currency'],
  ];

  for (const [category, funds] of [['Mutual fund', state.mf], ['SIP', state.sip]] as const) {
    for (const fund of Object.values(funds)) {
      const schemeCode = fund.schemeCode || getFundSchemeCode(fund.name);
      const nav = schemeCode ? state.nav[schemeCode]?.nav : undefined;
      rows.push([category, fund.name, fund.units, fund.monthlyAmount, fund.costBasis, nav === undefined ? '' : fund.units * nav, 'INR']);
    }
  }

  for (const [category, holdings] of [['FD', state.fd], ['EPF', state.epf], ['ESOP', state.esop], ['Bonds', state.bonds]] as const) {
    for (const [name, holding] of Object.entries(holdings)) {
      rows.push([category, name, '', '', '', holding.amount, holding.currency]);
    }
  }
  for (const holding of Object.values(state.otherHoldings)) {
    rows.push(['Other', holding.name, '', '', '', holding.amount, 'INR']);
  }
  for (const holding of Object.values(state.demat)) {
    rows.push(['Demat', holding.name, holding.quantity, '', '', holding.currentValue, 'INR']);
  }
  for (const liability of Object.values(state.liabilities)) {
    rows.push(['Liability', liability.name, '', '', '', liability.amount, 'INR']);
  }

  return Papa.unparse(rows.map((row) => row.map(formulaSafe)), { quotes: true, newline: '\r\n' });
}
