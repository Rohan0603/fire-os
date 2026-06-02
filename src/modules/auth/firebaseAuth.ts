/**
 * Firebase Authentication Functions
 * Handles login, signup, logout, password reset, and user state management
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../../main';

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

/**
 * Log out the current user
 * @throws Error if logout fails
 */
export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
    console.log('Logout successful');
  } catch (error: any) {
    console.error('Logout error:', error);
    throw new Error('Failed to logout. Please try again.');
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

/**
 * Get the currently authenticated user
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Check if user is authenticated
 */
export function isUserAuthenticated(): boolean {
  return getCurrentUser() !== null;
}
