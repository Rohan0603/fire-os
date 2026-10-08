import { expect, test } from '@playwright/test';

// This suite runs with no VITE_FIREBASE_* values, so it exercises the guest-only
// deployment path: sign-in cannot work, and the UI must say so instead of failing.
test.describe('auth screen without Firebase configuration', () => {
  test('explains sign-in is unavailable and disables the dead-end controls', async ({ page }) => {
    await page.goto('/');
    await page.locator('#logout-btn').click();
    const root = page.locator('#auth-screen-root');
    await expect(root).toBeVisible();

    const notice = page.locator('#auth-unavailable');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(/no Firebase configuration|Sign-in is unavailable/i);

    // Guest mode is unaffected, so the notice must not read as a broken app.
    await expect(notice).toContainText(/guest mode/i);

    await expect(page.locator('#login-submit')).toBeDisabled();
    await expect(page.locator('#login-google')).toBeDisabled();
    await expect(page.locator('#signup-google')).toBeDisabled();
    await expect(page.locator('#forgot-password-link')).toHaveAttribute('aria-disabled', 'true');
  });

  test('clicking a disabled control produces no error modal', async ({ page }) => {
    await page.goto('/');
    await page.locator('#logout-btn').click();
    await expect(page.locator('#auth-unavailable')).toBeVisible();

    // Force the click past pointer-events to prove the handler is not wired up,
    // rather than merely unclickable.
    await page.locator('#login-google').click({ force: true });
    await page.waitForTimeout(400);
    await expect(page.locator('.auth-modal')).toHaveCount(0);
  });
});
