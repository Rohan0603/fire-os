import { expect, test } from '@playwright/test';

const TOKENS = [
  '--color-primary',
  '--color-cta',
  '--color-background',
  '--color-surface',
  '--color-foreground',
  '--color-muted-foreground',
  '--color-border',
  '--color-success',
  '--color-danger',
];

test('exposes design tokens as CSS custom properties in light and dark', async ({ page }) => {
  await page.goto('/');
  for (const scheme of ['light', 'dark'] as const) {
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
