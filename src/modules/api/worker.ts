/**
 * Base URL of the FIRE OS Cloudflare Worker, which owns the Yahoo/OpenRouter
 * access. `VITE_ASSISTANT_API_URL` is the Worker base URL (the same Worker
 * serves the Assistant and `/api/market/*`); same-origin is the default. No
 * secret or CORS-proxy key ships to the browser.
 */
export function workerUrl(path: string): string {
  const base = import.meta.env.VITE_ASSISTANT_API_URL?.trim();
  return `${base ? base.replace(/\/$/, '') : ''}${path}`;
}
