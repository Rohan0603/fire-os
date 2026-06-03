import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

// Check if auth screen is visible
const authVisible = await page.evaluate(() => {
  const authEl = document.getElementById('auth-screen');
  return authEl ? authEl.innerHTML.length > 0 : false;
});

console.log('Auth screen visible?', authVisible);

if (authVisible) {
  console.log('Attempting login...');
  
  // Wait for auth form
  await page.waitForSelector('input[type="email"]', { timeout: 5000 });
  
  // Fill email
  await page.fill('input[type="email"]', 'ponnanna06032001@gmail.com');
  console.log('✓ Email entered');
  
  // Fill password  
  await page.fill('input[type="password"]', '123456');
  console.log('✓ Password entered');
  
  // Click login button
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => ({ text: b.textContent, visible: b.offsetParent !== null }));
  });
  
  console.log('Buttons found:', buttons);
  
  const loginBtn = await page.$('button:has-text("Login")');
  if (loginBtn) {
    await loginBtn.click();
    console.log('✓ Login button clicked');
    await page.waitForTimeout(3000);
  }
  
  // Check if logged in
  const appVisible = await page.evaluate(() => {
    const profileTab = document.getElementById('profile');
    return profileTab ? profileTab.innerHTML.length > 0 : false;
  });
  
  console.log('\nAfter login:');
  console.log('App visible?', appVisible);
}

// Check all tabs
const tabs = await page.evaluate(() => {
  return {
    profile: { content: !!document.getElementById('profile')?.innerHTML.trim() },
    dashboard: { content: !!document.getElementById('dashboard')?.innerHTML.trim() },
    calculators: { content: !!document.getElementById('calculators')?.innerHTML.trim() },
  };
});

console.log('\nTab status:');
console.log('Profile:', tabs.profile.content ? '✓' : '❌');
console.log('Dashboard:', tabs.dashboard.content ? '✓' : '❌');
console.log('Calculators:', tabs.calculators.content ? '✓' : '❌');

// Click Dashboard tab
console.log('\nClicking Dashboard tab...');
await page.click('[data-tab="dashboard"]');
await page.waitForTimeout(1500);

const dashboardNow = await page.evaluate(() => {
  const dash = document.getElementById('dashboard');
  return dash ? dash.innerHTML.length > 0 : false;
});

console.log('Dashboard content after click?', dashboardNow ? '✓ YES' : '❌ NO');

// Screenshot
await page.screenshot({ path: 'C:\\Users\\ponna\\Project\\fire-os\\app-screenshot.png' });
console.log('\n✓ Screenshot saved');

await browser.close();
