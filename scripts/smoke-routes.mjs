/* global console, fetch, process */

const baseUrl = process.env.SMOKE_BASE_URL ?? 'https://fire-os-dd6d6.web.app';
const routes = ['', '/profile', '/dashboard', '/calculators', '/insurance', '/plan', '/esop'];

for (const route of routes) {
  const response = await fetch(`${baseUrl}${route}`);
  const html = await response.text();
  if (!response.ok || !/<title>[^<]+<\/title>/i.test(html) || !/<h1\b/i.test(html)) {
    throw new Error(`Smoke test failed for ${route || '/'}: HTTP ${response.status}`);
  }
}

console.log(`Smoke-tested ${routes.length} routes at ${baseUrl}`);
