/**
 * Fund Matcher - Internal fund name to scheme code mapper
 * Enables SIP NAV fetching without storing schemeCode in profile
 */

/**
 * Mapping of fund names to their scheme codes
 * Used for NAV fetching in dashboard KPI calculations
 */
const FUND_SCHEME_MAP: Record<string, string> = {
  'Parag Parikh Flexi Cap Fund - Direct Plan Growth': '122639',
  'NIPPON INDIA GROWTH MID CAP FUND - DIRECT': '118668',
  'NIPPON INDIA SMALL CAP FUND - DIRECT GROWTH PLAN': '118778',
};

/**
 * Get scheme code for a fund by name
 * Attempts exact match first, then fuzzy match
 *
 * @param fundName - The name of the fund to look up
 * @returns The scheme code, or empty string if not found
 */
export function getFundSchemeCode(fundName: string): string {
  if (!fundName || typeof fundName !== 'string') {
    return '';
  }

  // Exact match first
  if (FUND_SCHEME_MAP[fundName]) {
    return FUND_SCHEME_MAP[fundName];
  }

  // Fuzzy match: try partial/case-insensitive matching
  const normalizedInput = fundName.toLowerCase().trim();
  for (const [key, code] of Object.entries(FUND_SCHEME_MAP)) {
    if (key.toLowerCase().includes(normalizedInput) || normalizedInput.includes(key.toLowerCase())) {
      return code;
    }
  }

  return '';
}

/**
 * Get all available fund mappings (for debugging/admin purposes)
 */
export function getFundMappings(): Record<string, string> {
  return { ...FUND_SCHEME_MAP };
}
