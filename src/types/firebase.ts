/**
 * Firebase authentication and data sync type definitions
 * Covers user accounts, backups, and synchronization metadata
 */

import type {
  Holdings,
  SIPFund,
  Holding,
  DematHoldings,
  AlphaTrackerData,
} from './portfolio';
import type { NAVCacheMap, NiftyData, EURINRData } from './api';
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

/** Holdings structure for backup, supporting both SIPFund and Holding types */
export interface BackupHoldings {
  mf?: Record<string, SIPFund>;
  fd?: Holdings;
  epf?: Holdings;
  sip?: Record<string, SIPFund>;
  esop?: Holdings;
  demat?: DematHoldings;
}

/** FIRE OS backup file envelope (v2 format) */
export interface FireOSBackup {
  version: string; // "fireOS_v2" or legacy "fireOS_v1"
  timestamp: string; // ISO timestamp when exported
  profile?: {
    name: string;
    age: number;
    annualExpenses: number;
    fiTarget: number;
  };
  holdings?: BackupHoldings;
  navCache?: NAVCacheMap;
  niftyData?: NiftyData;
  eurInr?: EURINRData;
  alphaTrackerData?: Record<string, AlphaTrackerData>;
  watchdogData?: Record<string, AlphaTrackerData>;
}

/** Firebase Realtime Database user portfolio entry */
export interface FirebasePortfolioEntry {
  uid: string;
  portfolio: FireOSState; // Complete state object (D)
  lastModified: string; // ISO timestamp
  syncVersion: number; // Version number for conflict resolution
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
