import type { SIPFund } from '../types/portfolio';

export interface PortfolioWriteMetrics {
  stateDocumentBytes: number;
  holdingsDocumentBytes: number;
  largestHoldingDocumentBytes: number;
  holdingCount: number;
  totalBytes: number;
}

function utf8Bytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

/** Measure write payload sizes without retaining or logging portfolio contents. */
export function measurePortfolioWrite(
  stateDocument: unknown,
  holdings: Record<string, SIPFund>,
  updatedAt: string,
): PortfolioWriteMetrics {
  const holdingSizes = Object.values(holdings).map((value) =>
    utf8Bytes({ kind: 'mf', value, updatedAt }),
  );
  const stateDocumentBytes = utf8Bytes(stateDocument);
  const holdingsDocumentBytes = holdingSizes.reduce((total, size) => total + size, 0);
  return {
    stateDocumentBytes,
    holdingsDocumentBytes,
    largestHoldingDocumentBytes: Math.max(0, ...holdingSizes),
    holdingCount: holdingSizes.length,
    totalBytes: stateDocumentBytes + holdingsDocumentBytes,
  };
}
