const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:5175/', { waitUntil: 'networkidle' });

    // Get all stylesheets
    const stylesheets = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
      const styles = Array.from(document.querySelectorAll('style')).map((s, i) => `<style>${i}: ${s.textContent.substring(0, 100)}...`);
      return { links, styles };
    });

    console.log('Stylesheets loaded:');
    console.log(JSON.stringify(stylesheets, null, 2));

    // Check if profile.css rule exists
    const rules = await page.evaluate(() => {
      const rules = [];
      for (let sheet of document.styleSheets) {
        try {
          for (let rule of sheet.cssRules || []) {
            if (rule.selectorText && (rule.selectorText.includes('.form-group') || rule.selectorText.includes('input'))) {
              rules.push({
                selector: rule.selectorText,
                style: rule.style.cssText.substring(0, 100)
              });
            }
          }
        } catch (e) {
          // Can't access cross-origin stylesheets
        }
      }
      return rules;
    });

    console.log('\nCSS rules for form-group/input:');
    console.log(JSON.stringify(rules, null, 2));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
