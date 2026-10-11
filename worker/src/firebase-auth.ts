/**
 * Firebase ID token verification for the Assistant Worker.
 *
 * The token is verified, not merely decoded: signature (RS256 against Google's
 * published JWKS), issuer, audience and expiry are all checked. Only a valid
 * token signed for this Firebase project yields a UID.
 */

import { createRemoteJWKSet, jwtVerify } from 'jose';

// Google's public keys for Firebase ID tokens (project-independent).
const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

/** Thrown when the Worker has no project id to verify against (a server misconfiguration). */
export class AuthConfigError extends Error {
  constructor(message = 'FIREBASE_PROJECT_ID is not configured') {
    super(message);
    this.name = 'AuthConfigError';
  }
}

export interface VerifiedUser {
  uid: string;
}

// Created lazily and reused so Google's keys are cached across requests.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function keys(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) jwks = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));
  return jwks;
}

/**
 * Verify a Firebase ID token for `projectId`.
 *
 * @returns the verified user, or `null` for any token that is missing, malformed,
 *   expired, or signed for a different issuer/audience/project.
 * @throws {AuthConfigError} when `projectId` is empty.
 */
export async function verifyFirebaseIdToken(
  token: string | null,
  projectId: string,
): Promise<VerifiedUser | null> {
  if (!projectId) throw new AuthConfigError();
  if (!token || typeof token !== 'string') return null;
  if (token.length > 4096) return null;

  try {
    const { payload } = await jwtVerify(token, keys(), {
      algorithms: ['RS256'],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    const uid =
      typeof payload.sub === 'string' && payload.sub
        ? payload.sub
        : typeof payload.user_id === 'string'
          ? payload.user_id
          : '';
    return uid ? { uid } : null;
  } catch {
    // Any verification failure — including JWKS fetch problems — fails closed.
    return null;
  }
}
