import {
  doc,
  DocumentData,
  Firestore,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
  Unsubscribe,
  writeBatch,
} from 'firebase/firestore';
import type { FirebaseOptions } from 'firebase/app';
import { isPortfolioEnvelope } from '../../types/firebase';
import type { PortfolioEnvelope } from '../../types/firebase';
import { getFirebaseServices } from '../../lib/firebase';

export const PORTFOLIO_COLLECTION = 'portfolio';
export const PORTFOLIO_DOCUMENT = 'state';

export type FirestoreServices = ReturnType<typeof getFirebaseServices>;

let services: FirestoreServices | null = null;
function portfolioRef(db: Firestore, uid: string) {
  return doc(db, 'users', uid, PORTFOLIO_COLLECTION, PORTFOLIO_DOCUMENT);
}

export async function initFirestore(config: FirebaseOptions): Promise<FirestoreServices> {
  if (!services) {
    services = getFirebaseServices(config);
  }

  if (!services) throw new Error('Firestore services failed to initialize');
  const initializedServices = services;

  return initializedServices;
}

export async function loadPortfolio(uid: string): Promise<PortfolioEnvelope | null> {
  if (!services) throw new Error('Firestore has not been initialized');
  const initializedServices = services;
  const snapshot = await getDoc(portfolioRef(initializedServices.db, uid));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  if (!isPortfolioEnvelope(data)) {
    throw new Error('Firestore portfolio document has an invalid envelope');
  }
  return data;
}

export async function savePortfolio(uid: string, envelope: PortfolioEnvelope): Promise<void> {
  if (!services) throw new Error('Firestore has not been initialized');
  const initializedServices = services;
  await setDoc(portfolioRef(initializedServices.db, uid), envelope);
}

export function onPortfolioChange(
  uid: string,
  callback: (envelope: PortfolioEnvelope) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!services) throw new Error('Firestore has not been initialized');
  const initializedServices = services;
  return onSnapshot(
    portfolioRef(initializedServices.db, uid),
    (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      if (isPortfolioEnvelope(data)) callback(data);
      else onError?.(new Error('Firestore snapshot has an invalid portfolio envelope'));
    },
    (error) => onError?.(error),
  );
}

export async function runPortfolioTransaction<T>(
  uid: string,
  operation: (data: DocumentData | undefined) => T,
): Promise<T> {
  if (!services) throw new Error('Firestore has not been initialized');
  const initializedServices = services;
  return runTransaction(initializedServices.db, async (transaction) => {
    const snapshot = await transaction.get(portfolioRef(initializedServices.db, uid));
    return operation(snapshot.exists() ? snapshot.data() : undefined);
  });
}

export async function commitBatch(
  uid: string,
  updates: Record<string, unknown>,
): Promise<void> {
  if (!services) throw new Error('Firestore has not been initialized');
  const initializedServices = services;
  const batch = writeBatch(initializedServices.db);
  batch.set(portfolioRef(initializedServices.db, uid), updates, { merge: true });
  await batch.commit();
}