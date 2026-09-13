/**
 * Firebase authentication and data sync type definitions
 * Covers user accounts and synchronization metadata
 */

import type { NiftyData, EURINRData } from './api';
import { isPersistedPortfolioData } from './state';
import type { FireOSState } from './state';
import type { User as FirebaseSDKUser } from 'firebase/auth';

/** Firebase authenticated user (uses official Firebase SDK type) */
export type FirebaseUser = FirebaseSDKUser;

/** Sync metadata for portfolio state */
export interface SyncMetadata {
  lastSavedAt: string; // ISO timestamp of last save to Firebase
  lastSyncedAt?: string; // ISO timestamp of last sync from Firebase
  isDirty: boolean; // Whether local state differs from server
}

export type SchemaVersion = 'fireOS_v2' | 'fireOS_v3' | 'fireOS_v4';

export interface ClientMetadata {
  clientId?: string;
  appVersion?: string;
  platform?: 'web' | 'mobile';
  userAgent?: string;
}

export interface Timestamped<T> {
  _updatedAt?: string;
  _createdAt?: string;
  value?: T;
}

export interface PortfolioData {
  profile?: FireOSState['profile'];
  mf?: FireOSState['mf'];
  sip?: FireOSState['sip'];
  fd?: FireOSState['fd'];
  epf?: FireOSState['epf'];
  esop?: FireOSState['esop'];
  bonds?: FireOSState['bonds'];
  demat?: FireOSState['demat'];
  nav?: FireOSState['nav'];
  niftyHigh?: number;
  niftyData?: NiftyData;
  eurInr?: number;
  eurInrData?: EURINRData;
  alphaTrackerData?: FireOSState['alphaTrackerData'];
  coorgCorpus?: number;
  coorgStartDate?: string;
  coorgTarget?: number;
  coorgMonthlyAmount?: number;
  watchdogRules?: FireOSState['watchdogRules'];
  swpSchedule?: FireOSState['swpSchedule'];
  taxCalendar?: FireOSState['taxCalendar'];
  expenses?: FireOSState['expenses'];
  netWorthHistory?: FireOSState['netWorthHistory'];
  completedActions?: FireOSState['completedActions'];
  achievedMilestones?: FireOSState['achievedMilestones'];
  insurance?: FireOSState['insurance'];
  esopDetails?: FireOSState['esopDetails'];
}

/** Fields persisted in Firestore; auth and runtime synchronization state stay local. */
export type PersistedPortfolioData = PortfolioData;

export type PortfolioSection =
  | 'profile'
  | 'holdings'
  | 'planning'
  | 'insurance'
  | 'esop'
  | 'cache';

export interface PortfolioClientMetadata {
  clientId?: string;
  appVersion?: string;
  platform?: 'web' | 'mobile';
  userAgent?: string;
  lastWriteId?: string;
}

export interface PortfolioMigrationMetadata {
  source: 'localStorage' | 'json';
  completedAt: string;
  sourceVersion: string;
}

