import { expect, test } from '@playwright/test';

/**
 * Phase C shared UI kit.
 *
 * The trap this file exists for: unlayered legacy CSS (`global.css`,
 * `layout.css`) outranks every Tailwind utility regardless of specificity, so a
 * utility can compile, ship, and still do nothing. That is not detectable by
 * grepping the built CSS, so these assertions read the *computed* style of a
 * real rendered element.
 *
 * The components are exercised on the error boundary because it is a genuine
 * always-mounted surface. It renders the kit's Card and Button in their real
 * cascade context.
 */

/** Read a resolved length in px, which is what a zeroed-out utility looks like. */
async function computedLength(locator: import('@playwright/test').Locator, property: string) {
  return locator.evaluate(
    (el, prop) => Number.parseFloat(getComputedStyle(el).getPropertyValue(prop)),
    property,
  );
}

test.describe('shared UI kit', () => {
  test.beforeEach(async ({ page }) => {
    // Force the route error boundary to render: any throw inside a child is
    // caught and the kit-rendered fallback replaces the route content.
    await page.addInitScript(() => {
      (window as unknown as { __forceRouteError?: boolean }).__forceRouteError = true;
    });
    await page.goto('/plan');
  });

  test('kit utilities beat the unlayered legacy CSS', async ({ page }) => {
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();

    // Card declares p-6. If a legacy rule zeroed padding this reads 0.
    expect(await computedLength(alert, 'padding-top')).toBeGreaterThan(0);
    expect(await computedLength(alert, 'padding-left')).toBeGreaterThan(0);

    // Card declares a 1px border via border-(--color-border). A missing token
    // would compile to nothing and leave the default medium border.
    expect(await computedLength(alert, 'border-top-width')).toBeGreaterThan(0);
  });

  test('button variants resolve their token colours', async ({ page }) => {
    const retry = page.getByRole('button', { name: 'Try again' });
    await expect(retry).toBeVisible();

    // A transparent secondary button must actually be transparent, which fails
    // if `bg-transparent` lost the cascade to a legacy background rule.
    const background = await retry.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(background === 'rgba(0, 0, 0, 0)' || background === 'transparent').toBe(true);

    // cursor-pointer is a checklist requirement on every clickable element.
    expect(await retry.evaluate((el) => getComputedStyle(el).cursor)).toBe('pointer');
  });

  test('kit controls keep a visible focus ring', async ({ page }) => {
    const retry = page.getByRole('button', { name: 'Try again' });
    const outline = await retry.evaluate((el) => {
      el.focus();
      return getComputedStyle(el).outlineStyle;
    });
    expect(outline).not.toBe('none');
  });
});
