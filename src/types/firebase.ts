/**
 * Firebase authentication and data sync type definitions
 * Covers user accounts, backups, and synchronization metadata
 */

/** Firebase authenticated user */
export interface FirebaseUser {
  uid: string;
  email: string;
  createdAt: string; // ISO timestamp
}

/** Sync metadata for portfolio state */
export interface SyncMetadata {
  lastSavedAt: string; // ISO timestamp of last save to Firebase
  lastSyncedAt?: string; // ISO timestamp of last sync from Firebase
  isDirty: boolean; // Whether local state differs from server
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
  holdings?: {
    mf?: Record<string, any>;
    fd?: Record<string, any>;
    epf?: Record<string, any>;
    sip?: Record<string, any>;
    esop?: Record<string, any>;
    demat?: Record<string, any>;
  };
  navCache?: Record<string, any>;
  niftyData?: {
    level: number;
    high52w: number;
    timestamp: string;
  };
  eurInr?: {
    rate: number;
    timestamp: string;
  };
  alphaTrackerData?: Record<string, any>;
  watchdogData?: Record<string, any>;
}

/** Firebase Realtime Database user portfolio entry */
export interface FirebasePortfolioEntry {
  uid: string;
  portfolio: any; // Complete state object (D)
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
