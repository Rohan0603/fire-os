/**
 * Storage Module - Data persistence layer
 *
 * Provides offline-first local cache persistence and Firestore sync queueing.
 * Functions are exported as library utilities; main.ts has its own simple
 * localStorage integration for initial bootstrap.
 *
 * - loadData() / saveData() -> validated localStorage persistence
 * - persistPortfolioState() -> local-first persistence with optional cloud enqueue
 * Implements offline-first architecture with 4-hour NAV cache TTL
 */

import { FireOSState, isPersistedPortfolioData, normalizePersistedState, type MarketHistoryCacheMap } from '../types/state';
import { NAVCache } from '../types/api';
import { buildEnvelopeFromState } from './merge';
import type { SyncCoordinator } from './syncCoordinator';
import type { PortfolioEnvelope } from '../types/firebase';
import { recordPortfolioSnapshot, undoLastPortfolioSnapshot } from './snapshot-history';
import { getHistoryCacheMap, sanitizeHistoryCache } from '../modules/api';
import { notifyPortfolioSaved } from '../core/stores';

const LEGACY_STORAGE_KEY = 'fireOS_v2';
const ANONYMOUS_STORAGE_KEY = 'fireOS_v2:anonymous';
const USER_STORAGE_PREFIX = 'fireOS_v2:user:';
const USER_ID_PATTERN = /^[A-Za-z0-9._~-]{1,128}$/;

// NAV cache TTL: 4 hours in milliseconds
const NAV_CACHE_TTL = 4 * 60 * 60 * 1000; // 14400000ms

/**
 * Serialized local payload ceiling documented in docs/README.md
 * ("Portfolio storage sizing"): a state payload above 750 KB warns. Market
 * history is expendable cache, so it is dropped first to stay under it.
 */
export const PERSISTED_PAYLOAD_CEILING = 750 * 1024;

let activeSyncCoordinator: SyncCoordinator | null = null;
let activeEnvelope: PortfolioEnvelope | null = null;
let activeStorageKey: string | null = ANONYMOUS_STORAGE_KEY;
let activeStorageUid: string | null = null;

function getUserStorageKey(uid: string): string {
  if (!USER_ID_PATTERN.test(uid)) {
    throw new Error('Invalid authenticated user id for local storage scope');
  }
  return `${USER_STORAGE_PREFIX}${uid}`;
}

/** Select the local cache that may be read or written by persistence helpers. */
export function configurePortfolioStorageScope(uid: string | null): void {
  if (uid === null) {
    activeStorageKey = ANONYMOUS_STORAGE_KEY;
    activeStorageUid = null;
    return;
  }

  activeStorageKey = getUserStorageKey(uid);
  activeStorageUid = uid;
}

/** Disable local persistence until the next auth session explicitly selects a scope. */
export function clearPortfolioStorageScope(): void {
  activeStorageKey = null;
  activeStorageUid = null;
}

export function getPortfolioStorageKey(): string | null {
  return activeStorageKey;
}

function canPersistState(state: FireOSState): boolean {
  if (!activeStorageKey) return false;
  return activeStorageUid === null
    ? state.currentUser === null
    : state.currentUser?.uid === activeStorageUid;
}

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
    if (!activeStorageKey) return null;

    let stored = localStorage.getItem(activeStorageKey);
    const shouldMigrateLegacy = !stored && activeStorageKey === ANONYMOUS_STORAGE_KEY;
    if (shouldMigrateLegacy) {
      stored = localStorage.getItem(LEGACY_STORAGE_KEY);
    }
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    const state = normalizePersistedState(parsed);
    if (!state) {
      console.warn('[Storage] Invalid localStorage data, returning null');
      return null;
    }
    if (shouldMigrateLegacy) {
      localStorage.setItem(ANONYMOUS_STORAGE_KEY, JSON.stringify(state));
    }

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
 * Raw pre-overwrite read of the active scope's persisted history section.
 * Used as the last-resort save fallback when both in-memory sources are empty.
 */
