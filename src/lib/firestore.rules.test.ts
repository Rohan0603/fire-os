import { afterAll, beforeAll, describe, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { buildEnvelopeFromState } from './merge';
import { initializeState } from '../types/state';

const projectId = 'fire-os-rules-test';
const validEnvelope = {
  schemaVersion: 'fireOS_v3',
  lastSavedAt: '2026-01-01T00:00:00.000Z',
  data: {},
};

let testEnvironment: RulesTestEnvironment;

beforeAll(async () => {
  testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: Number(process.env.FIRESTORE_EMULATOR_PORT ?? 8082),
    },
  });
});

afterAll(async () => {
  await testEnvironment?.cleanup();
});

describe('portfolio Firestore rules', () => {
  it('allows an owner to create a valid envelope', async () => {
    const db = testEnvironment.authenticatedContext('owner-1').firestore();
    await assertSucceeds(setDoc(doc(db, 'users/owner-1/portfolio/state'), validEnvelope));
  });

  it('allows the production default portfolio envelope', async () => {
    const db = testEnvironment.authenticatedContext('owner-default-state').firestore();
    const envelope = buildEnvelopeFromState(
      initializeState(),
      { clientId: 'browser', appVersion: '2.2.0', platform: 'web' },
      '2026-01-01T00:00:00.000Z',
    );
    const { mf: _mf, ...stateData } = envelope.data;
    const { entryUpdatedAt: _entryUpdatedAt, ...envelopeWithoutDynamicMetadata } = envelope;
    void _mf;
    void _entryUpdatedAt;
    await assertSucceeds(setDoc(doc(db, 'users/owner-default-state/portfolio/state'), {
      ...envelopeWithoutDynamicMetadata,
      schemaVersion: 'fireOS_v4',
      data: stateData,
    }));
  });

  it('denies another user access to the portfolio', async () => {
    const ownerDb = testEnvironment.authenticatedContext('owner-2').firestore();
    await assertSucceeds(setDoc(doc(ownerDb, 'users/owner-2/portfolio/state'), validEnvelope));

    const otherDb = testEnvironment.authenticatedContext('other-user').firestore();
    await assertFails(getDoc(doc(otherDb, 'users/owner-2/portfolio/state')));
  });

  it('denies unauthenticated state access and owner state deletion', async () => {
    const ownerDb = testEnvironment.authenticatedContext('owner-authz').firestore();
    const stateRef = doc(ownerDb, 'users/owner-authz/portfolio/state');
    await assertSucceeds(setDoc(stateRef, validEnvelope));

    const unauthenticatedDb = testEnvironment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthenticatedDb, 'users/owner-authz/portfolio/state')));
    await assertFails(setDoc(doc(unauthenticatedDb, 'users/owner-authz/portfolio/state'), validEnvelope));
    await assertFails(deleteDoc(stateRef));
  });

  it('enforces owner-only holding CRUD and allows valid owner updates', async () => {
    const ownerDb = testEnvironment.authenticatedContext('holding-owner').firestore();
    const stateRef = doc(ownerDb, 'users/holding-owner/portfolio/state');
    const holdingRef = doc(ownerDb, 'users/holding-owner/portfolio/state/holdings/fund-1');
    const holding = {
      kind: 'mf',
      value: {
        name: 'Example Fund',
        schemeCode: '12345',
        units: 10,
        startDate: '2026-01',
        monthlyAmount: 1000,
        costBasis: 9000,
      },
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    await assertSucceeds(setDoc(stateRef, { ...validEnvelope, schemaVersion: 'fireOS_v4' }));
    await assertSucceeds(setDoc(holdingRef, holding));
    await assertSucceeds(updateDoc(holdingRef, { updatedAt: '2026-01-02T00:00:00.000Z' }));

    const otherDb = testEnvironment.authenticatedContext('holding-other').firestore();
    await assertFails(getDoc(doc(otherDb, 'users/holding-owner/portfolio/state/holdings/fund-1')));
    await assertFails(updateDoc(doc(otherDb, 'users/holding-owner/portfolio/state/holdings/fund-1'), {
      updatedAt: '2026-01-03T00:00:00.000Z',
    }));
    await assertFails(deleteDoc(doc(otherDb, 'users/holding-owner/portfolio/state/holdings/fund-1')));

    const unauthenticatedDb = testEnvironment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthenticatedDb, 'users/holding-owner/portfolio/state/holdings/fund-1')));
    await assertFails(deleteDoc(doc(unauthenticatedDb, 'users/holding-owner/portfolio/state/holdings/fund-1')));
    await assertSucceeds(deleteDoc(holdingRef));
  });

  it('denies envelopes with unknown persisted fields', async () => {
    const db = testEnvironment.authenticatedContext('owner-3').firestore();
    await assertFails(setDoc(doc(db, 'users/owner-3/portfolio/state'), {
      ...validEnvelope,
      data: { privateServerField: true },
    }));
  });

  it('denies malformed nested persisted values on create', async () => {
    const db = testEnvironment.authenticatedContext('owner-4').firestore();
    await assertFails(setDoc(doc(db, 'users/owner-4/portfolio/state'), {
      ...validEnvelope,
      data: { profile: 'not-a-profile' },
    }));
  });

  it('denies inline dynamic map values and malformed timestamp maps', async () => {
    const db = testEnvironment.authenticatedContext('owner-dynamic').firestore();
    await assertFails(setDoc(doc(db, 'users/owner-dynamic/portfolio/state'), {
      ...validEnvelope,
      data: { mf: { badEntry: 'not-a-holding' } },
    }));
    await assertFails(setDoc(doc(db, 'users/owner-dynamic/portfolio/state'), {
      ...validEnvelope,
      entryUpdatedAt: { holdings: 'not-a-map' },
    }));
  });

  it('allows valid entry timestamps from an existing portfolio envelope', async () => {
    const db = testEnvironment.authenticatedContext('owner-entry-timestamps').firestore();
    await assertSucceeds(setDoc(doc(db, 'users/owner-entry-timestamps/portfolio/state'), {
      ...validEnvelope,
      entryUpdatedAt: { holdings: { 'fund-1': '2026-01-01T00:00:00.000Z' } },
    }));
  });

  it('allows valid dynamic entries as individually validated documents', async () => {
    const db = testEnvironment.authenticatedContext('owner-valid-dynamic').firestore();
    const stateRef = doc(db, 'users/owner-valid-dynamic/portfolio/state');
    const holdingRef = doc(db, 'users/owner-valid-dynamic/portfolio/state/holdings/fund-1');
    await assertSucceeds(setDoc(stateRef, { ...validEnvelope, schemaVersion: 'fireOS_v4' }));
    await assertSucceeds(setDoc(holdingRef, {
      kind: 'mf',
      value: {
        name: 'Example Fund',
        schemeCode: '12345',
        units: 10,
        startDate: '2026-01',
        monthlyAmount: 1000,
        costBasis: 9000,
      },
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
    await assertFails(setDoc(doc(db, 'users/owner-valid-dynamic/portfolio/state/holdings/fund-2'), {
      kind: 'mf',
      value: 'not-a-holding',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }));
  });

  it('denies runtime-only fields inside persisted data', async () => {
    const db = testEnvironment.authenticatedContext('owner-5').firestore();
    await assertFails(setDoc(doc(db, 'users/owner-5/portfolio/state'), {
      ...validEnvelope,
      data: { _lastSavedAt: '2026-01-01T00:00:00.000Z' },
    }));
  });

  it('denies oversized metadata and unknown timestamp maps', async () => {
    const db = testEnvironment.authenticatedContext('owner-6').firestore();
    await assertFails(setDoc(doc(db, 'users/owner-6/portfolio/state'), {
      ...validEnvelope,
      client: { userAgent: 'x'.repeat(513) },
    }));
    await assertFails(setDoc(doc(db, 'users/owner-6/portfolio/state'), {
      ...validEnvelope,
      entryUpdatedAt: { unexpected: {} },
    }));
    await assertFails(setDoc(doc(db, 'users/owner-6/portfolio/state'), {
      ...validEnvelope,
      serverMetadata: { unexpected: true },
    }));
  });

  it('denies oversized persisted arrays', async () => {
    const db = testEnvironment.authenticatedContext('owner-7').firestore();
    await assertFails(setDoc(doc(db, 'users/owner-7/portfolio/state'), {
      ...validEnvelope,
      data: { achievedMilestones: Array.from({ length: 501 }, (_, index) => `milestone-${index}`) },
    }));
  });

  it('allows valid other holdings and denies an oversized collection', async () => {
    const db = testEnvironment.authenticatedContext('owner-other-holdings').firestore();
    await assertSucceeds(setDoc(doc(db, 'users/owner-other-holdings/portfolio/state'), {
      ...validEnvelope,
      data: {
        otherHoldings: {
          gold: { name: 'Gold', amount: 100000, annualReturn: 8 },
        },
      },
    }));

    const oversized = Object.fromEntries(
      Array.from({ length: 201 }, (_, index) => [
        `holding-${index}`,
        { name: `Holding ${index}`, amount: 1000, annualReturn: 5 },
      ]),
    );
    await assertFails(setDoc(doc(db, 'users/owner-other-holdings/portfolio/state'), {
      ...validEnvelope,
      data: { otherHoldings: oversized },
    }));
  });

  it('revalidates nested values on update', async () => {
    const db = testEnvironment.authenticatedContext('owner-8').firestore();
    const stateRef = doc(db, 'users/owner-8/portfolio/state');
    await assertSucceeds(setDoc(stateRef, validEnvelope));
    await assertFails(updateDoc(stateRef, {
      data: { insurance: 'not-insurance' },
    }));
  });
});