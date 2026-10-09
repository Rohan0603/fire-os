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
 * The design system's typeface is linked from index.html, not @imported from
 * app.css: global.css is imported first and carries its own @import, which makes
 * a later stylesheet's @import invalid, so the font request was dropped from the
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
