import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const navTabs = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.nav-tab'));
    return buttons.map(b => b.textContent?.trim());
  });

  console.log('=== NAV TABS ===');
  navTabs.forEach(tab => console.log(`  ${tab}`));

  // Check if ESOP is in nav (should NOT be)
  const hasESOP = navTabs.includes('ESOP Tools');
  console.log(`\n✓ FIX #1: ESOP removed from nav? ${!hasESOP ? 'YES ✓' : 'NO ✗'}`);

  // Check if Watchdog is in nav (should be)
  const hasWatchdog = navTabs.includes('Watchdog');
  console.log(`✓ FIX #2: Watchdog tab appears? ${hasWatchdog ? 'YES ✓' : 'NO ✗'}`);

  await browser.close();
})();
