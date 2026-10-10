import { expect, test } from '@playwright/test';

const TOKENS = [
  '--color-primary',
  '--color-secondary',
  '--color-accent',
  '--color-destructive',
  '--color-warning',
  '--color-background',
  '--color-surface',
  '--color-surface-raised',
  '--color-foreground',
  '--color-muted-foreground',
  '--color-border',
  '--color-ring',
];

test('exposes design tokens as CSS custom properties in light and dark', async ({ page }) => {
  await page.goto('/');
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const token of TOKENS) {
      const value = await page.evaluate(
        (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
        token,
      );
      // Tokens resolve to an oklch() value, per the spec's OKLCH requirement.
      expect(value, `${token} in ${scheme}`).toMatch(/^oklch\(/);
    }
  }
});

test('the manual override wins over the system preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const darkBackground = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim(),
  );

  await page.locator('#theme-toggle').click();
  const lightBackground = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim(),
  );

  expect(lightBackground).not.toBe(darkBackground);
});

/**
 * Regression guard. `setupTheme` used to apply the resolved theme by calling the
 * same helper the toggle uses, which wrote `fire-os-theme` to localStorage on
 * initial load. That froze the OS preference seen on first load, so a later
 * change of OS setting was ignored, and it contradicted docs/ui.md: an unset
 * preference must stay unset.
 *
 * The failure is invisible to the token test above: a token that exists in both
 * schemes still passes. What matters is that the two schemes actually differ
 * and that nothing was persisted without a user toggle.
 */
test('an unset preference stays unset and the system preference keeps working', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  const storedOnLoad = await page.evaluate(() => localStorage.getItem('fire-os-theme'));
  expect(storedOnLoad).toBeNull();

  // The dark half must genuinely differ from light, not just exist.
  const darkBackground = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim(),
  );

  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  const lightBackground = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim(),
  );

  expect(darkBackground).not.toBe(lightBackground);
  expect(await page.evaluate(() => localStorage.getItem('fire-os-theme'))).toBeNull();
});

test('a real toggle persists the choice', async ({ page }) => {
  await page.goto('/');
  await page.locator('#theme-toggle').click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('fire-os-theme')))
    .toMatch(/^(light|dark)$/);
});

/**
 * Regression guard for the light-background-in-dark-mode defect.
 *
 * The Tailwind palette (`tokens-oklch.css`) treats `prefers-color-scheme: dark` as
 * authoritative, but the legacy palette (`tokens.css`) only defined its dark half
 * under `html[data-theme="dark"]`, and ThemeToggle deliberately leaves `data-theme`
 * unset when the user has never toggled. On a system-dark machine with no stored
 * preference the shell went dark while every legacy token stayed light, so the
 * un-migrated Plan cards painted `#f5f5f5` while their inherited body text stayed
 * near-white — unreadable in both schemes' worth of a dark page.
 *
 * Asserted as a relationship, not an exact value: the legacy card background and
 * the legacy body text must both flip between schemes, and in dark mode the card
 * must be dark and its text light, so the two are legible against each other.
 */
test('legacy surfaces follow the system preference when no theme is stored', async ({ page }) => {
  const read = () =>
    page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const card = document.querySelector('.plan-card')!;
      const title = document.querySelector('.plan-card-title')!;
      return {
        stored: localStorage.getItem('fire-os-theme'),
        bgPrimary: root.getPropertyValue('--bg-primary').trim(),
        cardBg: getComputedStyle(card).backgroundColor,
        titleColor: getComputedStyle(title).color,
      };
    });

  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/plan');
  // The legacy bridge renders Plan after auth resolves, and a cold Vite server can
  // take well over Playwright's 5s default. Wait generously: without this the RED
  // run can die on a missing card instead of on the contrast assertion, which would
  // make the test fail for a timing reason rather than the defect it guards.
  await expect(page.locator('#plan .plan-card').first()).toBeVisible({ timeout: 20_000 });
  const light = await read();

  await page.emulateMedia({ colorScheme: 'dark' });
  const dark = await read();

  // An unset preference must stay unset; the media query is what has to do the work.
  expect(light.stored).toBeNull();
  expect(dark.stored).toBeNull();

  // The legacy token and the card that reads it must both react to the system.
  expect(dark.bgPrimary, '--bg-primary in dark').not.toBe(light.bgPrimary);
  expect(dark.cardBg, '.plan-card background in dark').not.toBe(light.cardBg);

  // Relative lightness, so the assertion survives a palette change. A light card in
  // dark mode is the defect: every channel of the dark card must be below the light one.
  const channel = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number).slice(0, 3);
  const [lr, lg, lb] = channel(light.cardBg);
  const [dr, dg, db] = channel(dark.cardBg);
  expect(Math.max(dr, dg, db), 'dark card is darker than light card').toBeLessThan(
    Math.min(lr, lg, lb),
  );

  // And dark-mode body text must be the lighter of the two, so it is legible on the card.
  const [tr, tg, tb] = channel(dark.titleColor);
  const [ltr, ltg, ltb] = channel(light.titleColor);
  expect(
    Math.min(tr, tg, tb),
    'dark-mode title is lighter than its light-mode counterpart',
  ).toBeGreaterThan(Math.max(ltr, ltg, ltb));
});

/**
 * The design system's typeface is linked from index.html, not @imported from
 * app.css: global.css is imported first and carries its own @import, which makes a
 * later stylesheet's @import invalid, so the font request was dropped from the
 * build while still appearing in source.
 */
test('the design system typeface is actually requested', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('fonts.googleapis.com')) requests.push(req.url());
  });

  await page.goto('/');
  // Wait for the stylesheet request rather than assuming it lands synchronously.
  await expect.poll(() => requests.length, { timeout: 5_000 }).toBeGreaterThan(0);
  expect(requests.join(' ')).toContain('IBM+Plex+Sans');
});
