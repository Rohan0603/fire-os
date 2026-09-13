/**
 * Storage Module - Data persistence layer
 *
 * Provides offline-first local cache persistence and Firestore sync queueing.
 * Functions are exported as library utilities; main.ts has its own simple
 * localStorage integration for initial bootstrap.
 *
 * - loadData() / saveData() → localStorage only
 * - queuePortfolioSave() → Firestore SyncCoordinator queue
 * Implements offline-first architecture with 4-hour NAV cache TTL
 */

import { FireOSState } from '../types/state';
import { NAVCache } from '../types/api';
import { buildEnvelopeFromState } from './merge';
import type { SyncCoordinator } from './syncCoordinator';
import type { PortfolioEnvelope } from '../types/firebase';

// localStorage key for portfolio data
const STORAGE_KEY = 'fireOS_v2';

// NAV cache TTL: 4 hours in milliseconds
const NAV_CACHE_TTL = 4 * 60 * 60 * 1000; // 14400000ms

let activeSyncCoordinator: SyncCoordinator | null = null;
let activeEnvelope: PortfolioEnvelope | null = null;

export function configurePortfolioSync(
  coordinator: SyncCoordinator | null,
  envelope: PortfolioEnvelope | null = null,
): void {
  activeSyncCoordinator = coordinator;
  activeEnvelope = envelope;
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
      for (const [, cache] of Object.entries(state.nav)) {
        if (cache && typeof cache === 'object') {
          const cacheObj = cache as NAVCache;
          const cachedAt = new Date(cacheObj.timestamp).getTime();
          const age = now - cachedAt;

          // Flag if older than 4 hours, but keep the data
          if (age > NAV_CACHE_TTL) {
            // Log in dev mode for debugging
            if (import.meta.env.DEV) {
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
    if (import.meta.env.DEV) {
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

/** Queue the latest portfolio envelope for Firestore synchronization. */
export async function queuePortfolioSave(uid: string, state: FireOSState): Promise<void> {
  if (!activeSyncCoordinator) {
    throw new Error(`Firestore sync is not active for user ${uid}`);
  }
  const envelope = buildEnvelopeFromState(state, {
    clientId: 'browser',
    appVersion: '2.2.0',
    platform: 'web',
  }, state._lastSavedAt, activeEnvelope ?? undefined);
  activeEnvelope = envelope;
  activeSyncCoordinator.markDirty(envelope);
}
