/**
 * Firebase Authentication Functions
 * Handles login, signup, logout, password reset, and user state management
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { CONFIG } from '../../lib/config';
import { getFirebaseServices } from '../../lib/firebase';

const { auth } = getFirebaseServices(CONFIG.firebaseConfig);

/**
 * Firebase error code to user-friendly message mapping
 */
const firebaseErrorMessages: Record<string, string> = {
  'auth/user-not-found': 'Email not found. Please sign up first.',
  'auth/wrong-password': 'Invalid email or password.',
  'auth/invalid-email': 'Invalid email address.',
  'auth/email-already-in-use': 'This email is already registered.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/operation-not-allowed': 'Email/password authentication is not enabled.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/too-many-requests': 'Too many failed login attempts. Please try again later.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/popup-blocked': 'Your browser blocked the Google sign-in popup. Allow popups and try again.',
  'auth/unauthorized-domain': 'This domain is not authorized in Firebase Authentication.',
  'auth/account-exists-with-different-credential': 'An account already exists with a different sign-in method.',
};

/**
 * Convert Firebase error code to user-friendly message
 */
function getFirebaseErrorMessage(errorCode: string): string {
  return firebaseErrorMessages[errorCode] || 'An authentication error occurred. Please try again.';
}

/**
 * Sign up a new user with email and password
 * @throws Error with user-friendly message if signup fails
 */
export async function signupUser(email: string, password: string): Promise<void> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('Signup successful:', userCredential.user.uid);
  } catch (error: any) {
    const errorCode = error.code || 'unknown';
    const errorMessage = getFirebaseErrorMessage(errorCode);
    throw new Error(errorMessage);
  }
}

/**
 * Log in an existing user with email and password
 * @throws Error with user-friendly message if login fails
 */
export async function loginUser(email: string, password: string): Promise<void> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('Login successful:', userCredential.user.uid);
  } catch (error: any) {
    const errorCode = error.code || 'unknown';
    const errorMessage = getFirebaseErrorMessage(errorCode);
    throw new Error(errorMessage);
  }
}

/** Sign in or sign up with the configured Google provider. */
export async function loginWithGoogle(): Promise<void> {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error: any) {
    throw new Error(getFirebaseErrorMessage(error.code || 'unknown'));
  }
}

/**
 * Send a password reset email to the user
 * @throws Error with user-friendly message if fails
 */
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
    console.log('Password reset email sent to:', email);
  } catch (error: any) {
    const errorCode = error.code || 'unknown';
    if (errorCode === 'auth/user-not-found') {
      throw new Error('No account found with this email address.');
    }
    throw new Error('Failed to send password reset email. Please try again.');
  }
}

