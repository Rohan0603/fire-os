import {
  collection,
  doc,
  DocumentData,
  Firestore,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  Unsubscribe,
  writeBatch,
} from 'firebase/firestore';
import type { FirebaseOptions } from 'firebase/app';
import { isPortfolioEnvelope } from '../../types/firebase';
import type { PortfolioEnvelope } from '../../types/firebase';
import { getFirebaseServices } from '../../lib/firebase';
import type { SIPFund } from '../../types/portfolio';

export const PORTFOLIO_COLLECTION = 'portfolio';
export const PORTFOLIO_DOCUMENT = 'state';

export type FirestoreServices = ReturnType<typeof getFirebaseServices>;

let services: FirestoreServices | null = null;
function portfolioRef(db: Firestore, uid: string) {
  return doc(db, 'users', uid, PORTFOLIO_COLLECTION, PORTFOLIO_DOCUMENT);
}

function holdingsRef(db: Firestore, uid: string) {
  return collection(db, 'users', uid, PORTFOLIO_COLLECTION, PORTFOLIO_DOCUMENT, 'holdings');
}

type StoredMfEntry = {
  kind: 'mf';
  value: SIPFund;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStoredMfEntry(value: unknown): value is StoredMfEntry {
  if (!isRecord(value) || value.kind !== 'mf' || typeof value.updatedAt !== 'string' || !isRecord(value.value)) return false;
  const entry = value.value;
  return typeof entry.name === 'string'
    && (entry.schemeCode === undefined || typeof entry.schemeCode === 'string')
    && typeof entry.units === 'number'
    && typeof entry.startDate === 'string'
    && typeof entry.monthlyAmount === 'number'
    && (entry.costBasis === undefined || typeof entry.costBasis === 'number');
}

async function readMfEntries(db: Firestore, uid: string): Promise<{ mf: Record<string, SIPFund>; timestamps: Record<string, string> }> {
  const mf: Record<string, SIPFund> = {};
  const timestamps: Record<string, string> = {};
  const snapshot = await getDocs(holdingsRef(db, uid));
  for (const holding of snapshot.docs) {
    const value = holding.data();
    if (!isStoredMfEntry(value)) throw new Error(`Firestore holding document ${holding.id} has an invalid entry`);
    mf[holding.id] = value.value;
    timestamps[holding.id] = value.updatedAt;
  }
  return { mf, timestamps };
}

function attachMfEntries(
  envelope: PortfolioEnvelope,
  entries: { mf: Record<string, SIPFund>; timestamps: Record<string, string> },
): PortfolioEnvelope {
  if ('mf' in envelope.data) return envelope;
  const entryUpdatedAt = Object.keys(entries.timestamps).length > 0
    ? { ...envelope.entryUpdatedAt, holdings: entries.timestamps }
    : envelope.entryUpdatedAt;
  return {
    ...envelope,
    data: { ...envelope.data, mf: entries.mf },
    ...(entryUpdatedAt ? { entryUpdatedAt } : {}),
  };
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
  return attachMfEntries(data, await readMfEntries(initializedServices.db, uid));
}

export async function savePortfolio(uid: string, envelope: PortfolioEnvelope): Promise<void> {
  if (!services) throw new Error('Firestore has not been initialized');
  const initializedServices = services;
  const { data, entryUpdatedAt, ...envelopeWithoutDynamicMetadata } = envelope;
  const { mf, ...stateData } = data;
  const { holdings, ...stateEntryUpdatedAt } = entryUpdatedAt ?? {};
  const batch = writeBatch(initializedServices.db);
  batch.set(portfolioRef(initializedServices.db, uid), {
    ...envelopeWithoutDynamicMetadata,
    schemaVersion: 'fireOS_v4',
    data: stateData,
    ...(Object.keys(stateEntryUpdatedAt).length > 0 ? { entryUpdatedAt: stateEntryUpdatedAt } : {}),
  });

  const existingHoldings = await getDocs(holdingsRef(initializedServices.db, uid));
  const currentEntries = mf ?? {};
  for (const holding of existingHoldings.docs) {
    if (!(holding.id in currentEntries)) batch.delete(holding.ref);
  }
  for (const [id, value] of Object.entries(currentEntries)) {
    batch.set(doc(holdingsRef(initializedServices.db, uid), id), {
      kind: 'mf',
      value,
      updatedAt: holdings?.[id] ?? envelope.lastSavedAt,
    });
  }
  await batch.commit();
}

export function onPortfolioChange(
  uid: string,
  callback: (envelope: PortfolioEnvelope) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!services) throw new Error('Firestore has not been initialized');
  const initializedServices = services;
  let stateEnvelope: PortfolioEnvelope | null = null;
  let entries: { mf: Record<string, SIPFund>; timestamps: Record<string, string> } = { mf: {}, timestamps: {} };
  const emit = (): void => {
    if (stateEnvelope) callback(attachMfEntries(stateEnvelope, entries));
  };
  const stateUnsubscribe = onSnapshot(
    portfolioRef(initializedServices.db, uid),
    (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      if (isPortfolioEnvelope(data)) {
        stateEnvelope = data;
        emit();
      } else onError?.(new Error('Firestore snapshot has an invalid portfolio envelope'));
    },
    (error) => onError?.(error),
  );
  const holdingsUnsubscribe = onSnapshot(
    holdingsRef(initializedServices.db, uid),
    (snapshot) => {
      try {
        const mf: Record<string, SIPFund> = {};
        const timestamps: Record<string, string> = {};
        for (const holding of snapshot.docs) {
          const value = holding.data();
          if (!isStoredMfEntry(value)) throw new Error(`Firestore holding document ${holding.id} has an invalid entry`);
          mf[holding.id] = value.value;
          timestamps[holding.id] = value.updatedAt;
        }
        entries = { mf, timestamps };
        emit();
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Firestore holding snapshot is invalid'));
      }
    },
    (error) => onError?.(error),
  );
  return () => {
    stateUnsubscribe();
    holdingsUnsubscribe();
  };
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