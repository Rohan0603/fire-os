import { expect, test } from '@playwright/test';

test('starts in guest mode and exposes every dashboard section', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/FIRE OS/);
  await expect(page.locator('#auth-screen-root')).toBeHidden();
  await expect(page.getByRole('link', { name: 'Profile' })).toBeVisible();

  for (const section of [
    'profile',
    'dashboard',
    'calculators',
    'insurance',
    'plan',
    'esop',
    'assistant',
  ]) {
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

test('keeps profile controls usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/profile');

  await expect(page.getByRole('heading', { name: 'Portfolio Profile' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Liabilities' })).toBeVisible();
  await page.getByRole('button', { name: '+ Add Liability' }).click();
  await page.locator('#liability-name-1').fill('Home loan');
  await page.locator('#liability-amount-1').fill('500000');
  await page.locator('.edit-liability-btn').click();
  await page.locator('.edit-liability-btn').click();
  await page.locator('#liability-amount-1').fill('450000');
  await page.locator('.edit-liability-btn').click();
  await page.locator('.delete-liability-btn').click();
  await expect(page.locator('#liability-name-1')).toHaveCount(0);
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
});
