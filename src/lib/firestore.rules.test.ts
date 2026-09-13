import { afterAll, beforeAll, describe, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';

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

  it('denies another user access to the portfolio', async () => {
    const ownerDb = testEnvironment.authenticatedContext('owner-2').firestore();
    await assertSucceeds(setDoc(doc(ownerDb, 'users/owner-2/portfolio/state'), validEnvelope));

    const otherDb = testEnvironment.authenticatedContext('other-user').firestore();
    await assertFails(getDoc(doc(otherDb, 'users/owner-2/portfolio/state')));
  });

  it('denies envelopes with unknown persisted fields', async () => {
    const db = testEnvironment.authenticatedContext('owner-3').firestore();
    await assertFails(setDoc(doc(db, 'users/owner-3/portfolio/state'), {
      ...validEnvelope,
      data: { privateServerField: true },
    }));
  });
});