import type {
  PersistedPortfolioData,
  PortfolioEnvelope,
  PortfolioSection,
  SyncConflict,
} from '../types/firebase';
import type { FireOSState } from '../types/state';

export interface MergeResult {
  envelope: PortfolioEnvelope;
  conflicts: SyncConflict[];
  dirtySections: PortfolioSection[];
}

const SECTION_FIELDS: Record<PortfolioSection, Array<keyof PersistedPortfolioData>> = {
  profile: ['profile'],
  holdings: ['mf', 'fd', 'epf', 'sip', 'esop', 'bonds', 'demat'],
  planning: [
    'coorgCorpus', 'coorgStartDate', 'coorgTarget', 'coorgMonthlyAmount',
    'watchdogRules', 'swpSchedule', 'taxCalendar', 'expenses',
    'netWorthHistory', 'completedActions', 'achievedMilestones',
  ],
  insurance: ['insurance'],
  esop: ['esopDetails'],
  cache: ['nav', 'niftyHigh', 'niftyData', 'eurInr', 'eurInrData', 'alphaTrackerData'],
};

function timestampMillis(timestamp: string | undefined): number {
  return timestamp ? Date.parse(timestamp) || 0 : 0;
}

function clone<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function compareTieBreakers(local: PortfolioEnvelope, remote: PortfolioEnvelope): number {
  const clientOrder = (local.client?.clientId ?? '').localeCompare(remote.client?.clientId ?? '');
  return clientOrder !== 0
    ? clientOrder
    : (local.client?.lastWriteId ?? '').localeCompare(remote.client?.lastWriteId ?? '');
}

function mergeSection(
  section: PortfolioSection,
  local: PortfolioEnvelope,
  remote: PortfolioEnvelope,
  conflicts: SyncConflict[],
): Partial<PersistedPortfolioData> {
  const localTimestamp = local.sectionUpdatedAt?.[section];
  const remoteTimestamp = remote.sectionUpdatedAt?.[section];

  if (!localTimestamp || !remoteTimestamp) {
    conflicts.push({
      section,
      localUpdatedAt: localTimestamp,
      remoteUpdatedAt: remoteTimestamp,
      reason: 'missing-timestamp',
    });
    const source = remoteTimestamp ? remote.data : local.data;
    return Object.fromEntries(SECTION_FIELDS[section].map((key) => [key, clone(source[key])])) as Partial<PersistedPortfolioData>;
  }

  const localMillis = timestampMillis(localTimestamp);
  const remoteMillis = timestampMillis(remoteTimestamp);
  if (localMillis > remoteMillis) {
    return Object.fromEntries(SECTION_FIELDS[section].map((key) => [key, clone(local.data[key])])) as Partial<PersistedPortfolioData>;
  }
  if (remoteMillis > localMillis) {
    return Object.fromEntries(SECTION_FIELDS[section].map((key) => [key, clone(remote.data[key])])) as Partial<PersistedPortfolioData>;
  }

  conflicts.push({ section, localUpdatedAt: localTimestamp, remoteUpdatedAt: remoteTimestamp, reason: 'equal-timestamp' });
  const source = compareTieBreakers(local, remote) >= 0 ? local.data : remote.data;
  return Object.fromEntries(SECTION_FIELDS[section].map((key) => [key, clone(source[key])])) as Partial<PersistedPortfolioData>;
}

function mergeHoldingEntries(
  local: PersistedPortfolioData['sip'],
  remote: PersistedPortfolioData['sip'],
  localEnvelope: PortfolioEnvelope,
  remoteEnvelope: PortfolioEnvelope,
): PersistedPortfolioData['sip'] {
  const localEntries = local ?? {};
  const remoteEntries = remote ?? {};
  const merged = { ...remoteEntries, ...localEntries };
  const localTimes = localEnvelope.entryUpdatedAt?.holdings ?? {};
  const remoteTimes = remoteEnvelope.entryUpdatedAt?.holdings ?? {};

  for (const key of Object.keys(merged)) {
    const localTime = timestampMillis(localTimes[key]);
    const remoteTime = timestampMillis(remoteTimes[key]);
    if (remoteTime > localTime && remoteEntries[key]) merged[key] = clone(remoteEntries[key]);
    if (!localEntries[key] && remoteEntries[key]) merged[key] = clone(remoteEntries[key]);
  }

  return merged;
}

/** Merge validated envelopes deterministically without mutating either input. */
export function mergeEnvelopes(local: PortfolioEnvelope, remote: PortfolioEnvelope): MergeResult {
  const conflicts: SyncConflict[] = [];
  const data = clone(remote.data);

  (Object.keys(SECTION_FIELDS) as PortfolioSection[]).forEach((section) => {
    Object.assign(data, mergeSection(section, local, remote, conflicts));
  });

  data.sip = mergeHoldingEntries(local.data.sip, remote.data.sip, local, remote);

  const sectionUpdatedAt = { ...remote.sectionUpdatedAt };
  (Object.keys(SECTION_FIELDS) as PortfolioSection[]).forEach((section) => {
    const localTimestamp = local.sectionUpdatedAt?.[section];
    const remoteTimestamp = remote.sectionUpdatedAt?.[section];
    sectionUpdatedAt[section] = timestampMillis(localTimestamp) > timestampMillis(remoteTimestamp)
      ? localTimestamp
      : remoteTimestamp;
  });

  return {
    envelope: {
      ...remote,
      data,
      sectionUpdatedAt,
      entryUpdatedAt: { ...remote.entryUpdatedAt, ...local.entryUpdatedAt },
    },
    conflicts,
    dirtySections: conflicts.map((conflict) => conflict.section),
  };
}

export function buildEnvelopeFromState(
  state: FireOSState,
  client: PortfolioEnvelope['client'] = {},
  now = new Date().toISOString(),
  previous?: PortfolioEnvelope,
): PortfolioEnvelope {
  const { currentUser, _syncMetadata, _lastSavedAt, ...data } = clone(state);
  void currentUser;
  void _syncMetadata;
  void _lastSavedAt;
  const sectionUpdatedAt: PortfolioEnvelope['sectionUpdatedAt'] = {};
  (Object.keys(SECTION_FIELDS) as PortfolioSection[]).forEach((section) => {
    const changed = SECTION_FIELDS[section].some((key) =>
      JSON.stringify(previous?.data[key]) !== JSON.stringify(data[key]),
    );
    sectionUpdatedAt[section] = changed
      ? now
      : previous?.sectionUpdatedAt?.[section] ?? now;
  });

  return {
    schemaVersion: 'fireOS_v3',
    lastSavedAt: now,
    client,
    data,
    sectionUpdatedAt,
    entryUpdatedAt: previous?.entryUpdatedAt,
    format: { normalizedArrays: false, backupVersion: 'fireOS_v2' },
  };
}

export function applyEnvelopeToState(state: FireOSState, envelope: PortfolioEnvelope): FireOSState {
  Object.assign(state, clone(envelope.data));
  return state;
}