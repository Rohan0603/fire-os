import type { FeatureRegistry } from './feature-registry';
import { registerAuthAction, registerAuthControlSync, registerLegacyTabActivator } from './legacy-bridge';

/** Session behaviour the logout button needs from the auth session controller. */
export interface TabSession {
  readonly isGuestSessionActive: boolean;
  requestSignIn(): Promise<void>;
  signOut(): Promise<void>;
  syncAuthControl(): void;
}

/**
 * Resolve the tab for a location: trailing-slash-stripped pathname first,
 * then the hash, then the default `profile` tab.
 */
export function resolveTabTarget(
  registry: Pick<FeatureRegistry, 'get'>,
  pathname: string,
  hash: string,
): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  const pathTarget = path.startsWith('/') ? path.slice(1) : path;
  const hashTarget = hash.slice(1);
  return registry.get(pathTarget)?.id ?? registry.get(hashTarget)?.id ?? 'profile';
}

// Tab navigation
export function setupTabNavigation(registry: FeatureRegistry, session: TabSession): void {
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const navTabs = document.querySelector('.nav-tabs');

  if (hamburgerBtn && navTabs) {
    hamburgerBtn.addEventListener('click', () => {
      hamburgerBtn.classList.toggle('open');
      navTabs.classList.toggle('open');
    });
  }

  const activateTab = (target: string): void => {
    const tabEl = document.getElementById(target);
    if (!tabEl || !registry.get(target)) return;

    const currentTab = document.querySelector<HTMLElement>('.tab.active');
    if (currentTab && currentTab.id !== target) {
      void registry.unmount(currentTab.id, currentTab).catch((error) => {
        console.warn(`Failed to unmount feature ${currentTab.id}:`, error);
      });
    }

    document.querySelectorAll('.nav-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.getAttribute('data-tab') === target);
    });
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
    tabEl.classList.add('active');

    void registry.mount(target, tabEl).catch((error) => {
      console.error(`Failed to load module for tab ${target}:`, error);
      tabEl.innerHTML =
        '<p style="padding: 20px; color: #d32f2f;">Error loading module. Please check your connection.</p>';
    });
  };

  const activateLocationTab = (): void => {
    activateTab(resolveTabTarget(registry, window.location.pathname, window.location.hash));
  };

  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      if (hamburgerBtn && navTabs) {
        hamburgerBtn.classList.remove('open');
        navTabs.classList.remove('open');
      }
      const target = tab.getAttribute('data-tab');
      if (target) {
        window.history.pushState({}, '', `/${target}`);
        activateTab(target);
      }
    });
  });
  window.addEventListener('popstate', activateLocationTab);
  window.addEventListener('hashchange', activateLocationTab);
  activateLocationTab();

  // React Router navigates without popstate, so hand it the same activator.
  registerLegacyTabActivator(activateTab);

  // Auth action. The button itself lives in the React header
  // (src/app/components/auth-button.tsx) and still carries `#logout-btn`, which
  // `AuthSessionController` drives for its label and visibility.
  registerAuthAction(async () => {
    try {
      if (session.isGuestSessionActive) {
        await session.requestSignIn();
        return;
      }
      await session.signOut();
    } catch (e) {
      console.error('Logout failed:', e);
    }
  });
  registerAuthControlSync(() => session.syncAuthControl());

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        if (session.isGuestSessionActive) {
          await session.requestSignIn();
          return;
        }
        await session.signOut();
      } catch (e) {
        console.error('Logout failed:', e);
      }
    });
  }
}
