import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/error-boundary';
import { Sidebar } from './components/sidebar';
import { ThemeToggle } from './components/theme-toggle';
import { syncLegacyTab } from './legacy-bridge';
import { metaForPath } from './routes/route-meta';

/**
 * App shell: sidebar, topbar and the routed content pane.
 *
 * The ThemeToggle sits above <Outlet /> so a manual dark-mode choice survives
 * navigation. `#logout-btn` stays in the legacy topbar for now; it moves into
 * this topbar when the auth screen is ported.
 *
 * Below `lg` the sidebar is an off-canvas drawer driven by a native <details>
 * disclosure, so no JS state is needed. `#app` holds the legacy compat bridge and
 * must stay in the document while routes are placeholders.
 */
export function AppLayout() {
  const location = useLocation();
  const legacyMount = useRef<HTMLDivElement>(null);

  // React Router navigates without a popstate event, so the legacy tabs are told
  // about the change here. Routes claim the container id themselves once migrated,
  // in which case this is a no-op.
  useEffect(() => {
    syncLegacyTab(metaForPath(location.pathname).id);
  }, [location.pathname]);

  // `#app` is a sibling of `#app-root` in index.html. Move it into the content pane
  // so placeholder routes render beside the sidebar instead of below the whole
  // shell. It is relocated rather than re-rendered, so the legacy containers the
  // FeatureRegistry writes into stay the same DOM nodes.
  useEffect(() => {
    const legacy = document.getElementById('app');
    if (legacy && legacyMount.current && legacy.parentElement !== legacyMount.current) {
      legacyMount.current.appendChild(legacy);
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-(--color-background) text-(--color-foreground)">
      <header className="flex items-center justify-between gap-3 border-b border-(--color-border) p-3">
        <span className="text-lg font-bold">FIRE OS</span>
        <ThemeToggle />
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <details className="border-b border-(--color-border) lg:hidden">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Menu</summary>
          <Sidebar />
        </details>

        <aside className="hidden w-56 shrink-0 border-r border-(--color-border) lg:block">
          <Sidebar />
        </aside>

        <main className="flex-1 p-3 lg:p-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
          {/* Legacy compat bridge: still owns the containers for routes that have
              not been ported. Removed once the last route is migrated. */}
          <div ref={legacyMount} />
        </main>
      </div>
    </div>
  );
}
