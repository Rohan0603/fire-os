import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();

// Capture ALL console activity
const allLogs = [];
page.on('console', msg => {
  allLogs.push({ type: msg.type(), text: msg.text() });
  if (msg.type() === 'error' || msg.type() === 'warn') {
    console.log(`[${msg.type()}] ${msg.text()}`);
  }
});

console.log('Navigating...');
await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Check what happened in each module init
console.log('\n=== CHECKING MODULE INITIALIZATION ===');

const moduleCheck = await page.evaluate(() => {
  const checks = {
    profileEl: document.getElementById('profile'),
    dashEl: document.getElementById('dashboard'),
    calcEl: document.getElementById('calculators'),
    authEl: document.getElementById('auth-screen'),
  };
  
  return {
    profileExists: !!checks.profileEl,
    profileEmpty: checks.profileEl?.innerHTML.trim().length === 0,
    dashboardExists: !!checks.dashEl,
    dashboardEmpty: checks.dashEl?.innerHTML.trim().length === 0,
    calcExists: !!checks.calcEl,
    calcEmpty: checks.calcEl?.innerHTML.trim().length === 0,
    authEmpty: checks.authEl?.innerHTML.trim().length === 0,
  };
});

console.log('Module check:', JSON.stringify(moduleCheck, null, 2));

// Check for any errors in console
console.log('\n=== ALL CONSOLE LOGS (errors/warns only) ===');
const filteredLogs = allLogs.filter(l => l.type === 'error' || l.type === 'warn');
if (filteredLogs.length > 0) {
  filteredLogs.forEach(log => console.log(`[${log.type}] ${log.text}`));
} else {
  console.log('No errors or warnings');
}

await browser.close();
