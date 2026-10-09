import type { ReactNode } from 'react';
import { useRouteMeta } from '../hooks/use-route-meta';
import type { RouteMeta } from '../routes/route-meta';

export interface RouteShellProps {
  meta: RouteMeta;
  children?: ReactNode;
  /**
   * `placeholder` while the route's module is still served by the legacy compat
   * bridge, `migrated` once a React component owns it.
   *
   * Only a migrated route claims `meta.id`. While a placeholder, the legacy
   * container in the compat bridge still owns that id and the `active` class, and
   * React renders a sibling marker instead — two elements with the same id would
   * break the `#<id>.active` contract that `e2e/portfolio.spec.ts` asserts.
   */
  migrationState?: 'placeholder' | 'migrated';
}

export function RouteShell({ meta, children, migrationState = 'placeholder' }: RouteShellProps) {
  // Only one RouteShell is mounted at a time, so calling the hook here is safe
  // and keeps metadata tied to whichever route is showing.
  useRouteMeta();

  // Test-only seam, compiled out of production builds. The error boundary had
  // no way to be reached, so the kit it renders was never exercised in a
  // browser. Set by e2e/ui-kit.spec.ts via addInitScript. Playwright runs the
  // dev server, so DEV is true there; a production build has no such path.
  if (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    (window as { __forceRouteError?: boolean }).__forceRouteError
  ) {
    throw new Error('Forced route error for e2e coverage');
  }

  if (migrationState === 'placeholder') {
    return (
      <div data-route={meta.id} data-migration-state="placeholder" hidden>
        {children}
      </div>
    );
  }

  return (
    <section id={meta.id} className="active" data-migration-state="migrated">
      {children}
    </section>
  );
}
