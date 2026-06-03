const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to app
    await page.goto('http://localhost:5175/', { waitUntil: 'networkidle' });
    console.log('✓ App loaded');

    // Wait for profile section to load
    await page.waitForSelector('#profile', { timeout: 5000 });
    console.log('✓ Profile tab exists');

    // Check if name input field is visible
    const nameInput = await page.locator('#name');
    const isVisible = await nameInput.isVisible();
    console.log(`✓ Name input visible: ${isVisible}`);

    // Check input styling
    const inputColor = await nameInput.evaluate(el => window.getComputedStyle(el).color);
    const inputBg = await nameInput.evaluate(el => window.getComputedStyle(el).backgroundColor);
    console.log(`✓ Input color: ${inputColor}, Background: ${inputBg}`);

    // Test input - type name
    await nameInput.fill('Test User');
    const value = await nameInput.inputValue();
    console.log(`✓ Input accepts text: "${value}"`);

    // Test other fields
    const ageInput = await page.locator('#age');
    await ageInput.fill('30');
    console.log('✓ Age field works');

    const expensesInput = await page.locator('#expenses');
    await expensesInput.fill('50000');
    console.log('✓ Expenses field works');

    // Switch to Dashboard tab (triggers save)
    const dashboardTab = await page.locator('[data-tab="dashboard"]');
    await dashboardTab.click();
    console.log('✓ Switched to Dashboard tab');

    // Wait for save
    await page.waitForTimeout(2000);

    // Switch back to Profile
    const profileTab = await page.locator('[data-tab="profile"]');
    await profileTab.click();
    console.log('✓ Switched back to Profile tab');

    // Check if values persisted
    const savedName = await nameInput.inputValue();
    const savedAge = await ageInput.inputValue();
    const savedExpenses = await expensesInput.inputValue();

    console.log(`✓ Name persisted: "${savedName}"`);
    console.log(`✓ Age persisted: "${savedAge}"`);
    console.log(`✓ Expenses persisted: "${savedExpenses}"`);

    if (savedName === 'Test User' && savedAge === '30' && savedExpenses === '50000') {
      console.log('\n✅ ALL TESTS PASSED - Profile form works correctly');
      process.exit(0);
    } else {
      console.log('\n❌ DATA NOT PERSISTED');
      process.exit(1);
    }
  } catch (err) {
    console.error('Test error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
