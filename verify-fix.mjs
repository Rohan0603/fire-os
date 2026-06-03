import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();

const errors = [];
page.on('console', msg => {
  const text = msg.text();
  if (msg.type() === 'error') errors.push(text);
  console.log(`[${msg.type()}] ${text}`);
});
page.on('pageerror', err => {
  errors.push(err.message);
  console.log(`[PAGEERROR] ${err.message}`);
});

console.log('Navigating to http://localhost:5173...');
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

console.log('\n=== VERIFICATION ===');

// Check content
const profileContent = await page.evaluate(() => {
  const el = document.getElementById('profile');
  return el ? { isEmpty: el.innerHTML.trim().length === 0, chars: el.innerHTML.length } : null;
});
console.log('Profile tab empty?', profileContent?.isEmpty ? '❌ YES' : '✓ NO');

const dashContent = await page.evaluate(() => {
  const el = document.getElementById('dashboard');
  return el ? { isEmpty: el.innerHTML.trim().length === 0 } : null;
});
console.log('Dashboard tab empty?', dashContent?.isEmpty ? '❌ YES' : '✓ NO');

const calcContent = await page.evaluate(() => {
  const el = document.getElementById('calculators');
  return el ? { isEmpty: el.innerHTML.trim().length === 0 } : null;
});
console.log('Calculators tab empty?', calcContent?.isEmpty ? '❌ YES' : '✓ NO');

console.log('\nErrors on page:', errors.length === 0 ? '✓ NONE' : errors);

await browser.close();
