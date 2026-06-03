const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:5175/', { waitUntil: 'networkidle' });
    await page.waitForSelector('#profile', { timeout: 5000 });

    // Get the input element's full HTML
    const inputHTML = await page.locator('#name').evaluate(el => {
      return {
        outerHTML: el.outerHTML,
        classList: Array.from(el.classList),
        parentClass: el.parentElement?.className,
        computedColor: window.getComputedStyle(el).color,
        computedBg: window.getComputedStyle(el).backgroundColor,
        computedBorder: window.getComputedStyle(el).borderColor
      };
    });

    console.log('Input element details:');
    console.log(JSON.stringify(inputHTML, null, 2));

    // Check if CSS variables are defined
    const cssVars = await page.evaluate(() => {
      const root = document.documentElement;
      const style = window.getComputedStyle(root);
      return {
        '--bg-primary': style.getPropertyValue('--bg-primary').trim(),
        '--text-primary': style.getPropertyValue('--text-primary').trim(),
        '--border': style.getPropertyValue('--border').trim()
      };
    });

    console.log('\nCSS Variables in DOM:');
    console.log(JSON.stringify(cssVars, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
