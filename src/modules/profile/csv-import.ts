import Papa from 'papaparse';
import * as v from 'valibot';
import type { FeatureContext } from '../../core/feature-context';
import type { DematHolding, Holding, Liability, OtherHolding, SIPFund } from '../../types/portfolio';
import {
  PERSISTED_STATE_KEYS,
  normalizePersistedState,
  persistedPortfolioSchema,
  type FireOSState,
} from '../../types/state';

/** Explicit apply choice the user must make before any save can happen. */
export type CsvImportMode = 'merge' | 'replace';

export interface CsvImportIssue {
  /** CSV record number: the header is row 1, the first data row is row 2. */
  row: number;
  field: string;
  message: string;
}

export interface CsvImportPreview {
  candidate: Partial<FireOSState>;
  validRows: number;
  issues: CsvImportIssue[];
}

const FIRST_DATA_ROW = 2;
const MAX_NAMED_ENTRIES = 50;
const FORMULA_ESCAPE = /^'\s*[=+@-]/;
const FORMULA_LIKE = /^\s*[=+@-]/;
const FORMULA_REJECT_MESSAGE =
  'Name looks like a spreadsheet formula and was rejected; add a leading apostrophe to import it as text.';

type FundSection = 'mf' | 'sip';
type AmountSection = 'fd' | 'epf' | 'esop' | 'bonds';

type CsvCategory =
  | { kind: 'fund'; section: FundSection }
  | { kind: 'amount'; section: AmountSection }
  | { kind: 'other' }
  | { kind: 'demat' }
  | { kind: 'liability' };

/** Only the state sections a CSV file can produce; everything else stays absent. */
interface Draft {
  mf?: Record<string, SIPFund>;
  sip?: Record<string, SIPFund>;
  fd?: Record<string, Holding>;
  epf?: Record<string, Holding>;
  esop?: Record<string, Holding>;
  bonds?: Record<string, Holding>;
  otherHoldings?: Record<string, OtherHolding>;
  demat?: Record<string, DematHolding>;
  liabilities?: Record<string, Liability>;
}

type NumberCell = { ok: true; value?: number } | { ok: false };
type NameCell = { ok: true; value: string; recovered: boolean } | { ok: false; reason: 'empty' | 'formula' };

function categorize(category: string): CsvCategory | null {
  switch (category) {
    case 'Mutual fund': return { kind: 'fund', section: 'mf' };
    case 'SIP': return { kind: 'fund', section: 'sip' };
    case 'FD': return { kind: 'amount', section: 'fd' };
    case 'EPF': return { kind: 'amount', section: 'epf' };
    case 'ESOP': return { kind: 'amount', section: 'esop' };
    case 'Bonds': return { kind: 'amount', section: 'bonds' };
    case 'Other': return { kind: 'other' };
    case 'Demat': return { kind: 'demat' };
    case 'Liability': return { kind: 'liability' };
    default: return null;
  }
}

/**
 * PapaParse without dynamicTyping returns strings only: blank cells mean the
 * number is absent, never zero, and anything non-finite is malformed.
 */
function readNumber(raw: unknown): NumberCell {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  const text = String(raw).trim();
  if (text === '') return { ok: true, value: undefined };
  const value = Number(text);
  return Number.isFinite(value) ? { ok: true, value } : { ok: false };
}

/**
 * Round-trip counterpart of the export formula escape: a leading apostrophe is
 * removed only when the remainder matches the export pattern, so ordinary
 * names such as `O'Brien` are never touched.
 */
function readName(raw: unknown): NameCell {
  const name = String(raw ?? '');
  if (FORMULA_ESCAPE.test(name)) return { ok: true, value: name.slice(1), recovered: true };
  if (FORMULA_LIKE.test(name)) return { ok: false, reason: 'formula' };
  if (name.trim() === '') return { ok: false, reason: 'empty' };
  return { ok: true, value: name, recovered: false };
}

function nextCount(counts: Record<string, number>, section: string): number {
  counts[section] = (counts[section] ?? 0) + 1;
  return counts[section];
}

