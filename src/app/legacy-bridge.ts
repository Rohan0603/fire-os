/**
 * Bridge from the React shell to the legacy entry point (`src/main.ts`).
 *
 * Two jobs, both because `main.ts` cannot import the app (the app is mounted *by*
 * `main.ts`) and the app must not import `main.ts` without creating an import
 * cycle. Kept in one module for that reason.
 *
 * 1. **Compat bridge.** `main.ts` still owns the legacy tab containers until each
 *    route is ported. React Router navigates client-side with `pushState`, which
 *    never fires the `popstate` listener the legacy code relies on, so `main.ts`
 *    registers its tab activator here and the shell calls it on every route change.
 * 2. **Session actions.** The auth control lives in the React header, but the
 *    session controller lives in `main.ts`.
 */

type FeatureId = string;

let activateLegacyTab: ((id: FeatureId) => void) | null = null;
let runAuthAction: (() => Promise<void>) | null = null;
let syncAuthControl: (() => void) | null = null;

/** Called once by `main.ts` during init. */
export function registerLegacyTabActivator(activator: (id: FeatureId) => void): void {
  activateLegacyTab = activator;
}

/** Called by the shell on every route change. No-op before the app has booted. */
export function syncLegacyTab(id: FeatureId): void {
  activateLegacyTab?.(id);
}

/**
 * Registers the sign-in / sign-out action. In guest mode it starts a sign-in
 * request; when authenticated it signs out.
 */
export function registerAuthAction(action: () => Promise<void>): void {
  runAuthAction = action;
}

/** Invoked by the header's auth button. No-op before the app has booted. */
export async function triggerAuthAction(): Promise<void> {
  await runAuthAction?.();
}

/**
 * Registers a re-apply of the auth control's label and visibility. The React
 * header mounts after the first session resolves, so the controller's own initial
 * update lands before the element exists.
 */
export function registerAuthControlSync(sync: () => void): void {
  syncAuthControl = sync;
}

/** Called once, after React has mounted, to apply the auth control's state. */
export function refreshAuthControl(): void {
  syncAuthControl?.();
}
