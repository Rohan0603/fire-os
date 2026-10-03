/* global console */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { routes } from './routes.mjs';

const distDirectory = path.resolve('dist');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

for (const { route, title, heading } of routes) {
  const filePath = path.join(distDirectory, route, 'index.html');
  const html = await readFile(filePath, 'utf8');
  const canonical = `https://fire-os-dd6d6.web.app/${route}`;
  const checks = [
    [`title ${title}`, new RegExp(`<title>${escapeRegExp(title)}<\\/title>`, 'i')],
    [`heading ${heading}`, new RegExp(`<h1>${escapeRegExp(heading)}<\\/h1>`, 'i')],
    [
      `canonical ${canonical}`,
      new RegExp(`<link rel="canonical" href="${escapeRegExp(canonical)}">`, 'i'),
    ],
    [
      `Open Graph URL ${canonical}`,
      new RegExp(`<meta property="og:url" content="${escapeRegExp(canonical)}">`, 'i'),
    ],
    [`JSON-LD URL ${canonical}`, new RegExp(`"url":"${escapeRegExp(canonical)}"`, 'i')],
  ];

  for (const [description, pattern] of checks) {
    if (!pattern.test(html)) {
      throw new Error(`Route metadata check failed for /${route}: missing ${description}`);
    }
  }
}

for (const file of ['robots.txt', 'sitemap.xml', 'llms.txt']) {
  await readFile(path.join(distDirectory, file), 'utf8');
}

console.log(`Verified metadata and discovery files for ${routes.length} routes.`);