/** Parse an export-schema CSV into a schema-validated candidate plus row issues. */
export function parsePortfolioCsv(text: string): CsvImportPreview {
  const issues: CsvImportIssue[] = [];
  const preview: CsvImportPreview = { candidate: {}, validRows: 0, issues };
  const source = text.startsWith('\uFEFF') ? text.slice(1) : text;
  const result = Papa.parse<Record<string, string>>(source, {
    header: true,
    delimiter: ',',
    skipEmptyLines: true,
  });

  const fields = result.meta.fields;
  if (!fields?.includes('Category') || !fields.includes('Name')) {
    issues.push({ row: 1, field: 'header', message: 'Expected the export header with Category and Name columns.' });
    return preview;
  }

  // Quote errors index records including the header; field mismatches index the
  // headerless data array. Both offsets were probed against papaparse 5.7.0.
  for (const error of result.errors) {
    const offset = error.type === 'Quotes' ? 1 : FIRST_DATA_ROW;
    issues.push({ row: typeof error.row === 'number' ? error.row + offset : 1, field: 'row', message: error.message });
  }

  const draft: Draft = {};
  const counts: Record<string, number> = {};
  const seen = new Set<string>();

  const processRow = (row: Record<string, string>, rowNumber: number): void => {
    const push = (field: string, message: string) => issues.push({ row: rowNumber, field, message });
    const requireNumber = (cell: NumberCell, field: string): number | null => {
      if (cell.ok && cell.value !== undefined) return cell.value;
      push(field, `${field} is required for this category.`);
      return null;
    };

    const category = String(row.Category ?? '').trim();
    const type = categorize(category);
    if (!type) {
      push('Category', category ? `Unknown category "${category}".` : 'Category is required.');
      return;
    }

    const nameCell = readName(row.Name);
    if (!nameCell.ok) {
      push('Name', nameCell.reason === 'formula' ? FORMULA_REJECT_MESSAGE : 'Name is required.');
      return;
    }
    const name = nameCell.value;
    if (name === '__proto__') {
      push('Name', 'This name cannot be used as a holding key.');
      return;
    }
    const seenKey = `${category}\u0000${name}`;
    if (seen.has(seenKey)) {
      push('Name', `Duplicate ${category} row for "${name}"; only the first row was imported.`);
      return;
    }

    const units = readNumber(row['Units']);
    const monthly = readNumber(row['Monthly contribution']);
    const costBasis = readNumber(row['Cost basis']);
    const value = readNumber(row['Value']);
    const cells: Array<[string, NumberCell]> = [
      ['Units', units],
      ['Monthly contribution', monthly],
      ['Cost basis', costBasis],
      ['Value', value],
    ];
    for (const [field, cell] of cells) {
      if (!cell.ok) {
        push(field, `Malformed number "${String(row[field] ?? '')}" in ${field}.`);
        return;
      }
    }
    const currency = String(row.Currency ?? '').trim() || 'INR';

    switch (type.kind) {
      case 'fund': {
        const fundUnits = requireNumber(units, 'Units');
        const monthlyAmount = requireNumber(monthly, 'Monthly contribution');
        if (fundUnits === null || monthlyAmount === null) return;
        const section = type.section === 'mf' ? (draft.mf ??= {}) : (draft.sip ??= {});
        section[`${type.section}${nextCount(counts, type.section)}`] = {
          name,
          units: fundUnits,
          startDate: '',
          monthlyAmount,
          ...(costBasis.ok && costBasis.value !== undefined ? { costBasis: costBasis.value } : {}),
        };
        break;
      }
      case 'amount': {
        const amount = requireNumber(value, 'Value');
        if (amount === null) return;
        const entry: Holding = { amount, currency };
        if (type.section === 'fd') (draft.fd ??= {})[name] = entry;
        else if (type.section === 'epf') (draft.epf ??= {})[name] = entry;
        else if (type.section === 'esop') (draft.esop ??= {})[name] = entry;
        else (draft.bonds ??= {})[name] = entry;
        break;
      }
      case 'other': {
        if (name.length > 200) {
          push('Name', 'Name must be 200 characters or fewer.');
          return;
        }
        const amount = requireNumber(value, 'Value');
        if (amount === null) return;
        if (amount < 0) {
          push('Value', 'Value must be zero or greater.');
          return;
        }
        const count = nextCount(counts, 'otherHoldings');
        if (count > MAX_NAMED_ENTRIES) {
          push('Name', `At most ${MAX_NAMED_ENTRIES} Other holdings can be imported.`);
          return;
        }
        // Export has no annual return column, so imported holdings default to 0.
        (draft.otherHoldings ??= {})[`otherHolding${count}`] = { name, amount, annualReturn: 0 };
        break;
      }
      case 'demat': {
        const quantity = requireNumber(units, 'Units');
        const currentValue = requireNumber(value, 'Value');
        if (quantity === null || currentValue === null) return;
        // Export has no ISIN column, so imported demat rows start blank.
        (draft.demat ??= {})[`demat${nextCount(counts, 'demat')}`] = { isin: '', quantity, currentValue, name };
        break;
      }
      case 'liability': {
        if (name.length > 100) {
          push('Name', 'Name must be 100 characters or fewer.');
          return;
        }
        const amount = requireNumber(value, 'Value');
        if (amount === null) return;
        if (amount < 0) {
          push('Value', 'Amount must be zero or greater.');
          return;
        }
        const count = nextCount(counts, 'liabilities');
        if (count > MAX_NAMED_ENTRIES) {
          push('Name', `At most ${MAX_NAMED_ENTRIES} liabilities can be imported.`);
          return;
        }
        (draft.liabilities ??= {})[`liability${count}`] = { name, amount };
        break;
      }
    }

    if (nameCell.recovered) {
      push('Name', `Removed the export formula-escape apostrophe; imported ${JSON.stringify(name)}.`);
    }
    seen.add(seenKey);
    preview.validRows += 1;
  };

  result.data.forEach((row, index) => processRow(row, index + FIRST_DATA_ROW));

  if (Object.keys(draft).length === 0) return preview;
  const candidate: Partial<FireOSState> = draft;
  if (!v.is(persistedPortfolioSchema, candidate)) {
    issues.push({ row: 1, field: 'file', message: 'Parsed rows do not form a valid portfolio payload.' });
    return { candidate: {}, validRows: 0, issues };
  }
  preview.candidate = candidate;
  return preview;
}

