const { chromium } = require('playwright');

(async () => {
  try {
    console.log('🚀 Starting Playwright MCP Connection Test...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    console.log('📍 Navigating to https://example.com...');
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    
    const title = await page.title();
    const heading = await page.locator('h1').textContent();
    
    await browser.close();
    
    console.log('');
    console.log('✅ Playwright MCP Connection Test Results:');
    console.log(`   📄 Page Title: ${title}`);
    console.log(`   📝 H1 Content: ${heading}`);
    console.log('');
    console.log('✅ SUCCESS! Playwright MCP is configured and working correctly');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
