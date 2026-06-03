import * as pdfjsLib from 'pdfjs-dist';

const file = await pdfjsLib.getDocument('C:\\Users\\ponna\\Downloads\\cas_summary_report_2026_05_09_103313.pdf').promise;
const page = await file.getPage(1);
const text = await page.getTextContent();

console.log('=== Page 1 Text Items (first 100) ===');
let y = 0;
let rowItems = [];
let count = 0;
text.items.forEach((item, idx) => {
  if (item.transform && count < 100) {
    const itemY = item.transform[5];
    if (Math.abs(itemY - y) > 5 && rowItems.length > 0) {
      console.log(`Row (Y=${y.toFixed(0)}): ${rowItems.join(' ')}`);
      rowItems = [];
      count++;
    }
    y = itemY;
    rowItems.push(item.str.trim());
  }
});
if (rowItems.length > 0 && count < 100) {
  console.log(`Row (Y=${y.toFixed(0)}): ${rowItems.join(' ')}`);
}
