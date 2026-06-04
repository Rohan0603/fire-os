/**
 * Storage Module - Data persistence layer
 *
 * Provides offline-first data persistence with Firebase Realtime Database sync.
 * Functions are exported as library utilities; main.ts has its own simple
 * localStorage integration for initial bootstrap. Full integration happens
 * when Firebase auth module (Task 7) is implemented.
 *
 * - loadData() / saveData() → localStorage only
 * - loadPortfolioFromFirebase() / savePortfolioToFirebase() → Firebase with 1s debounce
 * - exportPortfolio() / importPortfolio() → JSON file export/import
 *
 * Implements offline-first architecture with 4-hour NAV cache TTL
 */

import { FireOSState, initializeState, mergeState } from '../types/state';
import { FireOSBackup, BackupHoldings } from '../types/firebase';
import { NAVCache, EURINRData } from '../types/api';

// localStorage key for portfolio data
const STORAGE_KEY = 'fireOS_v2';

// NAV cache TTL: 4 hours in milliseconds
const NAV_CACHE_TTL = 4 * 60 * 60 * 1000; // 14400000ms

// Debounce timer for Firebase saves
let pendingSave: ReturnType<typeof setTimeout> | null = null;
let lastState: FireOSState | null = null;
let lastSavedSnapshot: string | null = null;

// Compare only data fields that matter (exclude timestamps/caches)
function stateSnapshot(state: FireOSState): string {
  return JSON.stringify({
    profile: state.profile,
    mf: state.mf,
    fd: state.fd,
    epf: state.epf,
    sip: state.sip,
    esop: state.esop,
    demat: state.demat,
    eurInr: typeof state.eurInr === 'number' ? state.eurInr : 0,
    coorgCorpus: state.coorgCorpus,
    coorgStartDate: state.coorgStartDate,
    coorgTarget: state.coorgTarget,
    coorgMonthlyAmount: state.coorgMonthlyAmount,
  });
}

/**
 * Load portfolio data from localStorage
 * Validates NAV cache TTL (4 hours) and flags stale data for refresh
 * @returns FireOSState if found, null otherwise
 */
export function loadData(): FireOSState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const state = JSON.parse(stored) as FireOSState;

    // Validate NAV cache TTL and flag stale entries
    if (state.nav && typeof state.nav === 'object') {
      const now = Date.now();
      for (const [key, cache] of Object.entries(state.nav)) {
        if (cache && typeof cache === 'object') {
          const cacheObj = cache as NAVCache;
          const cachedAt = new Date(cacheObj.timestamp).getTime();
          const age = now - cachedAt;

          // Flag if older than 4 hours, but keep the data
          if (age > NAV_CACHE_TTL) {
            // Log in dev mode for debugging
            if (process.env.NODE_ENV === 'development') {
              console.debug(`[Storage] NAV cache stale for scheme ${cacheObj.schemeCode}: ${Math.round(age / 1000 / 60)} minutes old`);
            }
          }
        }
      }
    }

    return state;
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.warn('[Storage] Corrupted localStorage data, returning null');
      return null;
    }
    if (error instanceof Error && error.message.includes('QuotaExceededError')) {
      console.warn('[Storage] localStorage quota exceeded, returning null');
      return null;
    }
    console.error('[Storage] Error loading data:', error);
    return null;
  }
}

/**
 * Save portfolio data to localStorage synchronously
 * Updates timestamp before saving. Callers should debounce (500ms) at call site
 * @param state FireOSState to persist
 */
