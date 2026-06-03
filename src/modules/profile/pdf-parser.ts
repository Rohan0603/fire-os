export interface PDFTextItem {
  str: string;
  x: number;
  y: number;
  page: number;
}

export interface CASHolding {
  type: 'soa' | 'demat';
  identifier: string;   // folioNo (soa) or clientId (demat)
  schemeName: string;
  investedValue: number;
  balanceUnits: number;
  navDate: string;      // YYYY-MM-DD, empty string if unavailable
  nav: number;
  marketValue: number;
  gainLossAbs: number;
  gainLossPct: number;
}

export interface CASParseResult {
  asOnDate: string;     // YYYY-MM-DD
  investor: { name: string; pan: string; email: string; mobile: string };
  holdings: CASHolding[];
}

export function parseAmount(str: string): number {
  if (!str) return 0;
  const isNeg = str.startsWith('(') && str.endsWith(')');
  const n = parseFloat(str.replace(/[()\s,]/g, '')) || 0;
  return isNeg ? -n : n;
}

export function parseDate(str: string): string {
  const MONTHS: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  const m = str.match(/(\d{2})-([A-Za-z]{3})-(\d{4})/);
  if (!m) return '';
  return `${m[3]}-${MONTHS[m[2].toLowerCase()] ?? '00'}-${m[1]}`;
}

function parsePct(str: string): number {
  const m = str.match(/([-+]?\d+\.?\d*)/);
  return m ? parseFloat(m[1]) : 0;
}

function groupByY(
  items: PDFTextItem[],
  tolerance = 2
): { y: number; items: PDFTextItem[] }[] {
  const rows: { y: number; items: PDFTextItem[] }[] = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const row = rows.find(r => Math.abs(r.y - item.y) <= tolerance);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  return rows.sort((a, b) => b.y - a.y); // descending y = top to bottom
}

const FOLIO_RE = /^\d{5,}(-\d+)?$/;

function parseTableSection(
  rows: { y: number; items: PDFTextItem[] }[],
  headerRowIdx: number,
  sectionType: 'soa' | 'demat',
  xSchemeEnd: number
): CASHolding[] {
  const holdings: CASHolding[] = [];
  let current: Partial<CASHolding> | null = null;

  const flush = () => {
    if (current?.identifier) holdings.push(current as CASHolding);
    current = null;
  };

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const sorted = [...rows[i].items].sort((a, b) => a.x - b.x);
    if (!sorted.length) continue;

    // "Total" row ends this section
    if (/^total$/i.test(sorted[0].str.trim())) { flush(); break; }

    const leftItems = sorted.filter(item => item.x < xSchemeEnd);
    const rightItems = sorted.filter(item => item.x >= xSchemeEnd);

    const identifierItem = leftItems.find(item => FOLIO_RE.test(item.str.trim()));

    if (!identifierItem) {
      // Continuation row: scheme name wraps to next line
      if (current && leftItems.length) {
        current.schemeName =
          (current.schemeName + ' ' + leftItems.map(i => i.str.trim()).join(' ')).trim();
      }
      continue;
    }

    flush();

    const schemeItems = leftItems.filter(
      item => item !== identifierItem && item.x > identifierItem.x
    );

    // Right items: separate dates, percentages, and plain numbers
    const dateItems = rightItems.filter(i => /\d{2}-[A-Za-z]{3}-\d{4}/.test(i.str));
    const pctItems = rightItems.filter(i => i.str.includes('%'));
    const valItems = rightItems
      .filter(i => !dateItems.includes(i) && !pctItems.includes(i))
      .sort((a, b) => a.x - b.x);

    // valItems in x-order: investedValue[0], balanceUnits[1], nav[2], marketValue[3], gainLossAbs[4]
    current = {
      type: sectionType,
      identifier: identifierItem.str.trim(),
      schemeName: schemeItems.map(i => i.str.trim()).join(' ').trim(),
      investedValue: parseAmount(valItems[0]?.str ?? ''),
      balanceUnits: parseAmount(valItems[1]?.str ?? ''),
      navDate: parseDate(dateItems[0]?.str ?? ''),
      nav: parseAmount(valItems[2]?.str ?? ''),
      marketValue: parseAmount(valItems[3]?.str ?? ''),
      gainLossAbs: parseAmount(valItems[4]?.str ?? ''),
      gainLossPct: parsePct(pctItems[0]?.str ?? ''),
    };
  }

  flush();
  return holdings;
}

