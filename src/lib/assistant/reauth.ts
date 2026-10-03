/**
 * Re-authentication helpers for destructive / high-value assistant changes.
 * Guests (no account) are gated by a typed-CONFIRM modal instead.
 */

import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from 'firebase/auth';
import { CONFIG } from '../config';
import { getFirebaseServices } from '../firebase';

const { auth } = getFirebaseServices(CONFIG.firebaseConfig);

export type ReauthResult = { ok: true } | { ok: false; reason: string };

/** Current sign-in method, or null when signed out / guest. */
export function currentSignInProvider(): 'google.com' | 'password' | null {
  const user = auth.currentUser;
  if (!user) return null;
  const providerId = user.providerData[0]?.providerId;
  if (providerId === 'google.com') return 'google.com';
  if (providerId === 'password') return 'password';
  return null;
}

/** Re-authenticate a Google user via popup. */
export async function reauthenticateGoogle(): Promise<ReauthResult> {
  const user = auth.currentUser;
  if (!user) return { ok: false, reason: 'No signed-in account.' };
  try {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
    return { ok: true };
  } catch (err) {
    const code = (err as { code?: string })?.code ?? '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return { ok: false, reason: 'Re-authentication was cancelled.' };
    }
    return { ok: false, reason: 'Re-authentication failed. Please try again.' };
  }
}

/** Re-authenticate an email/password user with their password. */
export async function reauthenticatePassword(password: string): Promise<ReauthResult> {
  const user = auth.currentUser;
  if (!user?.email) return { ok: false, reason: 'No signed-in account with an email.' };
  try {
    await reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(user.email, password)
    );
    return { ok: true };
  } catch {
    return { ok: false, reason: 'Incorrect password.' };
  }
}
