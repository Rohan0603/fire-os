import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Login first
  console.log('Logging in...');
  await page.fill('input[type="email"]', 'ponnanna06032001@gmail.com');
  await page.fill('input[type="password"]', '123456');
  
  const loginBtn = await page.locator('button:has-text("Login"):visible').first();
  await loginBtn.click();
  await page.waitForTimeout(2000);

  // Now click Calculators tab
  console.log('Clicking Calculators...');
  await page.click('[data-tab="calculators"]');
  await page.waitForTimeout(2000);

  const niftyValues = await page.evaluate(() => {
    const high = document.getElementById('nifty-high');
    const current = document.getElementById('nifty-current');
    return {
      high: high ? high.value : '',
      current: current ? current.value : ''
    };
  });

  console.log('=== NIFTY AUTO-FETCH ===');
  console.log(`Nifty 52W High: ${niftyValues.high || 'EMPTY'}`);
  console.log(`Current Nifty Level: ${niftyValues.current || 'EMPTY'}`);
  
  const populated = niftyValues.high && niftyValues.current;
  console.log(`\n✓ FIX #3: Nifty auto-populated? ${populated ? 'YES ✓' : 'NO ✗'}`);

  await browser.close();
})();
