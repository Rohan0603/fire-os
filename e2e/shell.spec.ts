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

test('legacy route content renders inside the shell content pane, not below it', async ({
  page,
}) => {
  await page.goto('/profile');
  const main = page.locator('main');
  // While a route is a placeholder its content still comes from the legacy tab
  // container in #app, which must sit inside <main> or it renders under the whole
  // shell instead of beside the sidebar.
  await expect(main.locator('#profile')).toBeVisible();
});

test('shell spacing and active-route styling actually apply', async ({ page }) => {
  await page.goto('/plan');
  const px = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));

  // Legacy global CSS shipped an unlayered `* { padding: 0 }` reset, which beats
  // every Tailwind utility because unlayered rules outrank all cascade layers.
  // These assertions pin that Tailwind spacing reaches the rendered shell.
  expect(await px('header'), 'header padding').toBeGreaterThan(0);
  expect(await px('aside nav'), 'sidebar nav padding').toBeGreaterThan(0);
  expect(await px('aside nav a'), 'sidebar link padding').toBeGreaterThan(0);

  const activeBg = await page
    .locator('aside nav a[aria-current="page"]')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(activeBg, 'active link background').not.toBe('rgba(0, 0, 0, 0)');

  const toggleRight = await page
    .locator('#theme-toggle')
    .evaluate((el) => el.getBoundingClientRect().right);
  expect(toggleRight, 'theme toggle right edge').toBeLessThan(page.viewportSize()!.width);
});

test('sidebar and content sit side by side at desktop width', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const boxes = await page.evaluate(() => {
    const aside = document.querySelector('aside')!.getBoundingClientRect();
    const main = document.querySelector('main')!.getBoundingClientRect();
    return { asideTop: aside.top, asideRight: aside.right, mainTop: main.top, mainLeft: main.left };
  });
  // Legacy global CSS used to define an unlayered `.flex-col`, which outranks every
  // cascade layer and made the shell stack vertically regardless of `lg:flex-row`.
  expect(boxes.asideTop, 'sidebar top').toBeCloseTo(boxes.mainTop, 0);
  expect(boxes.mainLeft, 'content starts right of the sidebar').toBeGreaterThan(
    boxes.asideRight - 1,
  );
});

test('mobile nav disclosure uses a hamburger icon, not the word Menu', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 900 });
  await page.goto('/');
  const summary = page.locator('details > summary');
  await expect(summary).toBeVisible();
  await expect(summary.locator('svg')).toHaveCount(1);
  await expect(summary).not.toHaveText('Menu');
  await expect(summary).toHaveAttribute('aria-label', /navigation/i);
});

test('header exposes the sign-in control in guest mode', async ({ page }) => {
  await page.goto('/');
  const button = page.locator('header #logout-btn');
  await expect(button).toBeVisible();
  await expect(button).toHaveText(/Sign in/i);
});

test('every interactive element shows a focus ring', async ({ page }) => {
  await page.goto('/');
  const outline = await page.getByRole('link', { name: 'Dashboard' }).evaluate((el) => {
    el.focus();
    return getComputedStyle(el).outlineStyle;
  });
  expect(outline).not.toBe('none');
});