function readPersistedHistoryCache(): MarketHistoryCacheMap {
  if (!activeStorageKey) return {};
  try {
    const raw = localStorage.getItem(activeStorageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { marketHistory?: unknown };
    if (!parsed || typeof parsed !== 'object'
      || typeof parsed.marketHistory !== 'object' || parsed.marketHistory === null) {
      return {};
    }
    return sanitizeHistoryCache(parsed.marketHistory as MarketHistoryCacheMap);
  } catch {
    return {};
  }
}

/**
 * Save portfolio data to localStorage synchronously
 * Updates timestamp before saving. Callers should debounce (500ms) at call site
 * @param state FireOSState to persist
 */
export function saveData(state: FireOSState): void {
  try {
    if (!canPersistState(state)) {
      console.warn('[Storage] Refusing to persist data outside the active portfolio scope');
      return;
    }

    // Update last saved timestamp
    state._lastSavedAt = new Date().toISOString();

    // Mirror the bounded history cache into the persisted copy. The mirror is
    // intentionally cross-scope: the module cache is global and market history
    // is public market data (index/NAV series), never user data — so a guest
    // save may carry series fetched before sign-in and vice versa.
    // state.marketHistory is non-enumerable (local-only cache), so the spread
    // destructure below drops it; assign it explicitly onto `persisted`.
    const moduleHistory = getHistoryCacheMap();
    let sanitizedHistory = sanitizeHistoryCache(
      Object.keys(moduleHistory).length > 0 ? moduleHistory : (state.marketHistory ?? {}),
    );
    if (Object.keys(sanitizedHistory).length === 0) {
      // Both in-memory sources are empty (cache merely unwarmed or a handoff
      // gap): never let that erase an already-persisted history section.
      sanitizedHistory = readPersistedHistoryCache();
    }

    const { currentUser, _syncMetadata, _lastSavedAt, ...persisted } = state;
    void currentUser;
    void _syncMetadata;
    void _lastSavedAt;
    if (Object.keys(sanitizedHistory).length > 0) {
      persisted.marketHistory = sanitizedHistory;
    }
    // Drop undefined-valued keys (JSON.stringify does the same), so optional
    // fields cleared with `= undefined` don't poison validation.
    const persistedRecord = persisted as Record<string, unknown>;
    for (const key of Object.keys(persistedRecord)) {
      if (persistedRecord[key] === undefined) delete persistedRecord[key];
    }
    if (!isPersistedPortfolioData(persisted)) {
      const invalidKeys = Object.keys(persisted).filter((key) =>
        !isPersistedPortfolioData({ [key]: persisted[key as keyof typeof persisted] }),
      );
      console.warn('[Storage] Refusing to persist invalid portfolio data', invalidKeys);
      return;
    }

    let serialized = JSON.stringify(persisted);
    if (serialized.length > PERSISTED_PAYLOAD_CEILING && 'marketHistory' in persisted) {
      console.warn('[Storage] Persisted payload exceeds ceiling; dropping market history cache');
      delete persisted.marketHistory;
      serialized = JSON.stringify(persisted);
    }
    if (serialized.length > PERSISTED_PAYLOAD_CEILING) {
      console.warn(`[Storage] Persisted payload exceeds the ${PERSISTED_PAYLOAD_CEILING} byte ceiling (${serialized.length} bytes)`);
    }
    localStorage.setItem(activeStorageKey!, serialized);
    // Snapshots exclude history: keeps sessionStorage bounded and undo from
    // resurrecting a stale cache (the module cache keeps serving either way).
    recordPortfolioSnapshot(activeStorageKey!, { ...persisted, marketHistory: undefined });

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

/** Restore the previous validated local portfolio snapshot, if one exists. */
export function undoLastSavedPortfolioChange(state: FireOSState): boolean {
  if (!activeStorageKey) return false;
  return undoLastPortfolioSnapshot(activeStorageKey, state);
}

export interface PersistPortfolioOptions {
  sync?: boolean;
  awaitCloud?: boolean;
}

/** Persist locally first, then optionally enqueue one debounced Firestore write. */
export function persistPortfolioState(state: FireOSState, options: { sync?: boolean; awaitCloud: true }): Promise<void>;
export function persistPortfolioState(state: FireOSState, options?: { sync?: boolean; awaitCloud?: false }): void;
export function persistPortfolioState(
  state: FireOSState,
  options: PersistPortfolioOptions = {},
): void | Promise<void> {
  saveData(state);
  notifyPortfolioSaved();
  if (options.sync === false || !state.currentUser?.uid) return;

  const queued = queuePortfolioSave(state.currentUser.uid, state);
  if (options.awaitCloud) return queued;
  queued.catch((error) => console.warn('Firestore save failed:', error));
}

/** Queue the latest portfolio envelope for Firestore synchronization. */
export async function queuePortfolioSave(uid: string, state: FireOSState): Promise<void> {
  if (activeStorageUid !== uid) {
    throw new Error(`Firestore sync scope is not active for user ${uid}`);
  }
  if (!activeSyncCoordinator) {
    throw new Error(`Firestore sync is not active for user ${uid}`);
  }
  const envelope = buildEnvelopeFromState(
    // Market history is a local-only cache: Firestore rules and the envelope
    // allowlist do not include it, and it must not inflate the cloud document.
    { ...state, marketHistory: undefined },
    {
      clientId: 'browser',
      appVersion: '2.2.0',
      platform: 'web',
    },
    state._lastSavedAt,
    activeEnvelope ?? undefined,
  );
  activeEnvelope = envelope;
  activeSyncCoordinator.markDirty(envelope);
  await activeSyncCoordinator.flush();
}
