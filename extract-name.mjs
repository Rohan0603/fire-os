import * as pdfjsLib from 'pdfjs-dist';

const file = await pdfjsLib.getDocument('C:\\Users\\ponna\\Downloads\\cas_summary_report_2026_05_09_103313.pdf').promise;
const page = await file.getPage(1);
const text = await page.getTextContent();

console.log('=== All page 1 text items ===');
text.items.forEach((item, idx) => {
  if (item.str.trim()) {
    console.log(`[${idx}] "${item.str}" at Y=${item.transform ? item.transform[5].toFixed(0) : 'N/A'}`);
  }
});
