import type { FirebaseOptions } from 'firebase/app';
import type { User } from 'firebase/auth';
import type { FeatureContext } from '../core/feature-context';
import type { AuthSession } from '../lib/authCoordinator';
import type { PortfolioSession } from './portfolio-session';
import type { PortfolioEnvelope } from '../types/firebase';
import type { FireOSState } from '../types/state';
import { applyPersistedState } from '../types/state';
import { applyEnvelopeToState, buildEnvelopeFromState, mergeEnvelopes } from '../lib/merge';
import { persistPortfolioState } from '../lib/storage';
import { syncStatusStore } from '../core/stores';
import { SyncCoordinator } from '../lib/syncCoordinator';
import type { CrashAlert } from '../modules/api/nifty-monitor';

export interface AuthCoordinatorPort {
  start(listener: (session: AuthSession) => void): void;
  isCurrent(session: AuthSession): boolean;
  getCurrentUser(): User | null;
  signOut(): Promise<void>;
}

export interface AuthSessionControllerDependencies {
  authCoordinator: AuthCoordinatorPort;
  portfolioSession: PortfolioSession;
  state: FireOSState;
  context: FeatureContext;
  firebaseConfig: FirebaseOptions;
  loadData: () => FireOSState | null;
  configureStorageScope: (uid: string | null) => void;
  initFirestore: (config: FirebaseOptions) => Promise<unknown>;
  loadPortfolio: (uid: string) => Promise<PortfolioEnvelope | null>;
  onPortfolioChange: (
    uid: string,
    callback: (envelope: PortfolioEnvelope) => void,
    onError?: (error: Error) => void,
  ) => () => void;
  savePortfolio: (uid: string, envelope: PortfolioEnvelope) => Promise<void>;
  hideAuthScreen: () => void;
  showAuthScreen: () => void;
  renderProfile: (container: HTMLElement, context: FeatureContext) => void;
  fetchSIPNAVs: () => Promise<void>;
  checkDailyTasks: (state: FireOSState) => void;
  monitorNiftyLevel: (callback: (alert: CrashAlert | null) => void) => () => void;
  updateCrashAlert: (alert: CrashAlert | null) => void;
}

export class AuthSessionController {
  private guestSessionActive = false;
  private authPromptRequested = false;

  constructor(private readonly dependencies: AuthSessionControllerDependencies) {}

  get isGuestSessionActive(): boolean {
    return this.guestSessionActive;
  }

  start(): void {
    this.dependencies.authCoordinator.start((session) => {
      void this.handleAuthSession(session);
    });
  }

  /**
   * Apply the current session state to `#logout-btn`.
   *
   * The control itself is rendered by React (`src/app/components/auth-button.tsx`)
   * and mounts *after* the first session resolves, so the label and visibility are
   * re-applied once React has rendered it. Called from `bootstrapApp()` after mount.
   */
  syncAuthControl(): void {
    const control = document.getElementById('logout-btn');
    if (!control) return;
    if (this.authPromptRequested) {
      control.style.display = 'none';
      return;
    }
    control.textContent = this.guestSessionActive ? 'Sign in' : 'Logout';
    control.style.display = 'block';
  }

  async requestSignIn(): Promise<void> {
    if (!this.guestSessionActive) return;
    this.guestSessionActive = false;
    this.authPromptRequested = true;
    await this.dependencies.portfolioSession.teardown();
    this.dependencies.showAuthScreen();
    const logoutButton = document.getElementById('logout-btn');
    if (logoutButton) logoutButton.style.display = 'none';
  }

  async signOut(): Promise<void> {
    await this.dependencies.portfolioSession.teardown();
    await this.dependencies.authCoordinator.signOut();
  }

  private async startGuestSession(): Promise<void> {
    if (this.dependencies.authCoordinator.getCurrentUser() || this.guestSessionActive) return;

    this.authPromptRequested = false;
    await this.dependencies.portfolioSession.teardown();
    this.dependencies.configureStorageScope(null);
    const cachedState = this.dependencies.loadData();
    if (cachedState) applyPersistedState(this.dependencies.state, cachedState);
    this.dependencies.state.currentUser = null;
    this.guestSessionActive = true;

    this.dependencies.hideAuthScreen();
    const logoutButton = document.getElementById('logout-btn');
    if (logoutButton) {
      logoutButton.textContent = 'Sign in';
      logoutButton.style.display = 'block';
    }

    const saveCloudButton = document.getElementById('save-cloud-btn') as HTMLButtonElement | null;
    if (saveCloudButton) {
      saveCloudButton.disabled = true;
      saveCloudButton.classList.add('btn-disabled');
    }

    const profileTab = document.getElementById('profile');
    if (profileTab) this.dependencies.renderProfile(profileTab, this.dependencies.context);
  }

  private async handleAuthSession(session: AuthSession): Promise<void> {
    const { authCoordinator, portfolioSession, state } = this.dependencies;
    const { user } = session;
    if (this.guestSessionActive && !user) return;
    if (!user && this.authPromptRequested) {
      this.dependencies.showAuthScreen();
      return;
    }

    await portfolioSession.teardown();
    if (!authCoordinator.isCurrent(session)) return;

    if (user) {
      this.guestSessionActive = false;
      this.authPromptRequested = false;
      this.dependencies.configureStorageScope(user.uid);
      const scopedState = this.dependencies.loadData();
      if (scopedState) applyPersistedState(state, scopedState);
      state.currentUser = user;
      const logoutButton = document.getElementById('logout-btn');
      if (logoutButton) logoutButton.style.display = 'block';

      await this.loadAuthenticatedPortfolio(user, session);
      this.setCloudSaveEnabled(true);
      this.startNiftyMonitor(session);
    } else {
      if (!this.authPromptRequested) {
        await this.startGuestSession();
        return;
      }

      this.guestSessionActive = false;
      state.currentUser = null;
      this.dependencies.showAuthScreen();
      const logoutButton = document.getElementById('logout-btn');
      if (logoutButton) logoutButton.style.display = 'none';
      this.setCloudSaveEnabled(false);
    }
  }

