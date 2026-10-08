import { expect, test } from '@playwright/test';

// With Firebase configured, the auth screen must offer the real sign-in paths and must
// NOT show the guest-only notice. The unconfigured path is covered by the unit test in
// src/modules/auth/firebaseAuth.test.ts, because it needs a server started without
// VITE_FIREBASE_*.
test.describe('auth screen with Firebase configured', () => {
  test('offers sign-in controls and hides the guest-only notice', async ({ page }) => {
    await page.goto('/');
    await page.locator('#logout-btn').click();
    const root = page.locator('#auth-screen-root');
    await expect(root).toBeVisible();

    await expect(page.locator('#auth-unavailable')).toHaveCount(0);
    await expect(page.locator('#login-submit')).toBeEnabled();
    await expect(page.locator('#login-google')).toBeEnabled();
    await expect(page.locator('#signup-google')).toBeEnabled();
  });

  test('the Google control is wired up, not inert', async ({ page }) => {
    await page.goto('/');
    await page.locator('#logout-btn').click();
    await expect(page.locator('#login-google')).toBeEnabled();
    // aria-disabled is what the guest-only path sets; its absence proves the real
    // listener path is in use.
    await expect(page.locator('#login-google')).not.toHaveAttribute('aria-disabled', 'true');
  });
});
