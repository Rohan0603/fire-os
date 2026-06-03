import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const check = await page.evaluate(() => {
  return {
    profile: { exists: !!document.getElementById('profile'), empty: document.getElementById('profile')?.innerHTML.trim().length === 0 },
    dashboard: { exists: !!document.getElementById('dashboard'), empty: document.getElementById('dashboard')?.innerHTML.trim().length === 0 },
    calculators: { exists: !!document.getElementById('calculators'), empty: document.getElementById('calculators')?.innerHTML.trim().length === 0 },
  };
});

console.log('PROFILE TAB:', check.profile.empty ? '❌ EMPTY' : '✓ HAS CONTENT');
console.log('DASHBOARD TAB:', check.dashboard.empty ? '❌ EMPTY' : '✓ HAS CONTENT');
console.log('CALCULATORS TAB:', check.calculators.empty ? '❌ EMPTY' : '✓ HAS CONTENT');

// Show a snippet
const profileHTML = await page.evaluate(() => document.getElementById('profile')?.innerHTML.substring(0, 150));
console.log('\nProfile snippet:', profileHTML);

await browser.close();
