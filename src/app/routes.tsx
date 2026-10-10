import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RouteShell } from './components/route-placeholder';
import { AppLayout } from './layout';
import { ROUTE_META } from './routes/route-meta';
import { DashboardRoute } from './routes/dashboard';

/** Routes whose React implementation owns the container id (migrated). */
const MIGRATED_ROUTES: Record<string, ReactNode> = {
  dashboard: <DashboardRoute />,
};

/**
 * Child routes are relative to the layout route, so the profile route is an
 * index route plus an explicit `profile` path: the legacy app resolved both `/`
 * and `/profile` to the profile tab, and `e2e/portfolio.spec.ts` navigates to
 * `/profile` expecting the URL to stay put rather than redirect.
 *
 * A migrated route renders its React element and claims its id via RouteShell;
 * every other route stays a placeholder marker for the legacy bridge.
 */
const children = ROUTE_META.flatMap((meta) => {
  const migrated = MIGRATED_ROUTES[meta.id];
  const element = (
    <RouteShell meta={meta} migrationState={migrated ? 'migrated' : 'placeholder'}>
      {migrated}
    </RouteShell>
  );
  const relative = meta.path === '/' ? [] : [meta.path.slice(1)];
  const aliasPaths = (meta.aliases ?? []).map((path) => path.slice(1));
  const paths = meta.path === '/' ? ['', ...aliasPaths] : [...relative, ...aliasPaths];
  return paths.map((path, index) => ({
    ...(path === '' && index === 0 ? { index: true } : { path }),
    element,
  }));
});

// ponytail: unknown paths fall back to `/` rather than adding a not-found route;
// a placeholder 404 is a separate decision and no spec requirement needs it yet.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [...children, { path: '*', element: <Navigate to="/" replace /> }],
  },
]);
