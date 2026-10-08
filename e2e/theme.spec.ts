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