/** Persisted top-level sections of live state, including the non-enumerable history cache. */
function pickPersisted(state: FireOSState): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const key of PERSISTED_STATE_KEYS) {
    if (key in state) payload[key] = state[key];
  }
  return payload;
}

/**
 * Apply a parsed CSV candidate through the active repository, mirroring the
 * JSON restore path: nothing mutates until `save` resolves.
 *
 * - `merge`: candidate top-level sections overwrite same-key sections; sections
 *   absent from the candidate are preserved.
 * - `replace`: full normalized replacement, so sections absent from the CSV
 *   reset to defaults (same semantics as a JSON restore of a partial file).
 *
 * Unconfirmed calls and empty candidates are no-ops.
 */
export async function applyPortfolioCsvImport(
  candidate: Partial<FireOSState>,
  context: FeatureContext,
  mode: CsvImportMode,
  confirmed: boolean,
): Promise<void> {
  if (!confirmed || Object.keys(candidate).length === 0) return;
  const payload = mode === 'replace' ? candidate : { ...pickPersisted(context.state), ...candidate };
  const normalized = normalizePersistedState(payload);
  if (!normalized) return;
  const next = {
    ...normalized,
    currentUser: context.state.currentUser,
    _lastSavedAt: context.state._lastSavedAt,
    _syncMetadata: context.state._syncMetadata,
  };
  await context.portfolio.save(next);
  Object.assign(context.state, next);
}
