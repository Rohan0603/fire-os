import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { metaForPath } from '../routes/route-meta';
import type { RouteMeta } from '../routes/route-meta';

function setDescription(description: string): void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'description';
    document.head.appendChild(meta);
  }
  meta.content = description;
}

/**
 * Apply the current route's document metadata.
 *
 * There is no server render, so this replaces the static per-route HTML that
 * `scripts/prerender-routes.mjs` used to inject. That script and
 * `scripts/routes.mjs` are retired in the Cloudflare migration PR; until then
 * `src/app/routes/route-meta.ts` is the source of truth for route copy.
 */
export function useRouteMeta(): RouteMeta {
  const location = useLocation();
  const meta = metaForPath(location.pathname);

  useEffect(() => {
    document.title = meta.title;
    setDescription(meta.description);
  }, [meta.title, meta.description]);

  return meta;
}
