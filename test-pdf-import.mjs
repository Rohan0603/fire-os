import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Capture console
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      console.log(`[${msg.type()}] ${msg.text()}`);
    }
  });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  console.log('=== Testing PDF Import ===');

  // Click Profile tab to ensure we'\''re on the right tab
  await page.click('[data-tab="profile"]');
  await page.waitForTimeout(500);

  // Look for the import PDF button
  const importBtn = await page.$('text=Import CAS PDF');
  if (!importBtn) {
    console.log('❌ Import CAS PDF button not found');
    await browser.close();
    process.exit(1);
  }

  console.log('✓ Found Import CAS PDF button');

  // Click the button to open file dialog
  await importBtn.click();
  console.log('✓ Clicked Import button');

  // Wait for hidden file input and set the file
  await page.waitForSelector('input[type="file"]#pdf-input', { timeout: 2000 });
  const pdfInput = await page.$('input[type="file"]#pdf-input');

  const pdfPath = 'C:\\Users\\ponna\\Downloads\\cas_summary_report_2026_05_09_103313.pdf';
  await pdfInput.setInputFiles(pdfPath);
  console.log('✓ Set PDF file');

  // Wait for modal to appear
  try {
    await page.waitForSelector('#pdf-confirmation', { timeout: 3000 });
  } catch (e) {
    console.log('❌ Modal did not appear within 3 seconds');
    console.log('Waiting 5 more seconds...');
    await page.waitForTimeout(5000);
  }

  const modalVisible = await page.evaluate(() => {
    const el = document.getElementById('pdf-confirmation');
    return el ? el.style.display !== 'none' : false;
  });

  console.log('Modal visible?', modalVisible ? '✓ YES' : '❌ NO');

  if (modalVisible) {
    const previewContent = await page.evaluate(() => {
      const el = document.getElementById('pdf-preview');
      return el ? el.innerHTML.substring(0, 300) : 'NO PREVIEW';
    });
    console.log('\nPreview (first 300 chars):');
    console.log(previewContent);
    
    // Check if confirm button exists
    const confirmBtn = await page.$('#pdf-confirm-btn');
    if (confirmBtn) {
      console.log('\n✓ Confirm button found');
      console.log('Clicking Confirm Import...');
      await confirmBtn.click();
      await page.waitForTimeout(1500);
      
      const modalNowVisible = await page.evaluate(() => {
        const el = document.getElementById('pdf-confirmation');
        return el ? el.style.display !== 'none' : false;
      });
      
      console.log('Modal closed after confirm?', !modalNowVisible ? '✓ YES' : '❌ NO');
    } else {
      console.log('❌ Confirm button NOT found');
    }
  }

  await browser.close();
})();
