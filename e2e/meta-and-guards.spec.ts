import { expect, test } from '@playwright/test';

const ROUTES = [
  ['/', 'Profile'],
  ['/dashboard', 'Dashboard'],
  ['/plan', 'Plan'],
  ['/esop', 'ESOP'],
  ['/assistant', 'Assistant'],
] as const;

for (const [path, heading] of ROUTES) {
  test(`sets title and description metadata for ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(new RegExp(heading, 'i'));
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description?.length ?? 0).toBeGreaterThan(20);
  });
}

test('guest mode boots on a deep route with Firebase unconfigured', async ({ page }) => {
  await page.goto('/plan');
  await expect(page.locator('#plan.active')).toBeVisible();
  await expect(page.locator('#auth-screen')).toBeHidden();
});

test('navigation updates the title to the new route', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Insurance' }).click();
  await expect(page).toHaveTitle(/Insurance/i);
});
