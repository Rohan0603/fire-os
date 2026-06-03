const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Capture console logs and errors
  page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => console.log(`[ERROR] ${err.message}`));
  
  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  
  // Wait a bit for rendering
  await page.waitForTimeout(2000);
  
  console.log('\n=== PAGE CONTENT CHECK ===');
  
  // Check if profile tab content exists
  const profileContent = await page.evaluate(() => {
    const el = document.getElementById('profile');
    return el ? {
      html: el.innerHTML.substring(0, 200),
      isEmpty: el.innerHTML.trim().length === 0,
      children: el.children.length
    } : null;
  });
  console.log('Profile tab:', JSON.stringify(profileContent, null, 2));
  
  // Check if dashboard tab content exists
  const dashboardContent = await page.evaluate(() => {
    const el = document.getElementById('dashboard');
    return el ? {
      html: el.innerHTML.substring(0, 200),
      isEmpty: el.innerHTML.trim().length === 0,
      children: el.children.length
    } : null;
  });
  console.log('Dashboard tab:', JSON.stringify(dashboardContent, null, 2));
  
  // Check if calculators tab content exists
  const calculatorsContent = await page.evaluate(() => {
    const el = document.getElementById('calculators');
    return el ? {
      html: el.innerHTML.substring(0, 200),
      isEmpty: el.innerHTML.trim().length === 0,
      children: el.children.length
    } : null;
  });
  console.log('Calculators tab:', JSON.stringify(calculatorsContent, null, 2));
  
  // Check app container
  const appContent = await page.evaluate(() => {
    const el = document.getElementById('app');
    return el ? {
      exists: true,
      innerHTML: el.innerHTML.substring(0, 500)
    } : { exists: false };
  });
  console.log('\nApp container:', JSON.stringify(appContent, null, 2));
  
  // Take screenshot
  await page.screenshot({ path: 'C:\\Users\\ponna\\Project\\fire-os\\screenshot.png' });
  console.log('\n✓ Screenshot saved to screenshot.png');
  
  await browser.close();
})();
