import { expect, test } from '@playwright/test';

test('starts in guest mode and exposes every dashboard section', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/FIRE OS/);
  await expect(page.locator('#auth-screen-root')).toBeHidden();
  await expect(page.getByRole('link', { name: 'Profile' })).toBeVisible();

  for (const section of ['profile', 'dashboard', 'calculators', 'insurance', 'plan', 'esop']) {
    await page.goto(`/${section}`);
    await expect(page.locator(`#${section}.active`)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/${section}$`));
  }
});

test('loads the authenticated portfolio when credentials are provided', async ({ page }) => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, 'E2E credentials not configured');

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#auth-screen-root')).toBeVisible();
  await page.locator('#login-email').fill(process.env.E2E_EMAIL!);
  await page.locator('#login-password').fill(process.env.E2E_PASSWORD!);
  await page.locator('#login-submit').click();

  await expect(page.locator('#auth-screen-root')).toBeHidden({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Portfolio Profile' })).toBeVisible();

  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.locator('#dashboard')).toBeVisible();
  await expect(page.getByText('Total Net Worth')).toBeVisible();
});