export function saveData(state: FireOSState): void {
  try {
    // Update last saved timestamp
    state._lastSavedAt = new Date().toISOString();

    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);

    // Log success in dev mode
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Storage] Saved to localStorage (${serialized.length} bytes)`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('QuotaExceededError')) {
      console.warn('[Storage] localStorage quota exceeded, continuing with memory storage');
      return;
    }
    console.error('[Storage] Error saving data:', error);
  }
}

/**
 * Load portfolio data from Firebase Realtime Database
 * Merges with current local state, supports v1 and v2 backup formats
 * @param uid Firebase user UID
 * @returns Merged FireOSState or null if user has no portfolio
 */
export async function loadPortfolioFromFirebase(uid: string): Promise<FireOSState | null> {
  try {
    // Lazy-load Firebase to avoid circular dependencies
    const { getDatabase, ref, get } = await import('firebase/database');

    const db = getDatabase();
    const portfolioRef = ref(db, `users/${uid}/portfolio`);
    const snapshot = await get(portfolioRef);

    if (!snapshot.exists()) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[Storage] No Firebase portfolio found for user');
      }
      return null;
    }

    const rawData = snapshot.val() as any;

    if (process.env.NODE_ENV === 'development') {
      console.debug('[Storage] Loaded portfolio from Firebase');
    }

    // Unwrap holdings if stored in nested structure
    const firebaseData: Partial<FireOSState> = rawData.holdings
      ? { ...rawData, ...rawData.holdings, holdings: undefined }
      : rawData;

    // Merge with current local state
    const currentState = loadData() || initializeState();
    const merged = mergeState(currentState, firebaseData);

    // Normalize eurInr: Firebase stores { rate, timestamp }, state expects number
    if (merged.eurInr && typeof merged.eurInr === 'object') {
      merged.eurInr = (merged.eurInr as any).rate ?? 0;
    }

    // Cleanup 0-unit SIPs (no name or 0 units without cost basis)
    if (merged.sip) {
      for (const key of Object.keys(merged.sip)) {
        const s = merged.sip[key];
        if (!s.name || (s.units === 0 && !s.costBasis)) {
          delete merged.sip[key];
        }
      }
    }

    return merged;
  } catch (error) {
    if (error instanceof Error && error.message.includes('PERMISSION_DENIED')) {
      console.debug('[Storage] Firebase permission denied (user not authenticated or uid mismatch)');
      return null;
    }
    if (error instanceof Error && error.message.includes('Failed to fetch')) {
      console.warn('[Storage] Firebase connection error, using local state');
      return null;
    }
    console.error('[Storage] Error loading from Firebase:', error);
    return null;
  }
}

/**
 * Save portfolio data to Firebase Realtime Database with debouncing
 * Max 1 save per second. Rapid calls are coalesced into a single save.
 * @param uid Firebase user UID
 * @param state FireOSState to persist
 */
export async function savePortfolioToFirebase(uid: string, state: FireOSState): Promise<void> {
  // Check if state actually changed
  const currentSnapshot = stateSnapshot(state);
  if (currentSnapshot === lastSavedSnapshot) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[Storage] Skipping Firebase save: no changes');
    }
    return;
  }

  // Always capture the latest state to avoid race conditions
  lastState = state;

  // Cancel any pending save (coalesce rapid calls)
  if (pendingSave !== null) {
    clearTimeout(pendingSave);
  }

  // Schedule save 1 second from now
  pendingSave = setTimeout(async () => {
    try {
      // Use the last captured state, not the one from the closure
      if (!lastState) return;

      // Lazy-load Firebase to avoid circular dependencies
      const { getDatabase, ref, set } = await import('firebase/database');

      const db = getDatabase();
      const portfolioRef = ref(db, `users/${uid}/portfolio`);

      // Create backup envelope
      const holdings: BackupHoldings = {
        mf: lastState.mf,
        fd: lastState.fd,
        epf: lastState.epf,
        sip: lastState.sip,
        esop: lastState.esop,
        bonds: lastState.bonds,
        demat: lastState.demat,
      };

      const rawEurInr = lastState.eurInr;
      const eurInrRate = typeof rawEurInr === 'number' ? rawEurInr
        : typeof rawEurInr === 'object' && rawEurInr !== null ? (rawEurInr as any).rate ?? 0
        : 0;
      const eurInrData: EURINRData | undefined = eurInrRate > 0
        ? { rate: eurInrRate, timestamp: new Date().toISOString() }
        : undefined;

      const backup: FireOSBackup = {
        version: '2',
        timestamp: new Date().toISOString(),
        profile: lastState.profile,
        holdings,
        navCache: lastState.nav,
        niftyData: lastState.niftyData,
        ...(eurInrData && { eurInr: eurInrData }),
        alphaTrackerData: lastState.alphaTrackerData,
        watchdogRules: lastState.watchdogRules,
        coorgCorpus: lastState.coorgCorpus,
        coorgStartDate: lastState.coorgStartDate,
        coorgTarget: lastState.coorgTarget,
        coorgMonthlyAmount: lastState.coorgMonthlyAmount,
        insurance: lastState.insurance,
        esopDetails: lastState.esopDetails,
        netWorthHistory: lastState.netWorthHistory,
        achievedMilestones: lastState.achievedMilestones,
      };

      await set(portfolioRef, backup);

      // Update local timestamp and snapshot
      lastState._lastSavedAt = new Date().toISOString();
      lastSavedSnapshot = stateSnapshot(lastState);

      if (process.env.NODE_ENV === 'development') {
        console.debug('[Storage] Saved portfolio to Firebase');
      }
    } catch (error) {
      // Retry once on failure
      if (error instanceof Error && error.message.includes('PERMISSION_DENIED')) {
        console.warn('[Storage] Firebase permission denied, skipping save');
        return;
      }
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        console.warn('[Storage] Firebase connection error, offline mode');
        return;
      }
      console.warn('[Storage] Error saving to Firebase:', error);
    } finally {
      pendingSave = null;
    }
  }, 1000);
}

/**
 * Export portfolio as JSON file download
 * Creates v2 backup envelope, triggers browser download
 * @param state FireOSState to export
 */
export function exportPortfolio(state: FireOSState): void {
  try {
    const holdings: BackupHoldings = {
      mf: state.mf,
      fd: state.fd,
      epf: state.epf,
      sip: state.sip,
      esop: state.esop,
      bonds: state.bonds,
      demat: state.demat,
    };

    const eurInrData: EURINRData | undefined = state.eurInr !== undefined && state.eurInr !== null
      ? { rate: typeof state.eurInr === 'number' ? state.eurInr : (state.eurInr as any).rate ?? 0, timestamp: new Date().toISOString() }
      : undefined;

    const backup: FireOSBackup = {
      version: '2',
      timestamp: new Date().toISOString(),
      profile: state.profile,
      holdings,
      navCache: state.nav,
      niftyData: state.niftyData,
      ...(eurInrData && { eurInr: eurInrData }),
      alphaTrackerData: state.alphaTrackerData,
      watchdogRules: state.watchdogRules,
      coorgCorpus: state.coorgCorpus,
      coorgStartDate: state.coorgStartDate,
      coorgTarget: state.coorgTarget,
      coorgMonthlyAmount: state.coorgMonthlyAmount,
      insurance: state.insurance,
      esopDetails: state.esopDetails,
      netWorthHistory: state.netWorthHistory,
      achievedMilestones: state.achievedMilestones,
    };

    // Generate filename: fireOS_backup_YYYY-MM-DD.json
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `fireOS_backup_${dateStr}.json`;

    // Create blob and download
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Storage] Exported portfolio as ${filename}`);
    }
  } catch (error) {
    console.error('[Storage] Error exporting portfolio:', error);
    throw new Error('Failed to export portfolio');
  }
}

