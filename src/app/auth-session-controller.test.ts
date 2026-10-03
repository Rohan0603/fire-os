import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeState } from '../types/state';
import { createFeatureContext } from '../core/feature-context';
import type { AuthSession } from '../lib/authCoordinator';
import type { PortfolioSession } from './portfolio-session';
import {
  AuthSessionController,
  type AuthCoordinatorPort,
  type AuthSessionControllerDependencies,
} from './auth-session-controller';

function createDependencies(overrides: Partial<AuthSessionControllerDependencies> = {}) {
  let listener: ((session: AuthSession) => void) | undefined;
  const coordinator: AuthCoordinatorPort = {
    start: vi.fn((callback) => { listener = callback; }),
    isCurrent: vi.fn(() => true),
    getCurrentUser: vi.fn(() => null),
    signOut: vi.fn(async () => undefined),
  };
  const state = initializeState();
  const context = createFeatureContext(state, { load: () => null, save: vi.fn() });
  const portfolioSession = {
    teardown: vi.fn(async () => undefined),
    setEnvelope: vi.fn(),
    setSyncCoordinator: vi.fn(),
    setPortfolioUnsubscribe: vi.fn(),
    setNiftyMonitorCleanup: vi.fn(),
  } as unknown as PortfolioSession;
  const dependencies: AuthSessionControllerDependencies = {
    authCoordinator: coordinator,
    portfolioSession,
    state,
    context,
    firebaseConfig: {},
    loadData: vi.fn(() => null),
    configureStorageScope: vi.fn(),
    initFirestore: vi.fn(async () => undefined),
    loadPortfolio: vi.fn(async () => null),
    onPortfolioChange: vi.fn(() => vi.fn()),
    savePortfolio: vi.fn(async () => undefined),
    hideAuthScreen: vi.fn(),
    showAuthScreen: vi.fn(),
    renderProfile: vi.fn(),
    fetchSIPNAVs: vi.fn(async () => undefined),
    checkDailyTasks: vi.fn(),
    monitorNiftyLevel: vi.fn(() => vi.fn()),
    updateCrashAlert: vi.fn(),
    ...overrides,
  };
  return {
    controller: new AuthSessionController(dependencies),
    dependencies,
    notify: (session: AuthSession) => listener?.(session),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('AuthSessionController', () => {
  it('starts an isolated guest session when Firebase reports no user', async () => {
    const logoutButton = { textContent: '', style: {} };
    const profile = {};
    vi.stubGlobal('document', {
      getElementById: (id: string) => id === 'logout-btn' ? logoutButton : id === 'profile' ? profile : null,
    });
    const cachedState = initializeState();
    cachedState.profile.name = 'Guest';
    const { controller, dependencies, notify } = createDependencies({
      loadData: vi.fn(() => cachedState),
    });

    controller.start();
    notify({ generation: 1, user: null });
    await vi.waitFor(() => expect(controller.isGuestSessionActive).toBe(true));

    expect(dependencies.configureStorageScope).toHaveBeenCalledWith(null);
    expect(dependencies.hideAuthScreen).toHaveBeenCalledOnce();
    expect(dependencies.renderProfile).toHaveBeenCalledWith(profile, dependencies.context);
    expect(logoutButton.textContent).toBe('Sign in');
  });

  it('does not load a user portfolio when the auth callback became stale during teardown', async () => {
    const user = { uid: 'user-1' } as AuthSession['user'];
    const { controller, dependencies, notify } = createDependencies();
    vi.mocked(dependencies.authCoordinator.isCurrent).mockReturnValue(false);

    controller.start();
    notify({ generation: 1, user });
    await vi.waitFor(() => expect(dependencies.portfolioSession.teardown).toHaveBeenCalledOnce());

    expect(dependencies.configureStorageScope).not.toHaveBeenCalled();
    expect(dependencies.initFirestore).not.toHaveBeenCalled();
  });

  it('turns guest logout into a sign-in request and clears the guest session', async () => {
    const logoutButton = { style: { display: '' } };
    vi.stubGlobal('document', {
      getElementById: (id: string) => id === 'logout-btn' ? logoutButton : null,
    });
    const { controller, dependencies, notify } = createDependencies();
    controller.start();
    notify({ generation: 1, user: null });
    await vi.waitFor(() => expect(controller.isGuestSessionActive).toBe(true));

    await controller.requestSignIn();

    expect(controller.isGuestSessionActive).toBe(false);
    expect(dependencies.showAuthScreen).toHaveBeenCalledOnce();
    expect(dependencies.authCoordinator.signOut).not.toHaveBeenCalled();
    expect(logoutButton.style.display).toBe('none');
  });
});
