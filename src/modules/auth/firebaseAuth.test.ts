import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendPasswordResetEmail, signInWithPopup } = vi.hoisted(() => ({
  sendPasswordResetEmail: vi.fn(),
  signInWithPopup: vi.fn(),
}));

vi.mock('firebase/auth', () => ({ sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider: class {} }));
vi.mock('../../lib/firebase', () => ({
  getOptionalAuth: vi.fn(() => ({})),
}));

import { getOptionalAuth } from '../../lib/firebase';
import { loginWithGoogle, sendPasswordReset } from './firebaseAuth';

describe('unconfigured deployment messaging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore the configured-deployment default so the mock does not leak.
    vi.mocked(getOptionalAuth).mockReturnValue({} as never);
  });

  it('explains that sign-in is unavailable rather than reporting a generic auth error', async () => {
    const { getOptionalAuth } = await import('../../lib/firebase');
    vi.mocked(getOptionalAuth).mockReturnValue(null as never);

    // The unconfigured code must survive the message map, otherwise it falls through
    // to "An authentication error occurred. Please try again." and tells the user to
    // retry something that can never succeed.
    await expect(loginWithGoogle()).rejects.toThrow(
      /no Firebase configuration|Firebase is not configured/i,
    );
    await expect(loginWithGoogle()).rejects.not.toThrow(/An authentication error occurred/);
  });
});

describe('password reset privacy contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendPasswordResetEmail.mockResolvedValue(undefined);
  });

  it('resolves for an existing account request', async () => {
    await expect(sendPasswordReset('known@example.com')).resolves.toBeUndefined();
    expect(sendPasswordResetEmail).toHaveBeenCalledWith({}, 'known@example.com');
  });

  it('resolves for a missing account without disclosing existence', async () => {
    sendPasswordResetEmail.mockRejectedValueOnce({ code: 'auth/user-not-found' });

    await expect(sendPasswordReset('missing@example.com')).resolves.toBeUndefined();
  });

  it('uses one generic failure for other provider errors', async () => {
    sendPasswordResetEmail.mockRejectedValueOnce({ code: 'auth/too-many-requests' });

    await expect(sendPasswordReset('user@example.com')).rejects.toThrow(
      'Failed to send password reset email. Please try again.',
    );
  });
});
