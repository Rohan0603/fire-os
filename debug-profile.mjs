import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();

// Intercept all console messages
const consoleLogs = [];
page.on('console', msg => {
  consoleLogs.push({ type: msg.type(), args: msg.args().length, text: msg.text() });
  if (msg.type() === 'error') {
    console.log(`[ERROR] ${msg.text()}`);
  }
});

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Check what's actually in the profile div
const profileHTML = await page.evaluate(() => {
  const el = document.getElementById('profile');
  return el ? el.innerHTML.substring(0, 500) : 'ELEMENT_NOT_FOUND';
});

console.log('Profile div HTML (first 500 chars):');
console.log(profileHTML);

// Check if there are any script errors
const hasErrors = consoleLogs.some(log => log.type === 'error');
console.log('\nConsole errors?', hasErrors ? 'YES' : 'NO');

console.log('\n=== Console Activity ===');
consoleLogs.slice(-20).forEach(log => {
  console.log(`[${log.type}] ${log.text}`);
});

await browser.close();
