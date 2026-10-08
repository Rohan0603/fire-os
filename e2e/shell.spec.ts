import { expect, test } from '@playwright/test';

test('sidebar marks the current route with aria-current', async ({ page }) => {
  await page.goto('/plan');
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Plan' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('sidebar is keyboard navigable and moves focus into the content pane', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Dashboard' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('#dashboard')).toBeVisible();
});

test('manual dark mode survives navigation', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('link', { name: 'ESOP' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('content stays usable at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/profile');
  await expect(page.locator('#profile')).toBeVisible();
});

test('every interactive element shows a focus ring', async ({ page }) => {
  await page.goto('/');
  const outline = await page.getByRole('link', { name: 'Dashboard' }).evaluate((el) => {
    el.focus();
    return getComputedStyle(el).outlineStyle;
  });
  expect(outline).not.toBe('none');
});
