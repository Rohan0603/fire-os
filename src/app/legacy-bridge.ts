/**
 * Compat bridge between the React router and the legacy tab system.
 *
 * `src/main.ts` still owns the legacy tab containers until each route is ported.
 * React Router navigates client-side with `pushState`, which does not fire the
 * `popstate` listener the legacy code relies on, so the legacy tabs would stop
 * following the URL. `main.ts` registers `activateLegacyTab` here; the shell
 * calls it on every route change.
 *
 * Kept in its own module so `layout.tsx` never imports `main.ts` (which imports
 * the app), which would be an import cycle.
 */

type FeatureId = string;
let activateLegacyTab: ((id: FeatureId) => void) | null = null;

/** Called once by `main.ts` during init. */
export function registerLegacyTabActivator(activator: (id: FeatureId) => void): void {
  activateLegacyTab = activator;
}

/** Called by the shell on every route change. No-op before the app has booted. */
export function syncLegacyTab(id: FeatureId): void {
  activateLegacyTab?.(id);
}