async function extractItems(arrayBuffer: ArrayBuffer, pdfjsLib: any): Promise<PDFTextItem[]> {
  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch (err) {
    throw new Error(`Failed to load PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
  const items: PDFTextItem[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    try {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      for (const item of content.items as any[]) {
        if (item.str?.trim() && item.transform && item.transform.length >= 6) {
          items.push({ str: item.str, x: item.transform[4], y: item.transform[5], page: p });
        }
      }
    } catch (err) {
      throw new Error(`Failed to extract text from page ${p}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }
  return items;
}

function extractInvestorInfo(
  items: PDFTextItem[]
): CASParseResult['investor'] & { asOnDate: string } {
  const page1Rows = groupByY(items.filter(i => i.page === 1));
  let pan = '', name = '', email = '', mobile = '', asOnDate = '';

  for (const { items: rowItems } of page1Rows) {
    const text = rowItems.map(i => i.str).join(' ');
    const panM = text.match(/PAN\s*:\s*([A-Z]{5}[0-9]{4}[A-Z])/);
    if (panM) pan = panM[1];
    const mobM = text.match(/Mobile:\s*(\d+)/);
    if (mobM) mobile = mobM[1];
    const emailM = text.match(/Email:\s*(\S+)/i);
    if (emailM) email = emailM[1];
    const dateM = text.match(/\d{2}-[A-Za-z]{3}-\d{4}/);
    if (dateM && !asOnDate) asOnDate = parseDate(dateM[0]);
  }

  const panRowIdx = page1Rows.findIndex(r => r.items.some(i => /PAN\s*:/.test(i.str)));
  if (panRowIdx >= 0 && panRowIdx + 1 < page1Rows.length) {
    name = page1Rows[panRowIdx + 1].items.map(i => i.str.trim()).join(' ').trim();
  }

  return { pan, name, email, mobile, asOnDate };
}

function parseCASStructured(items: PDFTextItem[]): CASParseResult {
  const { pan, name, email, mobile, asOnDate } = extractInvestorInfo(items);
  const holdings: CASHolding[] = [];
  const maxPage = Math.max(...items.map(i => i.page));

  for (let p = 2; p <= maxPage; p++) {
    const rows = groupByY(items.filter(i => i.page === p));

    for (let ri = 0; ri < rows.length; ri++) {
      const rowText = rows[ri].items.map(i => i.str).join(' ');
      const isSoA = /folio\s*no/i.test(rowText);
      const isDemat = /client\s*id/i.test(rowText);
      if (!isSoA && !isDemat) continue;

      // Find x_scheme_end: x of the "Invested" keyword in header region
      let xSchemeEnd = 250; // safe fallback
      for (let offset = 0; offset <= 4; offset++) {
        const checkRow = rows[ri + offset];
        if (!checkRow) break;
        const investedItem = checkRow.items.find(i => /^invested/i.test(i.str.trim()));
        if (investedItem) { xSchemeEnd = investedItem.x; break; }
      }

      holdings.push(...parseTableSection(rows, ri, isDemat ? 'demat' : 'soa', xSchemeEnd));
    }
  }

  return { asOnDate, investor: { pan, name, email, mobile }, holdings };
}

export async function parseCASPDF(file: File): Promise<CASParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) { reject(new Error('Invalid file')); return; }
        const run = async () => {
          const items = await extractItems(arrayBuffer, (window as any).pdfjsLib);
          resolve(parseCASStructured(items));
        };
        if (!(window as any).pdfjsLib) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.onload = () => {
            (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            run().catch(reject);
          };
          script.onerror = () => reject(new Error('Failed to load PDF.js'));
          document.head.appendChild(script);
        } else {
          run().catch(reject);
        }
      } catch (err) {
        reject(err instanceof Error ? err : new Error('PDF parsing failed'));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
