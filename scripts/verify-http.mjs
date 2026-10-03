/* global process, fetch, console */

const baseUrl = (process.env.BASE_URL || 'http://localhost:4173').replace(/\/$/, '');
const checks = [
  ['/', 'text/html'],
  ['/dashboard', 'text/html'],
  ['/robots.txt', 'text/plain'],
  ['/sitemap.xml', 'application/xml'],
];

const requiredHeaders = {
  'content-security-policy': (value) => value && !value.toLowerCase().includes('report-only'),
  'x-content-type-options': (value) => value?.toLowerCase() === 'nosniff',
  'referrer-policy': (value) => Boolean(value),
  'permissions-policy': (value) => Boolean(value),
  'x-frame-options': (value) => value?.toUpperCase() === 'DENY',
};

let failures = 0;
for (const [route, contentType] of checks) {
  const response = await fetch(`${baseUrl}${route}`);
  if (!response.ok) {
    console.error(`${route}: HTTP ${response.status}`);
    failures += 1;
    continue;
  }

  const actualContentType = response.headers.get('content-type') || '';
  if (!actualContentType.toLowerCase().includes(contentType)) {
    console.error(
      `${route}: expected content type containing ${contentType}, got ${actualContentType}`,
    );
    failures += 1;
  }

  if (route === '/') {
    for (const [header, validate] of Object.entries(requiredHeaders)) {
      if (!validate(response.headers.get(header))) {
        console.error(`${route}: missing or invalid ${header}`);
        failures += 1;
      }
    }
    const html = await response.text();
    if (!html.includes('rel="canonical"') || !html.includes('application/ld+json')) {
      console.error(`${route}: missing canonical metadata or JSON-LD`);
      failures += 1;
    }
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log(`HTTP checks passed for ${baseUrl}`);
}
