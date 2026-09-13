import { expect, test } from '@playwright/test';

test('renders the authentication shell', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/FIRE OS/);
  await expect(page.locator('#auth-screen-root')).toBeVisible();
  await expect(page.locator('#login-form')).toBeVisible();
  await expect(page.locator('#login-email')).toBeVisible();
  await expect(page.locator('#login-password')).toBeVisible();
});

test('loads the authenticated portfolio when credentials are provided', async ({ page }) => {

  await page.goto('/');
  await page.locator('#login-email').fill("playwright_test@gmail.com");
  await page.locator('#login-password').fill("123456789");
  await page.locator('#login-submit').click();

  await expect(page.locator('#auth-screen-root')).toBeHidden({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Portfolio Profile' })).toBeVisible();

  await page.getByRole('button', { name: 'Dashboard' }).click();
  await expect(page.locator('#dashboard')).toBeVisible();
  await expect(page.getByText('Total Net Worth')).toBeVisible();
});