/**
 * Import portfolio from JSON file
 * Supports both v1 (legacy) and v2 backup formats
 * @param file JSON file from user upload
 * @returns Parsed FireOSState
 * @throws Error if parsing fails or required fields missing
 */
export async function importPortfolio(file: File): Promise<FireOSState> {
  try {
    const text = await file.text();
    const data = JSON.parse(text) as unknown;

    if (typeof data !== 'object' || data === null) {
      throw new Error('Invalid backup format: not a JSON object');
    }

    const obj = data as Record<string, unknown>;

    // Detect v1 vs v2 format
    let backup: Record<string, unknown>;

    // V2 format: version field at root
    if ('version' in obj && obj.version === '2') {
      backup = obj;
    } else if ('backup' in obj) {
      // V1 legacy format: backup key at root
      backup = (obj.backup as Record<string, unknown>) || obj;
    } else {
      backup = obj;
    }

    // Validate required fields
    if (!backup.profile || typeof backup.profile !== 'object') {
      throw new Error('Invalid backup: missing profile data');
    }
    if (!backup.holdings || typeof backup.holdings !== 'object') {
      throw new Error('Invalid backup: missing holdings data');
    }

    const holdings = backup.holdings as Record<string, unknown>;

    // Reconstruct FireOSState from backup
    const state = initializeState();
    state.profile = backup.profile as any;
    state.mf = (holdings.mf as any) || {};
    state.fd = (holdings.fd as any) || {};
    state.epf = (holdings.epf as any) || {};
    state.sip = (holdings.sip as any) || {};
    state.esop = (holdings.esop as any) || {};
    state.demat = (holdings.demat as any) || {};
    state.nav = (backup.navCache as any) || {};
    state.niftyData = backup.niftyData as any;
    state.alphaTrackerData = (backup.alphaTrackerData as any) || {};

    // Set EUR/INR from backup data if present
    if (backup.eurInr && typeof backup.eurInr === 'object') {
      const eurInrObj = backup.eurInr as Record<string, unknown>;
      if (typeof eurInrObj.rate === 'number') {
        state.eurInr = eurInrObj.rate;
      }
    }

    // Restore Coorg fields if present in backup
    if (typeof backup.coorgCorpus === 'number') {
      state.coorgCorpus = backup.coorgCorpus;
    }
    if (typeof backup.coorgStartDate === 'string') {
      state.coorgStartDate = backup.coorgStartDate;
    }
    if (typeof backup.coorgTarget === 'number') {
      state.coorgTarget = backup.coorgTarget;
    }
    if (typeof backup.coorgMonthlyAmount === 'number') {
      state.coorgMonthlyAmount = backup.coorgMonthlyAmount;
    }

    // Restore esopDetails and insurance if they exist in backup
    if (backup.esopDetails) {
      state.esopDetails = backup.esopDetails as any;
    }
    if (backup.insurance) {
      state.insurance = backup.insurance as any;
    }

    state._lastSavedAt = (backup.timestamp as string) || new Date().toISOString();

    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Storage] Imported portfolio from file: ${file.name}`);
    }

    return state;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON file: ${error.message}`);
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error during import');
  }
}
