import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendPasswordResetEmail } = vi.hoisted(() => ({
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock('firebase/auth', () => ({ sendPasswordResetEmail }));
vi.mock('../../lib/firebase', () => ({
  getFirebaseServices: vi.fn(() => ({ auth: {} })),
}));

import { sendPasswordReset } from './firebaseAuth';

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
