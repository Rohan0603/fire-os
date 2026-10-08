import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RouteShell } from './components/route-placeholder';
import { ROUTE_META } from './routes/route-meta';

const routes = ROUTE_META.flatMap((meta) => {
  const element = <RouteShell meta={meta} />;
  return [{ path: meta.path, element }, ...(meta.aliases ?? []).map((path) => ({ path, element }))];
});

// ponytail: unknown paths fall back to `/` rather than adding a not-found route;
// a placeholder 404 is a separate decision and no spec requirement needs it yet.
export const router = createBrowserRouter([
  ...routes,
  { path: '*', element: <Navigate to="/" replace /> },
]);
