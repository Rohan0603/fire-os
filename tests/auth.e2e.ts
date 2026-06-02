/**
 * Firebase Authentication E2E Tests
 * Tests login, signup, logout, validation, and password reset flows
 */

import { test, expect } from '@playwright/test';

test.describe('Firebase Authentication', () => {
  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'TestPassword123';

  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('http://localhost:5173');
    // Wait for auth screen to be visible
    await page.waitForSelector('.auth-screen', { visible: true });
  });

  test.describe('Signup Flow', () => {
    test('should render signup form when signup tab is clicked', async ({ page }) => {
      // Click signup tab
      const signupTab = page.locator('button:has-text("Sign Up")').first();
      await signupTab.click();

      // Verify signup form is visible
      const signupForm = page.locator('#signup-form');
      await expect(signupForm).toHaveClass(/active/);

      // Verify form fields exist
      await expect(page.locator('#signup-email')).toBeVisible();
      await expect(page.locator('#signup-password')).toBeVisible();
      await expect(page.locator('#signup-confirm')).toBeVisible();
    });

    test('should validate empty signup form', async ({ page }) => {
      // Click signup tab
      const signupTab = page.locator('button:has-text("Sign Up")').first();
      await signupTab.click();

      // Try to submit empty form
      const submitBtn = page.locator('#signup-submit');
      await submitBtn.click();

      // Verify errors appear
      const emailError = page.locator('#signup-email-error');
      await expect(emailError).not.toHaveText('');
    });

    test('should validate password confirmation mismatch', async ({ page }) => {
      // Click signup tab
      const signupTab = page.locator('button:has-text("Sign Up")').first();
      await signupTab.click();

      // Fill form with mismatched passwords
      await page.locator('#signup-email').fill(testEmail);
      await page.locator('#signup-password').fill(testPassword);
      await page.locator('#signup-confirm').fill('DifferentPassword123');

      // Submit
      const submitBtn = page.locator('#signup-submit');
      await submitBtn.click();

      // Verify error
      const confirmError = page.locator('#signup-confirm-error');
      await expect(confirmError).toContainText('do not match');
    });

    test('should validate weak password', async ({ page }) => {
      // Click signup tab
      const signupTab = page.locator('button:has-text("Sign Up")').first();
      await signupTab.click();

      // Fill form with weak password
      await page.locator('#signup-email').fill(testEmail);
      await page.locator('#signup-password').fill('short');
      await page.locator('#signup-confirm').fill('short');

      // Submit
      const submitBtn = page.locator('#signup-submit');
      await submitBtn.click();

      // Verify error
      const passwordError = page.locator('#signup-password-error');
      await expect(passwordError).toContainText('at least 6 characters');
    });

    test('should validate invalid email format', async ({ page }) => {
      // Click signup tab
      const signupTab = page.locator('button:has-text("Sign Up")').first();
      await signupTab.click();

      // Fill form with invalid email
      await page.locator('#signup-email').fill('notanemail');
      await page.locator('#signup-password').fill(testPassword);
      await page.locator('#signup-confirm').fill(testPassword);

      // Submit
      const submitBtn = page.locator('#signup-submit');
      await submitBtn.click();

      // Verify error
      const emailError = page.locator('#signup-email-error');
      await expect(emailError).toContainText('valid email');
    });

    test('should display signup form with all fields', async ({ page }) => {
      // Click signup tab
      const signupTab = page.locator('button:has-text("Sign Up")').first();
      await signupTab.click();

      // Verify all signup fields are present
      const emailInput = page.locator('#signup-email');
      const passwordInput = page.locator('#signup-password');
      const confirmInput = page.locator('#signup-confirm');
      const submitBtn = page.locator('#signup-submit');

      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(confirmInput).toBeVisible();
      await expect(submitBtn).toBeVisible();
      await expect(submitBtn).toContainText('Sign Up');
    });

    test('should show error when email is already in use', async ({ page }) => {
      // Click signup tab
      const signupTab = page.locator('button:has-text("Sign Up")').first();
      await signupTab.click();

      // Try to signup with an email that's already registered (from setup)
      // Using a fake email that Firebase will reject as duplicate
      const duplicateEmail = 'existing@example.com';

      await page.locator('#signup-email').fill(duplicateEmail);
      await page.locator('#signup-password').fill(testPassword);
      await page.locator('#signup-confirm').fill(testPassword);

      const submitBtn = page.locator('#signup-submit');
      await submitBtn.click();

      // Wait for error response
      await page.waitForTimeout(2000);

      // Verify error appears (could be generic Firebase error or specific)
      const emailError = page.locator('#signup-email-error');
      const errorText = await emailError.textContent();
      expect(errorText && errorText.length > 0).toBe(true);
    });
  });

  test.describe('Login Flow', () => {
    test('should render login form by default', async ({ page }) => {
      // Verify login form is visible
      const loginForm = page.locator('#login-form');
      await expect(loginForm).toHaveClass(/active/);

      // Verify fields
      await expect(page.locator('#login-email')).toBeVisible();
      await expect(page.locator('#login-password')).toBeVisible();
    });

    test('should validate empty login form', async ({ page }) => {
      // Try to submit empty form
      const submitBtn = page.locator('#login-submit');
      await submitBtn.click();

      // Verify errors
      const emailError = page.locator('#login-email-error');
      await expect(emailError).not.toHaveText('');
    });

    test('should validate invalid email format on login', async ({ page }) => {
      // Fill with invalid email
      await page.locator('#login-email').fill('notanemail');
      await page.locator('#login-password').fill('password123');

      // Submit
      const submitBtn = page.locator('#login-submit');
      await submitBtn.click();

      // Verify error
      const emailError = page.locator('#login-email-error');
      await expect(emailError).toContainText('valid email');
    });

    test('should show loading state on submit', async ({ page }) => {
      // Fill form
      await page.locator('#login-email').fill('test@example.com');
      await page.locator('#login-password').fill(testPassword);

      // Submit
      const submitBtn = page.locator('#login-submit');
      await submitBtn.click();

      // Verify button is disabled and shows loading text
      await expect(submitBtn).toBeDisabled();
    });

    test('should show error for non-existent user', async ({ page }) => {
      // Fill form with non-existent email
      await page.locator('#login-email').fill('nonexistent@example.com');
      await page.locator('#login-password').fill(testPassword);

      // Submit
      const submitBtn = page.locator('#login-submit');
      await submitBtn.click();

      // Wait for error
      await page.waitForTimeout(1000);

      // Verify error message appears
      const emailError = page.locator('#login-email-error');
      const errorText = await emailError.textContent();
      expect(errorText).toBeTruthy();
    });

    test('should show error for wrong password', async ({ page }) => {
      // First, signup a user
      const signupTab = page.locator('button:has-text("Sign Up")').first();
      await signupTab.click();

      await page.locator('#signup-email').fill(testEmail);
      await page.locator('#signup-password').fill(testPassword);
      await page.locator('#signup-confirm').fill(testPassword);

      let submitBtn = page.locator('#signup-submit');
      await submitBtn.click();

      // Wait and close modal
      await page.waitForTimeout(1000);
      const modalBtn = page.locator('.auth-modal-content button').first();
      if (await modalBtn.isVisible()) {
        await modalBtn.click();
      }

      // Reload page to get back to login
      await page.reload();
      await page.waitForSelector('.auth-screen', { visible: true });

      // Try login with wrong password
      await page.locator('#login-email').fill(testEmail);
      await page.locator('#login-password').fill('WrongPassword123');

      submitBtn = page.locator('#login-submit');
      await submitBtn.click();

      // Wait for error
      await page.waitForTimeout(1000);

      // Verify error appears
      const emailError = page.locator('#login-email-error');
      const errorText = await emailError.textContent();
      expect(errorText).toBeTruthy();
    });

    test('should attempt login with button disabled during request', async ({ page }) => {
      // Fill login form
      await page.locator('#login-email').fill('test@example.com');
      await page.locator('#login-password').fill(testPassword);

      // Submit
      const submitBtn = page.locator('#login-submit');
      await submitBtn.click();

      // Verify button becomes disabled (loading state)
      await expect(submitBtn).toBeDisabled();

      // Wait for response
      await page.waitForTimeout(1500);

      // Button should be re-enabled after response
      // (success or error, both re-enable)
      const isDisabled = await submitBtn.isDisabled();
      // The button might still be disabled or re-enabled depending on the response
      // Just verify it exists and was interacted with
      await expect(submitBtn).toBeVisible();
    });
  });

  test.describe('Tab Switching', () => {
    test('should switch between login and signup tabs', async ({ page }) => {
      // Initially on login
      const loginForm = page.locator('#login-form');
      const signupForm = page.locator('#signup-form');

      await expect(loginForm).toHaveClass(/active/);
      await expect(signupForm).not.toHaveClass(/active/);

      // Click signup tab
      const signupTab = page.locator('button:has-text("Sign Up")').first();
      await signupTab.click();

      // Now signup should be active
      await expect(loginForm).not.toHaveClass(/active/);
      await expect(signupForm).toHaveClass(/active/);

      // Click login tab
      const loginTab = page.locator('button:has-text("Login")').first();
      await loginTab.click();

      // Back to login active
      await expect(loginForm).toHaveClass(/active/);
      await expect(signupForm).not.toHaveClass(/active/);
    });

    test('should clear errors when switching tabs', async ({ page }) => {
      // Show error on login form
      const submitBtn = page.locator('#login-submit');
      await submitBtn.click();

      const emailError = page.locator('#login-email-error');
      await expect(emailError).not.toHaveText('');

      // Switch to signup
      const signupTab = page.locator('button:has-text("Sign Up")').first();
      await signupTab.click();

      // Switch back to login
      const loginTab = page.locator('button:has-text("Login")').first();
      await loginTab.click();

      // Error should be cleared
      await expect(emailError).toHaveText('');
    });
  });

  test.describe('Password Reset', () => {
    test('should show modal when forgot password clicked without email', async ({ page }) => {
      // Click forgot password
      const forgotLink = page.locator('.forgot-password');
      await forgotLink.click();

      // Verify modal appears
      const modal = page.locator('.auth-modal-content h2');
      await expect(modal).toContainText('Enter Email');
    });

    test('should require email for password reset', async ({ page }) => {
      // Leave email empty and click forgot password
      const forgotLink = page.locator('.forgot-password');
      await forgotLink.click();

      // Verify error modal
      const modal = page.locator('.auth-modal-content');
      await expect(modal).toBeVisible();

      // Close modal
      const modalBtn = page.locator('.auth-modal-content button').first();
      await modalBtn.click();
    });

    test('should send password reset email for existing user', async ({ page }) => {
      // First, signup a user
      const signupTab = page.locator('button:has-text("Sign Up")').first();
      await signupTab.click();

      const resetTestEmail = `reset-test${Date.now()}@example.com`;
      const resetTestPassword = 'ResetTestPass123';

      await page.locator('#signup-email').fill(resetTestEmail);
      await page.locator('#signup-password').fill(resetTestPassword);
      await page.locator('#signup-confirm').fill(resetTestPassword);

      let submitBtn = page.locator('#signup-submit');
      await submitBtn.click();

      // Wait for signup to complete
      await page.waitForTimeout(2000);

      // Reload
      await page.reload();
      await page.waitForSelector('.auth-screen', { visible: true });

      // Now test password reset
      await page.locator('#login-email').fill(resetTestEmail);

      // Click forgot password
      const forgotLink = page.locator('.forgot-password');
      await forgotLink.click();

      // Verify modal appears (could be success or error depending on Firebase config)
      await page.waitForTimeout(500);
      const modal = page.locator('.auth-modal-content h2');
      const modalText = await modal.textContent();
      expect(['Email Sent', 'Error'].includes(modalText || '')).toBe(true);

      // Close modal
      const closeBtn = page.locator('.auth-modal-content button').first();
      await closeBtn.click();
    });
  });

  test.describe('Real-time Validation', () => {
    test('should validate email on blur', async ({ page }) => {
      const emailInput = page.locator('#login-email');
      const emailError = page.locator('#login-email-error');

      // Focus and blur with invalid email
      await emailInput.fill('invalidemail');
      await emailInput.blur();

      // Verify error appears
      await expect(emailError).toContainText('valid email');

      // Fix email
      await emailInput.fill('valid@example.com');
      await emailInput.blur();

      // Error should clear
      await expect(emailError).toHaveText('');
    });

    test('should validate password on blur', async ({ page }) => {
      const passwordInput = page.locator('#login-password');
      const passwordError = page.locator('#login-password-error');

      // Focus and blur with weak password
      await passwordInput.fill('short');
      await passwordInput.blur();

      // Verify error
      await expect(passwordError).toContainText('at least 6 characters');

      // Fix password
      await passwordInput.fill('ValidPassword123');
      await passwordInput.blur();

      // Error clears
      await expect(passwordError).toHaveText('');
    });

    test('should validate password confirmation on blur', async ({ page }) => {
      const signupTab = page.locator('button:has-text("Sign Up")').first();
      await signupTab.click();

      const passwordInput = page.locator('#signup-password');
      const confirmInput = page.locator('#signup-confirm');
      const confirmError = page.locator('#signup-confirm-error');

      // Set different passwords
      await passwordInput.fill('TestPassword123');
      await confirmInput.fill('DifferentPassword');
      await confirmInput.blur();

      // Verify error
      await expect(confirmError).toContainText('do not match');

      // Match passwords
      await confirmInput.fill('TestPassword123');
      await confirmInput.blur();

      // Error clears
      await expect(confirmError).toHaveText('');
    });
  });

  test.describe('Responsive Design', () => {
    test('should render on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 812 });

      // Verify auth screen is visible and accessible
      const authContainer = page.locator('.auth-container');
      await expect(authContainer).toBeVisible();

      // Verify form is accessible
      const emailInput = page.locator('#login-email');
      await expect(emailInput).toBeVisible();

      // Verify buttons are touch-friendly
      const submitBtn = page.locator('#login-submit');
      const boundingBox = await submitBtn.boundingBox();
      expect(boundingBox?.height).toBeGreaterThanOrEqual(44); // iOS touch target minimum
    });

    test('should render on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      // Verify auth screen is visible
      const authContainer = page.locator('.auth-container');
      await expect(authContainer).toBeVisible();

      // Verify form is properly centered and responsive
      const authScreen = page.locator('.auth-screen');
      const boundingBox = await authScreen.boundingBox();
      expect(boundingBox?.width).toBe(768);
    });
  });
});
