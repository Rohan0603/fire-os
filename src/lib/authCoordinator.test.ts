import { beforeEach, describe, expect, it, vi } from 'vitest';

const { onAuthStateChanged, signOut } = vi.hoisted(() => ({
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged,
  signOut,
}));

import { AuthCoordinator } from './authCoordinator';

describe('AuthCoordinator', () => {
  const auth = { currentUser: null as unknown };
  let unsubscribe: ReturnType<typeof vi.fn>;
  let authListener: ((user: unknown) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    unsubscribe = vi.fn();
    onAuthStateChanged.mockImplementation((_auth, listener) => {
      authListener = listener;
      return unsubscribe;
    });
    signOut.mockResolvedValue(undefined);
    auth.currentUser = null;
  });

  it('invalidates the previous session when logout starts', async () => {
    const coordinator = new AuthCoordinator(auth as never);
    const listener = vi.fn();
    coordinator.start(listener);

    const user = { uid: 'user-1' };
    auth.currentUser = user;
    authListener?.(user);
    const session = listener.mock.lastCall?.[0];
    expect(coordinator.isCurrent(session)).toBe(true);

    await coordinator.signOut();

    expect(signOut).toHaveBeenCalledWith(auth);
    expect(coordinator.isCurrent(session)).toBe(false);
  });

  it('cleans up an existing subscription before restarting', () => {
    const coordinator = new AuthCoordinator(auth as never);

    coordinator.start(vi.fn());
    coordinator.start(vi.fn());

    expect(unsubscribe).toHaveBeenCalledOnce();
    coordinator.stop();
    expect(unsubscribe).toHaveBeenCalledTimes(2);
  });
});