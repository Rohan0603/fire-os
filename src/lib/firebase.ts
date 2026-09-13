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
