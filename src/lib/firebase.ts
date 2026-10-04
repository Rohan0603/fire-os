import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore, initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import type { FirebaseOptions } from 'firebase/app';

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let services: FirebaseServices | null = null;

function validateConfig(config: FirebaseOptions): void {
  const required: Array<keyof FirebaseOptions> = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Firebase configuration is missing: ${missing.join(', ')}`);
  }
}

export function getFirebaseServices(config: FirebaseOptions): FirebaseServices {
  if (services) return services;
  validateConfig(config);
  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  let db: Firestore;
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache() });
  } catch {
    db = getFirestore(app);
  }
  services = { app, auth: getAuth(app), db };
  return services;
}

export function resetFirebaseServicesForTests(): void {
  services = null;
}

/**
 * Firebase `Auth`, or null when `VITE_FIREBASE_*` is absent or partial.
 *
 * Module-scope consumers must resolve auth through this rather than calling
 * `getFirebaseServices` directly: Firebase is optional (the app supports a
 * guest-only local mode), so a throw during module evaluation would leave the
 * whole app unrendered. Warn once, then stay quiet.
 */
let authUnavailableWarned = false;

export function getOptionalAuth(config: FirebaseOptions): Auth | null {
  try {
    return getFirebaseServices(config).auth;
  } catch (error) {
    if (!authUnavailableWarned) {
      authUnavailableWarned = true;
      console.warn('Firebase is not configured; continuing in guest-only mode:', error);
    }
    return null;
  }
}
