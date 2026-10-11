import type { DematHolding, SIPFund } from '../../types/portfolio';
import type { CASParseResult, CASHolding } from './pdf-parser';

/**
 * Normalize a name for case-insensitive, whitespace-insensitive comparison.
 */
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Generate the next available SIP key (e.g., 'sip1', 'sip2', ...) that does not
 * collide with existing keys in the given map.
 */
function nextSipKey(sipMap: Record<string, SIPFund>): string {
  let i = 1;
  while (Object.prototype.hasOwnProperty.call(sipMap, `sip${i}`)) {
    i += 1;
  }
  return `sip${i}`;
}

/**
 * Generate the next available demat key based on the holding's identifier or name.
 * If the derived key already exists, append a numeric suffix until unique.
 */
function nextDematKey(
  dematMap: Record<string, DematHolding>,
  identifier: string | undefined,
  schemeName: string
): string {
  let base: string;
  if (identifier) {
    base = identifier.replace(/\W+/g, '_');
  } else {
    base = schemeName.replace(/\W+/g, '_').toLowerCase().substring(0, 20);
  }
  if (!Object.prototype.hasOwnProperty.call(dematMap, base)) {
    return base;
  }
  let i = 1;
  while (Object.prototype.hasOwnProperty.call(dematMap, `${base}_${i}`)) {
    i += 1;
  }
  return `${base}_${i}`;
}

/**
 * Plan a CAS import: merge the statement holdings into the existing SIP and
 * demat maps, preserving user-editable fields.
 *
 * Returns the merged maps and lists of added, updated, and untouched fund names
 * for SIPs, plus the merged demat map.
 */
export function planCasImport(
  current: {
    sip: Record<string, SIPFund>;
    demat: Record<string, DematHolding>;
  },
  result: CASParseResult,
) {
  const currentSip = current.sip;
  const currentDemat = current.demat;

  // Work on copies.
  const sip: Record<string, SIPFund> = { ...currentSip };
  const demat: Record<string, DematHolding> = { ...currentDemat };

  const added: string[] = [];
  const updated: string[] = [];
  const untouched: string[] = [];

  // Track which SIP keys were touched/matched during processing.
  const matchedSipKeys = new Set<string>();

  // Index existing SIPs by (schemeCode, name) for fast lookup.
  const sipByCode = new Map<string, string>();
  const sipByName = new Map<string, string>();
  for (const [key, fund] of Object.entries(currentSip)) {
    if (fund.schemeCode) {
      sipByCode.set(fund.schemeCode, key);
    }
    sipByName.set(normalizeName(fund.name), key);
  }

  // Process each SOA holding from the CAS statement.
  for (const h of result.holdings.filter((x) => x.type === 'soa')) {
    let matchedKey: string | undefined;

    // Match by normalized name.
    matchedKey = sipByName.get(normalizeName(h.schemeName));

    const startDate = h.navDate ? h.navDate.substring(0, 7) : new Date().toISOString().slice(0, 7);

    if (matchedKey) {
      const existing = sip[matchedKey];
      const nextUnits = h.balanceUnits;
      const unchanged = existing.units === nextUnits;
      // Preserve user-editable fields, update units.
      sip[matchedKey] = {
        ...existing,
        units: nextUnits,
      };
      matchedSipKeys.add(matchedKey);
      if (unchanged) {
        untouched.push(existing.name);
      } else {
        updated.push(existing.name);
      }
    } else {
      const newKey = nextSipKey(sip);
      sip[newKey] = {
        name: h.schemeName,
        units: h.balanceUnits,
        startDate,
        monthlyAmount: 0,
        ...(h.investedValue > 0 ? { costBasis: h.investedValue } : {}),
      };
      added.push(h.schemeName);
    }
  }

  // For SIPs untouched, we need to include any existing SIP that wasn't matched.
  for (const [key, fund] of Object.entries(currentSip)) {
    if (!matchedSipKeys.has(key)) {
      untouched.push(fund.name);
    }
  }

  // Process demat holdings from statement.
  const dematByName = new Map<string, string>();
  for (const [key, fund] of Object.entries(currentDemat)) {
    dematByName.set(normalizeName(fund.name), key);
  }
  const matchedDematKeys = new Set<string>();

  for (const h of result.holdings.filter((x) => x.type === 'demat')) {
    let matchedKey = dematByName.get(normalizeName(h.schemeName));
    let targetKey: string;

    if (matchedKey) {
      targetKey = matchedKey;
      matchedDematKeys.add(targetKey);
    } else {
      targetKey = nextDematKey(demat, h.identifier, h.schemeName);
    }

    const existing = demat[targetKey];
    if (existing) {
      // Update with statement values, preserve ISIN.
      demat[targetKey] = {
        ...existing,
        quantity: h.balanceUnits,
        currentValue: h.marketValue,
        isin: existing.isin,
        name: h.schemeName,
      };
    } else {
      demat[targetKey] = {
        isin: h.identifier ?? '',
        name: h.schemeName,
        quantity: h.balanceUnits,
        currentValue: h.marketValue,
      };
    }
  }

  // Return the normalized merged payload.
  return {
    sip,
    demat,
    added,
    updated,
    untouched,
  };
}