/** Canonical document stored at /users/{uid}/portfolio/state. */
export interface PortfolioEnvelope {
  schemaVersion: SchemaVersion;
  lastSavedAt: string;
  client?: ClientMetadata & { lastWriteId?: string };
  serverMetadata?: {
    savedBy?: string;
    savedAt?: string;
  };
  data: PersistedPortfolioData;
  sectionUpdatedAt?: Partial<Record<PortfolioSection, string>>;
  entryUpdatedAt?: Record<string, Record<string, string>>;
  migration?: PortfolioMigrationMetadata;
  format?: {
    normalizedArrays: boolean;
    backupVersion: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

const persistedFields = new Set<keyof PersistedPortfolioData>([
  'profile', 'mf', 'sip', 'fd', 'epf', 'esop', 'bonds', 'demat', 'nav',
  'niftyHigh', 'niftyData', 'eurInr', 'eurInrData', 'alphaTrackerData',
  'coorgCorpus', 'coorgStartDate', 'coorgTarget', 'coorgMonthlyAmount',
  'watchdogRules', 'swpSchedule', 'taxCalendar', 'expenses', 'netWorthHistory',
  'completedActions', 'achievedMilestones', 'insurance', 'esopDetails',
]);

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isClientMetadata(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!hasOnlyKeys(value, ['clientId', 'appVersion', 'platform', 'userAgent', 'lastWriteId'])) return false;
  if (value.clientId !== undefined && typeof value.clientId !== 'string') return false;
  if (value.appVersion !== undefined && typeof value.appVersion !== 'string') return false;
  if (value.platform !== undefined && value.platform !== 'web' && value.platform !== 'mobile') return false;
  if (value.userAgent !== undefined && typeof value.userAgent !== 'string') return false;
  return value.lastWriteId === undefined || typeof value.lastWriteId === 'string';
}

/** Runtime guard for Firestore and imported envelope data. */
export function isPortfolioEnvelope(value: unknown): value is PortfolioEnvelope {
  if (!isRecord(value)) return false;
  if (value.schemaVersion !== 'fireOS_v2' && value.schemaVersion !== 'fireOS_v3' && value.schemaVersion !== 'fireOS_v4') return false;
  if (!isIsoTimestamp(value.lastSavedAt) || !isRecord(value.data)) return false;

  const data = value.data;
  if ('currentUser' in data || '_syncMetadata' in data || '_lastSavedAt' in data) return false;
  if (!hasOnlyKeys(data, [...persistedFields]) || !isPersistedPortfolioData(data)) return false;
  try {
    if (JSON.stringify(value).length > 900_000) return false;
  } catch {
    return false;
  }

  if (value.client !== undefined && !isClientMetadata(value.client)) return false;
  if (value.serverMetadata !== undefined) {
    if (!isRecord(value.serverMetadata) || !hasOnlyKeys(value.serverMetadata, ['savedBy', 'savedAt'])) return false;
    if (value.serverMetadata.savedBy !== undefined && typeof value.serverMetadata.savedBy !== 'string') return false;
    if (value.serverMetadata.savedAt !== undefined && !isIsoTimestamp(value.serverMetadata.savedAt)) return false;
  }
  if (value.migration !== undefined) {
    if (!isRecord(value.migration) || !hasOnlyKeys(value.migration, ['source', 'completedAt', 'sourceVersion'])) return false;
    if (!['localStorage', 'json'].includes(String(value.migration.source))) return false;
    if (!isIsoTimestamp(value.migration.completedAt) || typeof value.migration.sourceVersion !== 'string') return false;
  }
  if (value.format !== undefined) {
    if (!isRecord(value.format) || !hasOnlyKeys(value.format, ['normalizedArrays', 'backupVersion'])) return false;
    if (typeof value.format.normalizedArrays !== 'boolean' || typeof value.format.backupVersion !== 'string') return false;
  }
  if (value.sectionUpdatedAt !== undefined && !isRecord(value.sectionUpdatedAt)) return false;
  if (value.entryUpdatedAt !== undefined && !isRecord(value.entryUpdatedAt)) return false;

  for (const timestamp of Object.values(value.sectionUpdatedAt ?? {})) {
    if (!isIsoTimestamp(timestamp)) return false;
  }
  for (const entries of Object.values(value.entryUpdatedAt ?? {})) {
    if (!isRecord(entries)) return false;
    for (const timestamp of Object.values(entries)) {
      if (!isIsoTimestamp(timestamp)) return false;
    }
  }

  return true;
}

export type SyncStatus = 'idle' | 'pending' | 'syncing' | 'offline' | 'error' | 'conflict';

export interface SyncConflict {
  section: PortfolioSection;
  localUpdatedAt?: string;
  remoteUpdatedAt?: string;
  reason: 'missing-timestamp' | 'equal-timestamp' | 'invalid-data';
}

/** Firebase authentication result */
export interface AuthResult {
  success: boolean;
  user?: FirebaseUser;
  error?: {
    code: string;
    message: string;
  };
}
