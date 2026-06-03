import { chromium } from "playwright";
import { readFileSync } from "fs";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Load PDF.js
  await page.goto('about:blank');
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    document.head.appendChild(script);
  });
  
  await page.waitForTimeout(2000);

  // Extract PDF text
  const pdfPath = 'C:\\Users\\ponna\\Downloads\\cas_summary_report_2026_05_09_103313.pdf';
  const pdfBuffer = readFileSync(pdfPath);
  const base64 = Buffer.from(pdfBuffer).toString('base64');

  const text = await page.evaluate(async (base64) => {
    const pdfjsLib = window.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    const pdf = await pdfjsLib.getDocument({ data: Uint8Array.from(atob(base64), c => c.charCodeAt(0)) }).promise;
    let fullText = '';
    
    for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\\n---PAGE ' + i + '---\\n';
    }
    
    return fullText;
  }, base64);

  console.log('=== PDF EXTRACTED TEXT ===');
  console.log(text.substring(0, 2000));
  console.log('\n=== LOOKING FOR PATTERNS ===');
  
  const lines = text.split('\\n');
  const hasMF = text.match(/Mutual Fund|MF|scheme|Fund/i);
  const hasDemat = text.match(/Demat|Dematerialized|Stock|Equity|ISIN/i);
  const hasUnits = text.match(/units?/i);
  
  console.log('Has MF keywords:', hasMF ? 'YES' : 'NO');
  console.log('Has Demat keywords:', hasDemat ? 'YES' : 'NO');
  console.log('Has Units keyword:', hasUnits ? 'YES' : 'NO');
  console.log('Total lines:', lines.length);
  
  // Show first 30 lines
  console.log('\n=== FIRST 30 LINES ===');
  lines.slice(0, 30).forEach((line, i) => {
    if (line.trim()) console.log(\`\${i}: \${line.substring(0, 100)}\`);
  });

  await browser.close();
})();
