// Storage keys (prefixed to avoid collision with portfolio keys)
const CONSENT_STORAGE_SUFFIX = 'fireOS:assistant:consent';

export type ConsentState = {
  allowWrites: boolean;
};

function defaultConsentState(): ConsentState {
  return { allowWrites: false };
}

function consentKey(scope: string): string {
  return `${scope}:${CONSENT_STORAGE_SUFFIX}`;
}

/** Read consent from localStorage for the given scope */
export function readConsent(scope: string): ConsentState {
  try {
    if (typeof localStorage === 'undefined') return defaultConsentState();
    const raw = localStorage.getItem(consentKey(scope));
    if (!raw) return defaultConsentState();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return defaultConsentState();
    const rec = parsed as Record<string, unknown>;
    return {
      allowWrites: rec.allowWrites === true || rec.suggestChanges === true,
    };
  } catch {
    return defaultConsentState();
  }
}

/** Write consent to localStorage for the given scope */
export function writeConsent(scope: string, state: ConsentState): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(consentKey(scope), JSON.stringify(state));
  } catch {
    // storage unavailable or full - fail silently, defaults remain read-only
  }
}

/** Default consent: reads allowed; writes require explicit opt-in. */
export const defaultConsent: ConsentState = {
  allowWrites: false,
};

/** Toggle a single consent flag and persist */
export function toggleConsent(scope: string, flag: keyof ConsentState): ConsentState {
  const current = readConsent(scope);
  const next: ConsentState = {
    ...current,
    [flag]: !current[flag],
  };
  writeConsent(scope, next);
  return next;
}

/** Reads are allowed by default; only write consent is opt-in. */
export function canReadPortfolio(scope: string): boolean {
  void scope;
  return true;
}

/** Derive consent scope from a uid (null/undefined => anonymous) */
export function consentScope(uid: string | null | undefined): string {
  return uid ? `user:${uid}` : 'anonymous';
}
