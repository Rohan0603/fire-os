import { expect, test } from '@playwright/test';

/**
 * Dashboard migration contract.
 *
 * The dashboard is the first route ported to React, so these assertions pin the
 * migration marker, the single-owner id rule and the no-emoji rule that the
 * design-system checklist scopes out of unmigrated legacy modules.
 */

test('owns #dashboard as a migrated route with a unique id', async ({ page }) => {
  await page.goto('/dashboard');
  const dashboard = page.locator('#dashboard');
  await expect(dashboard).toHaveCount(1);
  await expect(dashboard).toBeVisible();
  await expect(dashboard).toHaveClass(/active/);
  await expect(dashboard).toHaveAttribute('data-migration-state', 'migrated');
  // React owns the container, so no legacy [data-route] marker is rendered.
  await expect(page.locator('[data-route="dashboard"]')).toHaveCount(0);
});

test('renders its KPI, trust-panel and chart surfaces', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByText('Total Net Worth')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Portfolio Summary' })).toBeVisible();
  await expect(page.getByText('Data quality')).toBeVisible();
  await expect(page.getByText('Annual Cashflow')).toBeVisible();
  await expect(page.getByText('Portfolio Breakdown')).toBeVisible();
  await expect(page.getByText('Net Worth Trend')).toBeVisible();
});

test('uses no emoji as content in migrated dashboard markup', async ({ page }) => {
  await page.goto('/dashboard');
  const text = (await page.locator('#dashboard').innerText()).replace(/\s/g, '');
  const hasEmoji = [...text].some((char) => {
    const cp = char.codePointAt(0) ?? 0;
    return (
      (cp >= 0x1f000 && cp <= 0x1faff) ||
      (cp >= 0x2600 && cp <= 0x27bf) ||
      (cp >= 0x2b00 && cp <= 0x2bff) ||
      (cp >= 0x1f1e6 && cp <= 0x1f1ff)
    );
  });
  expect(hasEmoji, 'dashboard renders an emoji glyph').toBe(false);
});

test('leaves exactly one active container when navigating away and back', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'Profile' }).click();
  await expect(page.locator('#profile.active')).toBeVisible();
  await expect(page.locator('#dashboard')).toHaveCount(0);

  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.locator('#dashboard.active')).toBeVisible();
  await expect(page.locator('#dashboard')).toHaveCount(1);
});
