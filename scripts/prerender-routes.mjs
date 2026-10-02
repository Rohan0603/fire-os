import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stdout } from 'node:process';

const distDirectory = path.resolve('dist');
const source = await readFile(path.join(distDirectory, 'index.html'), 'utf8');

const sections = [
  {
    route: 'profile',
    title: 'Profile | FIRE OS',
    description: 'Set up a financial profile, import portfolio statements, and manage holdings for FIRE planning.',
    heading: 'Portfolio Profile',
    details: ['Personal financial assumptions', 'Mutual fund, SIP, FD, EPF, bond, ESOP, and demat holdings', 'Local-first portfolio data with optional sign-in for cloud sync'],
  },
  {
    route: 'dashboard',
    title: 'Dashboard | FIRE OS',
    description: 'Review net worth, portfolio breakdown, SIP status, milestones, and market risk indicators.',
    heading: 'Financial Independence Dashboard',
    details: ['Net worth and asset allocation', 'SIP and portfolio performance', 'Crash protocol and milestone tracking'],
  },
  {
    route: 'calculators',
    title: 'Calculators | FIRE OS',
    description: 'Model retirement, SIP, withdrawal, tax, emergency runway, insurance, and market scenarios.',
    heading: 'Financial Calculators',
    details: ['Retirement and corpus projections', 'SIP, SWP, and scenario modeling', 'Tax, insurance, emergency runway, and rebalancing tools'],
  },
  {
    route: 'insurance',
    title: 'Insurance | FIRE OS',
    description: 'Estimate life and health insurance needs from income, expenses, liabilities, and dependents.',
    heading: 'Insurance Planner',
    details: ['Coverage requirement estimates', 'Income replacement planning', 'Expense and liability assumptions'],
  },
  {
    route: 'plan',
    title: 'Plan | FIRE OS',
    description: 'Turn FIRE goals into plain-English actions, milestones, health status, and net-worth history.',
    heading: 'FIRE Plan',
    details: ['Financial health status', 'Action recommendations and milestones', 'Net-worth history and cash-flow summaries'],
  },
  {
    route: 'esop',
    title: 'ESOP Tools | FIRE OS',
    description: 'Model employee stock option value, exercise scenarios, currency conversion, and tax planning.',
    heading: 'ESOP Tools',
    details: ['Generic employee stock option projections', 'Exercise and value scenarios', 'Currency conversion and tax planning inputs'],
  },
];

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

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
    .replace('<title>FIRE OS — Financial Independence Dashboard</title>', `<title>${escapeHtml(section.title)}</title>`)
    .replace('</head>', `  <link rel="canonical" href="${canonicalUrl}">\n  <meta property="og:title" content="${escapeHtml(section.title)}">\n  <meta property="og:description" content="${escapeHtml(section.description)}">\n  <meta property="og:url" content="${canonicalUrl}">\n  <script type="application/ld+json">${structuredData}</script>\n</head>`)
    .replace('<div id="app">', `<div id="app">${staticContent}`);

  const routeDirectory = path.join(distDirectory, section.route);
  await mkdir(routeDirectory, { recursive: true });
  await writeFile(path.join(routeDirectory, 'index.html'), html, 'utf8');
}

stdout.write(`Prerendered ${sections.length} public FIRE OS routes.\n`);
