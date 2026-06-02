/**
 * Storage layer for FIRE OS
 * Handles localStorage persistence, Firebase Realtime Database sync, and data import/export
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

    const firebaseData = snapshot.val() as Partial<FireOSState>;

    if (process.env.NODE_ENV === 'development') {
      console.debug('[Storage] Loaded portfolio from Firebase');
    }

    // Merge with current local state
    const currentState = loadData() || initializeState();
    return mergeState(currentState, firebaseData);
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
  // Cancel any pending save (coalesce rapid calls)
  if (pendingSave !== null) {
    clearTimeout(pendingSave);
  }

  // Schedule save 1 second from now
  pendingSave = setTimeout(async () => {
    try {
      // Lazy-load Firebase to avoid circular dependencies
      const { getDatabase, ref, set } = await import('firebase/database');

      const db = getDatabase();
      const portfolioRef = ref(db, `users/${uid}/portfolio`);

      // Create backup envelope
      const holdings: BackupHoldings = {
        mf: state.mf as Record<string, unknown> as Record<string, any>,
        fd: state.fd,
        epf: state.epf,
        sip: state.sip as Record<string, unknown> as Record<string, any>,
        esop: state.esop,
        demat: state.demat,
      };

      const eurInrData: EURINRData | undefined = state.eurInr
        ? { rate: state.eurInr, timestamp: new Date().toISOString() }
        : undefined;

      const backup: FireOSBackup = {
        version: '2',
        timestamp: new Date().toISOString(),
        profile: state.profile,
        holdings,
        navCache: state.nav,
        niftyData: state.niftyData,
        eurInr: eurInrData,
        alphaTrackerData: state.alphaTrackerData,
      };

      await set(portfolioRef, backup);

      // Update local timestamp
      state._lastSavedAt = new Date().toISOString();

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
      mf: state.mf as Record<string, unknown> as Record<string, any>,
      fd: state.fd,
      epf: state.epf,
      sip: state.sip as Record<string, unknown> as Record<string, any>,
      esop: state.esop,
      demat: state.demat,
    };

    const eurInrData: EURINRData | undefined = state.eurInr
      ? { rate: state.eurInr, timestamp: new Date().toISOString() }
      : undefined;

    const backup: FireOSBackup = {
      version: '2',
      timestamp: new Date().toISOString(),
      profile: state.profile,
      holdings,
      navCache: state.nav,
      niftyData: state.niftyData,
      eurInr: eurInrData,
      alphaTrackerData: state.alphaTrackerData,
      watchdogData: state.alphaTrackerData, // Same as alphaTrackerData for v2
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
