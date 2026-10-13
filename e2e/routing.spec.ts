import { expect, test } from '@playwright/test';

const SECTIONS = ['profile', 'dashboard', 'calculators', 'insurance', 'plan', 'esop', 'assistant'];

test('every route resolves on a cold load and keeps its container id and active class', async ({
  page,
}) => {
  for (const section of SECTIONS) {
    const path = section === 'profile' ? '/' : `/${section}`;
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/' : `${path}$`}`));
    const container = page.locator(`#${section}`);
    await expect(container).toBeVisible();
    await expect(container).toHaveClass(/active/);
  }
});

test('a migrated route leaves no active legacy container underneath it', async ({ page }) => {
  // `goals` is rendered by React, so it is not in the feature registry. Navigating
  // to it must still deactivate the legacy tab that was showing, otherwise the
  // Assistant container renders below the Goals wizard.
  await page.goto('/assistant');
  await expect(page.locator('#legacy-tabs .tab.active')).toHaveCount(1);

  await page.goto('/goals');
  await expect(page.locator('#goals')).toBeVisible();
  await expect(page.locator('#legacy-tabs .tab.active')).toHaveCount(0);
});

test('marks routes not yet migrated without claiming their container id', async ({ page }) => {
  await page.goto('/esop');
  // The legacy compat bridge still owns #esop and its `active` class; React must
  // not render a second element with the same id.
  await expect(page.locator('[data-route="esop"]')).toHaveAttribute(
    'data-migration-state',
    'placeholder',
  );
  await expect(page.locator('#esop')).toHaveCount(1);
});
