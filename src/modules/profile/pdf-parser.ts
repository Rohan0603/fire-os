/**
 * PDF Parser for CAS (Consolidated Account Statement)
 * Extracts mutual fund holdings and demat stock data from PDF
 */

/**
 * Parse CAS PDF file and extract text
 * Uses PDF.js loaded from CDN
 */
export async function parseCASPDF(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result;
        if (!arrayBuffer || typeof arrayBuffer === 'string') {
          reject(new Error('Invalid file data'));
          return;
        }

        // Load PDF.js from CDN if not already loaded
        if (!(window as any).pdfjsLib) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.onload = () => {
            (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            extractText(arrayBuffer as ArrayBuffer, resolve, reject);
          };
          document.head.appendChild(script);
        } else {
          extractText(arrayBuffer as ArrayBuffer, resolve, reject);
        }
      } catch (err) {
        reject(err);
      }
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Extract text from PDF buffer
 */
async function extractText(
  arrayBuffer: ArrayBuffer,
  resolve: (text: string) => void,
  reject: (err: Error) => void
) {
  try {
    const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }

    resolve(fullText);
  } catch (err) {
    reject(err instanceof Error ? err : new Error('PDF parsing failed'));
  }
}
