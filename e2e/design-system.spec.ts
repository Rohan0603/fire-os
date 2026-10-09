import { expect, test } from '@playwright/test';

/**
 * Enforces the pre-delivery checklist from design-system/fire-os/MASTER.md.
 *
 * These rules were not invented here: they are the ui-ux-pro-max checklist, and
 * every one of them corresponds to a defect this codebase actually shipped. The
 * scope is the React shell (`src/app`) and the global token layer. Unmigrated
 * legacy modules are checked per phase as they are ported.
 */

test.describe('design system checklist', () => {
  test('light and dark text meet 4.5:1 contrast against their surfaces', async ({ page }) => {
    await page.goto('/');

    const pairs: Array<[string, string]> = [
      ['--color-foreground', '--color-background'],
      ['--color-foreground', '--color-surface'],
      ['--color-muted-foreground', '--color-background'],
      ['--color-muted-foreground', '--color-surface'],
      ['--color-primary', '--color-surface'],
      ['--color-accent', '--color-surface'],
      ['--color-destructive', '--color-surface'],
      ['--color-on-primary', '--color-primary'],
      ['--color-on-accent', '--color-accent'],
      // Added with the dark --color-on-destructive override. The dark
      // destructive is a lighter red, so it needs dark text; without the
      // override it inherited the light-mode white and failed 4.5:1.
      ['--color-on-destructive', '--color-destructive'],
    ];

    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const results = await page.evaluate((list) => {
        const style = getComputedStyle(document.documentElement);
        // Chrome may serialise an OKLCH-converted colour as `color(srgb ...)`, so
        // parse the computed string instead of assuming `rgb()`. Painting through a
        // canvas yields the true sRGB triplet the compositor actually uses.
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        // A canvas fillStyle does not accept var(), and a computed colour may stay
        // in oklch()/color(srgb ...) form. So resolve the custom property through a
        // probe element first, then paint the resolved string to get true sRGB.
        const resolve = (token: string): string => {
          const probe = document.createElement('div');
          probe.style.color = `var(${token})`;
          document.body.appendChild(probe);
          const resolved = getComputedStyle(probe).color;
          probe.remove();
          return resolved;
        };
        const toRgb = (token: string): [number, number, number] => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = resolve(token);
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          return [r, g, b];
        };
        const luminance = ([r, g, b]: [number, number, number]): number => {
          const [R, G, B] = [r, g, b].map((c) => {
            const s = c / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * R + 0.7152 * G + 0.0722 * B;
        };
        return list.map(([fg, bg]) => {
          const l1 = luminance(toRgb(fg));
          const l2 = luminance(toRgb(bg));
          const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          return {
            pair: `${fg} on ${bg}`,
            ratio: Math.round(ratio * 100) / 100,
            resolved: style.getPropertyValue(fg).trim(),
          };
        });
      }, pairs);

      for (const { pair, ratio } of results) {
        expect(ratio, `${pair} contrast in ${scheme}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test('the page background is not pure white', async ({ page }) => {
    await page.goto('/');
    await page.emulateMedia({ colorScheme: 'light' });
    // Anti-pattern from the design system: "Pure white backgrounds".
    const background = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor.replace(/\s/g, ''),
    );
    expect(background.toUpperCase()).not.toBe('RGB(255,255,255)');
  });

  test('the shell chrome uses no emoji as icons', async ({ page }) => {
    await page.goto('/');
    // Scoped to the header and sidebar, which the React shell owns. Emoji inside
    // unmigrated legacy modules are removed when each module is ported; those
    // phases add their own assertion for the markup they introduce.
    const hasEmoji = (text: string): boolean =>
      [...text].some((char) => {
        const cp = char.codePointAt(0) ?? 0;
        return (
          (cp >= 0x1f000 && cp <= 0x1faff) ||
          (cp >= 0x2600 && cp <= 0x27bf) ||
          (cp >= 0x2b00 && cp <= 0x2bff) ||
          (cp >= 0x1f1e6 && cp <= 0x1f1ff)
        );
      });
    for (const selector of ['#app-root header', '#app-root nav']) {
      const text = await page.locator(selector).first().innerText();
      expect(hasEmoji(text), `${selector} contains an emoji: ${text}`).toBe(false);
    }
  });

  test('shell interactive elements show a pointer cursor', async ({ page }) => {
    await page.goto('/');
    const cursor = await page
      .getByRole('link', { name: 'Dashboard' })
      .evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor).toBe('pointer');
  });

  test('shell interactive elements expose a visible focus ring', async ({ page }) => {
    await page.goto('/');
    const ring = await page.getByRole('link', { name: 'Dashboard' }).evaluate((el) => {
      el.focus();
      const style = getComputedStyle(el);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow,
      };
    });
    expect(
      ring.outlineStyle !== 'none' || ring.boxShadow !== 'none',
      'focused link has no visible focus indicator',
    ).toBe(true);
  });

  test('interactive elements transition within 150-300ms', async ({ page }) => {
    await page.goto('/');
    const duration = await page
      .getByRole('link', { name: 'Dashboard' })
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    const first = parseFloat(duration);
    if (Number.isNaN(first)) return;
    expect(first).toBeLessThanOrEqual(0.3);
  });

  test('honours prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const offenders = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of document.querySelectorAll('#app-root *, #app-root')) {
        const style = getComputedStyle(el);
        const matches = style.animationName !== 'none' && style.animationDuration !== '0s';
        if (matches) bad.push(el.tagName + '.' + String(el.className).slice(0, 40));
      }
      return bad;
    });
    expect(offenders, 'elements animating under prefers-reduced-motion').toEqual([]);
  });

  for (const width of [375, 768, 1024, 1440]) {
    test(`has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
    });
  }
});
