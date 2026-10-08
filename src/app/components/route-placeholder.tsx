import type { ReactNode } from 'react';
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
