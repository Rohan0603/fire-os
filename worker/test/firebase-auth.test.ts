import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { AuthConfigError, verifyFirebaseIdToken } from '../src/firebase-auth';

const PROJECT_ID = 'fire-os-test';
const KID = 'test-kid';

let signKey: CryptoKey;
let foreignKey: CryptoKey;
let publicJwk: Record<string, unknown>;

async function signToken(
  options: {
    issuer?: string;
    audience?: string;
    subject?: string;
    expiresIn?: number;
    key?: CryptoKey;
  } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ user_id: options.subject ?? 'user-1' })
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setIssuer(options.issuer ?? `https://securetoken.google.com/${PROJECT_ID}`)
    .setAudience(options.audience ?? PROJECT_ID)
    .setSubject(options.subject ?? 'user-1')
    .setIssuedAt(now)
    .setExpirationTime(now + (options.expiresIn ?? 3600))
    .sign(options.key ?? signKey);
}

beforeAll(async () => {
  const keyPair = await generateKeyPair('RS256', { extractable: true });
  signKey = keyPair.privateKey;
  const publicKey = keyPair.publicKey;
  publicJwk = { ...(await exportJWK(publicKey)), kid: KID, alg: 'RS256', use: 'sig' };
  const foreign = await generateKeyPair('RS256', { extractable: true });
  foreignKey = foreign.privateKey;
});

afterEach(() => vi.unstubAllGlobals());

function stubJwks(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
}

describe('verifyFirebaseIdToken', () => {
  it('accepts a token with a valid signature, issuer, audience and expiry', async () => {
    stubJwks();
    const token = await signToken();

    await expect(verifyFirebaseIdToken(token, PROJECT_ID)).resolves.toEqual({ uid: 'user-1' });
  });

  it('rejects an expired token', async () => {
    stubJwks();
    const token = await signToken({ expiresIn: -60 });

    await expect(verifyFirebaseIdToken(token, PROJECT_ID)).resolves.toBeNull();
  });

  it('rejects a token issued for another project (issuer mismatch)', async () => {
    stubJwks();
    const token = await signToken({ issuer: 'https://securetoken.google.com/other-project' });

    await expect(verifyFirebaseIdToken(token, PROJECT_ID)).resolves.toBeNull();
  });

  it('rejects a token with the wrong audience', async () => {
    stubJwks();
    const token = await signToken({ audience: 'other-project' });

    await expect(verifyFirebaseIdToken(token, PROJECT_ID)).resolves.toBeNull();
  });

  it('rejects a token signed by an untrusted key', async () => {
    stubJwks();
    const token = await signToken({ key: foreignKey });

    await expect(verifyFirebaseIdToken(token, PROJECT_ID)).resolves.toBeNull();
  });

  it('rejects a tampered token instead of merely decoding it', async () => {
    stubJwks();
    const token = await signToken();
    const tampered = `${token.slice(0, -4)}AAAA`;

    await expect(verifyFirebaseIdToken(tampered, PROJECT_ID)).resolves.toBeNull();
  });

  it.each([null, '', 'not-a-jwt'])('rejects the malformed/missing token %p', async (token) => {
    stubJwks();

    await expect(verifyFirebaseIdToken(token, PROJECT_ID)).resolves.toBeNull();
  });

  it('throws AuthConfigError when no project id is configured', async () => {
    await expect(verifyFirebaseIdToken('whatever', '')).rejects.toBeInstanceOf(AuthConfigError);
  });
});
