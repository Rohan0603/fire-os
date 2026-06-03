import { chromium } from 'playwright';
import { readFileSync } from 'fs';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('about:blank');
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    document.head.appendChild(script);
  });
  
  await page.waitForTimeout(2000);

  const pdfPath = 'C:\\Users\\ponna\\Downloads\\cas_summary_report_2026_05_09_103313.pdf';
  const pdfBuffer = readFileSync(pdfPath);
  const base64 = Buffer.from(pdfBuffer).toString('base64');

  const text = await page.evaluate(async (base64) => {
    const pdfjsLib = window.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    const pdf = await pdfjsLib.getDocument({ data: Uint8Array.from(atob(base64), c => c.charCodeAt(0)) }).promise;
    let fullText = '';
    
    for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  }, base64);

  console.log(text.substring(0, 3000));
  await browser.close();
})();
