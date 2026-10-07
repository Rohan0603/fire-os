import { computeDiff, stripRuntime } from '../../lib/assistant/proposal';
import type { FireOSState } from '../../types/state';

export interface ImportSectionSummary {
  section: string;
  added: number;
  removed: number;
  replaced: number;
}

export interface ImportSummary {
  sections: ImportSectionSummary[];
  totals: { sections: number; added: number; removed: number; replaced: number };
}

const SECTION_LABELS: Record<string, string> = {
  mf: 'Mutual funds',
  sip: 'SIPs',
  fd: 'Fixed deposits',
  epf: 'EPF',
  esop: 'ESOP',
  bonds: 'Bonds',
  otherHoldings: 'Other holdings',
  liabilities: 'Liabilities',
  demat: 'Demat',
};

/**
 * Deep copy of the persisted state captured at the start of an apply path.
 * Runtime-only fields are stripped so a later save (timestamp, sync flags)
 * never reads as an import change, and so serializing never touches the
 * live auth object.
 */
export function captureStateSnapshot(state: FireOSState): FireOSState {
  return JSON.parse(JSON.stringify(stripRuntime(state))) as FireOSState;
}

/**
 * Count added / removed / replaced entries per top-level section, plus totals.
 * Entries come from `computeDiff`, so map-shaped holding sections report one
 * count per holding while scalar and array sections report a single change.
 */
export function buildImportSummary(before: FireOSState, after: FireOSState): ImportSummary {
  const rows = new Map<string, ImportSectionSummary>();
  const diff = computeDiff(stripRuntime(before) as FireOSState, stripRuntime(after) as FireOSState);

  for (const entry of diff) {
    const section = entry.path.split('.')[0];
    const row = rows.get(section) ?? { section, added: 0, removed: 0, replaced: 0 };
    if (entry.before === undefined) row.added += 1;
    else if (entry.after === undefined) row.removed += 1;
    else row.replaced += 1;
    rows.set(section, row);
  }

  const sections = [...rows.values()];
  const totals = { sections: sections.length, added: 0, removed: 0, replaced: 0 };
  for (const row of sections) {
    totals.added += row.added;
    totals.removed += row.removed;
    totals.replaced += row.replaced;
  }
  return { sections, totals };
}

/** Fill the post-import dialog with per-section counts and totals. */
export function showImportSummary(summary: ImportSummary): void {
  const dialog = document.getElementById('import-summary');
  const body = document.getElementById('import-summary-body');
  if (!dialog || !body) return;

  const lines = summary.sections.map((row) => {
    const parts: string[] = [];
    if (row.added) parts.push(`${row.added} added`);
    if (row.removed) parts.push(`${row.removed} removed`);
    if (row.replaced) parts.push(`${row.replaced} replaced`);
    return `${SECTION_LABELS[row.section] ?? row.section}: ${parts.join(', ')}`;
  });
  const { added, removed, replaced } = summary.totals;
  lines.push(
    added + removed + replaced > 0
      ? `Total: ${added} added, ${removed} removed, ${replaced} replaced`
      : 'No portfolio changes detected.'
  );
  body.textContent = lines.join('\n');
  dialog.style.display = 'flex';
}