  private async loadAuthenticatedPortfolio(user: User, session: AuthSession): Promise<void> {
    const { authCoordinator, portfolioSession, state } = this.dependencies;
    try {
      await this.dependencies.initFirestore(this.dependencies.firebaseConfig);
      const localEnvelope = this.hasLocalPortfolioData(state)
        ? buildEnvelopeFromState(
            state,
            { clientId: 'browser', appVersion: '2.2.0', platform: 'web' },
            state._lastSavedAt,
          )
        : null;
      const remoteEnvelope = await this.dependencies.loadPortfolio(user.uid);
      if (!authCoordinator.isCurrent(session)) return;

      const merged = remoteEnvelope && localEnvelope
        ? mergeEnvelopes(localEnvelope, remoteEnvelope)
        : {
            envelope: remoteEnvelope ?? localEnvelope ?? buildEnvelopeFromState(state),
            conflicts: [],
            dirtySections: [],
          };
      applyEnvelopeToState(state, merged.envelope);
      state.currentUser = user;
      portfolioSession.setEnvelope(merged.envelope);
      persistPortfolioState(state, { sync: false });
      this.dependencies.hideAuthScreen();

      const coordinator = new SyncCoordinator({
        uid: user.uid,
        save: this.dependencies.savePortfolio,
        onStatusChange: (status) => syncStatusStore.set(status),
      });
      portfolioSession.setSyncCoordinator(coordinator);
      portfolioSession.setEnvelope(merged.envelope);
      portfolioSession.setPortfolioUnsubscribe(
        this.dependencies.onPortfolioChange(
          user.uid,
          (remote) => {
            if (!authCoordinator.isCurrent(session)) return;
            const current = buildEnvelopeFromState(
              state,
              { clientId: 'browser', appVersion: '2.2.0', platform: 'web' },
              state._lastSavedAt,
              portfolioSession.currentEnvelope ?? undefined,
            );
            const mergedSnapshot = mergeEnvelopes(current, remote).envelope;
            applyEnvelopeToState(state, mergedSnapshot);
            state.currentUser = user;
            portfolioSession.setEnvelope(mergedSnapshot);
            persistPortfolioState(state, { sync: false });
            document.dispatchEvent(new CustomEvent('profileUpdated', { detail: state }));
          },
          (error) => console.warn('[Auth] Firestore snapshot failed:', error),
        ),
      );

      this.dependencies.fetchSIPNAVs().catch((error) =>
        console.warn('[Auth] Failed to fetch SIP NAVs:', error),
      );
      const profileTab = document.getElementById('profile');
      const profileNavTab = document.querySelector('[data-tab="profile"]');
      if (profileTab && profileNavTab?.classList.contains('active')) {
        this.dependencies.renderProfile(profileTab, this.dependencies.context);
      }
      this.dependencies.checkDailyTasks(state);
    } catch (error) {
      console.warn('[Auth] Failed to load from Firebase:', error);
      this.dependencies.hideAuthScreen();
    }
  }

  private startNiftyMonitor(session: AuthSession): void {
    const { authCoordinator, state, updateCrashAlert, monitorNiftyLevel, portfolioSession } = this.dependencies;
    try {
      portfolioSession.setNiftyMonitorCleanup(
        monitorNiftyLevel((alert) => {
          if (!authCoordinator.isCurrent(session)) return;
          if (alert) {
            const totalBonds = Object.values(state.bonds || {}).reduce((sum, bond) => sum + bond.amount, 0);
            if (alert.severity === 'medium') alert.deployAmount = totalBonds * 0.1;
            else if (alert.severity === 'high') alert.deployAmount = totalBonds * 0.15;
            else if (alert.severity === 'critical') alert.deployAmount = totalBonds * 0.25;
            console.info('Crash alert detected:', {
              crashPercentage: alert.crashPercentage,
              severity: alert.severity,
              deployAmount: alert.deployAmount,
            });
            updateCrashAlert(alert);
          } else {
            updateCrashAlert(null);
          }
        }),
      );
    } catch (error) {
      console.warn('Failed to start Nifty monitoring:', error);
    }
  }

  private setCloudSaveEnabled(enabled: boolean): void {
    const saveCloudButton = document.getElementById('save-cloud-btn') as HTMLButtonElement | null;
    if (saveCloudButton) {
      saveCloudButton.disabled = !enabled;
      saveCloudButton.classList.toggle('btn-disabled', !enabled);
      const hint = document.querySelector('.save-cloud-hint') as HTMLElement | null;
      if (hint) hint.style.display = enabled ? 'none' : '';
    }
  }

  private hasLocalPortfolioData(state: FireOSState): boolean {
    return Boolean(
      state.profile.name.trim()
        || state.profile.age
        || state.profile.annualExpenses
        || state.profile.fiTarget
        || state.profile.monthlyIncome
        || Object.keys(state.mf).length
        || Object.keys(state.sip).length
        || Object.keys(state.fd).length
        || Object.keys(state.epf).length
        || Object.keys(state.esop).length
        || Object.keys(state.bonds).length
        || Object.keys(state.demat).length
        || state.niftyData
        || state.netWorthHistory.length
        || state.achievedMilestones.length,
    );
  }
}
