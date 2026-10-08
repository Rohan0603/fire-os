/**
 * Bootstrap seam between session initialisation and the React mount.
 *
 * React must not render until `AuthSessionController.start()` has resolved a
 * session (guest or authenticated); mounting earlier renders against
 * half-initialised state. `createBootstrap` is the testable unit and takes its
 * collaborators by injection; `bootstrapApp` is the production wiring.
 */

export type SessionMode = 'guest' | 'authenticated';

export interface AppBootstrapResult {
  /** True once a session (guest or authenticated) has been resolved. */
  ready: boolean;
  /** Current session kind, for route guards. */
  mode: SessionMode;
  /** Mount the React tree into `container`. Idempotent. */
  mountReact(container: HTMLElement): void;
}

export interface BootstrapDependencies {
  /** Kicks off auth session resolution. Called exactly once, before the result resolves. */
  startAuthSession: () => void;
  /** Called once, lazily, with the container passed to `mountReact`. */
  createReactMount: (container: HTMLElement) => void;
  /** Current session kind. Defaults to `'guest'`. */
  resolveMode?: () => SessionMode;
}

export function createBootstrap(
  deps: BootstrapDependencies,
): () => Promise<AppBootstrapResult> {
  return async () => {
    deps.startAuthSession();
    // Yield so session resolution callbacks registered by startAuthSession can run
    // before the mode is read.
    await Promise.resolve();

    const mode = deps.resolveMode?.() ?? 'guest';
    let mounted = false;

    return {
      ready: true,
      mode,
      mountReact(container: HTMLElement): void {
        if (mounted) return;
        mounted = true;
        deps.createReactMount(container);
      },
    };
  };
}
