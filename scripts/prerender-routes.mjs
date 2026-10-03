import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stdout } from 'node:process';
import { routes } from './routes.mjs';

const distDirectory = path.resolve('dist');
const source = await readFile(path.join(distDirectory, 'index.html'), 'utf8');

const escapeHtml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const sections = routes.filter(({ route }) => route);
const navigation = sections
  .map(({ route, heading }) => `<a href="/${route}">${escapeHtml(heading)}</a>`)
  .join('\n          ');

for (const section of sections) {
  const canonicalUrl = `https://fire-os-dd6d6.web.app/${section.route}`;
  const details = section.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join('');
  const staticContent = `
    <main>
      <nav aria-label="FIRE OS sections">
        ${navigation}
      </nav>
      <article>
        <p>FIRE OS Financial Independence Dashboard</p>
        <h1>${escapeHtml(section.heading)}</h1>
        <p>${escapeHtml(section.description)}</p>
        <ul>${details}</ul>
        <p>Guest mode is available by default. Changes stay in this browser unless the user chooses to sign in.</p>
      </article>
    </main>`;
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: section.title,
    description: section.description,
    url: canonicalUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: 'FIRE OS',
      url: 'https://fire-os-dd6d6.web.app/',
    },
  });
  const html = source
    .replace(
      '<title>FIRE OS — Financial Independence Dashboard</title>',
      `<title>${escapeHtml(section.title)}</title>`,
    )
    .replace(
      '</head>',
      `  <link rel="canonical" href="${canonicalUrl}">\n  <meta property="og:title" content="${escapeHtml(section.title)}">\n  <meta property="og:description" content="${escapeHtml(section.description)}">\n  <meta property="og:url" content="${canonicalUrl}">\n  <script type="application/ld+json">${structuredData}</script>\n</head>`,
    )
    .replace('<div id="app">', `<div id="app">${staticContent}`);

  const routeDirectory = path.join(distDirectory, section.route);
  await mkdir(routeDirectory, { recursive: true });
  await writeFile(path.join(routeDirectory, 'index.html'), html, 'utf8');
}

stdout.write(`Prerendered ${sections.length} public FIRE OS routes.\n`);
