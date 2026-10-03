import { FireOSState, isPersistedPortfolioData } from '../types/state';

const MAX_SNAPSHOTS = 10;
const SNAPSHOT_SUFFIX = ':snapshots';

type PersistedSnapshot = Record<string, unknown>;

function snapshotKey(storageKey: string): string {
  return `${storageKey}${SNAPSHOT_SUFFIX}`;
}

function getStorage(): Storage | null {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage;
}

function readSnapshots(storageKey: string): PersistedSnapshot[] {
  try {
    const storage = getStorage();
    if (!storage) return [];
    const raw = storage.getItem(snapshotKey(storageKey));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is PersistedSnapshot => isPersistedPortfolioData(entry));
  } catch {
    return [];
  }
}

export function recordPortfolioSnapshot(storageKey: string, snapshot: PersistedSnapshot): void {
  const storage = getStorage();
  if (!storage) return;
  const snapshots = readSnapshots(storageKey);
  const serialized = JSON.stringify(snapshot);
  if (JSON.stringify(snapshots[snapshots.length - 1]) === serialized) return;
  snapshots.push(snapshot);
  storage.setItem(snapshotKey(storageKey), JSON.stringify(snapshots.slice(-MAX_SNAPSHOTS)));
}

export function undoLastPortfolioSnapshot(storageKey: string, state: FireOSState): boolean {
  const snapshots = readSnapshots(storageKey);
  if (snapshots.length < 2) return false;

  const previous = snapshots[snapshots.length - 2];
  if (!previous) return false;

  const currentUser = state.currentUser;
  const syncMetadata = state._syncMetadata;
  Object.keys(state).forEach((key) => {
    if (key !== 'currentUser' && key !== '_syncMetadata' && key !== '_lastSavedAt') {
      delete state[key as keyof FireOSState];
    }
  });
  Object.assign(state, previous, { currentUser, _syncMetadata: syncMetadata });
  const storage = getStorage();
  if (storage) storage.setItem(snapshotKey(storageKey), JSON.stringify(snapshots.slice(0, -1)));
  return true;
}
