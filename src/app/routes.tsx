import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RouteShell } from './components/route-placeholder';
import { AppLayout } from './layout';
import { ROUTE_META } from './routes/route-meta';

/**
 * Child routes are relative to the layout route, so the profile route is an
 * index route plus an explicit `profile` path: the legacy app resolved both `/`
 * and `/profile` to the profile tab, and `e2e/portfolio.spec.ts` navigates to
 * `/profile` expecting the URL to stay put rather than redirect.
 */
const children = ROUTE_META.flatMap((meta) => {
  const element = <RouteShell meta={meta} />;
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
