/* global console, fetch, process */
import { routes } from './routes.mjs';

const baseUrl = process.env.SMOKE_BASE_URL ?? 'https://fire-os-dd6d6.web.app';

for (const { route } of routes) {
  const pathname = route ? `/${route}` : '/';
  const response = await fetch(`${baseUrl}${pathname}`);
  const html = await response.text();
  if (!response.ok || !/<title>[^<]+<\/title>/i.test(html) || !/<h1\b/i.test(html)) {
    throw new Error(`Smoke test failed for ${pathname}: HTTP ${response.status}`);
  }
}

console.log(`Smoke-tested ${routes.length} routes at ${baseUrl}`);
