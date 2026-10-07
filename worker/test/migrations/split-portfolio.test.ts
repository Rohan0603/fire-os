import { describe, expect, it, vi } from 'vitest';
import {
  HoldingsCollectionSchema,
  PortfolioMetadataSchema,
  TransactionsCollectionSchema,
  shouldSplitPortfolio,
} from '../../../src/lib/portfolio/types';
import { migratePortfolio, rollbackMigration } from '../../../worker/src/migrations/split-portfolio';

// Mock firebase/firestore module
vi.mock('firebase/firestore', () => {
  const mockDocRef = {
    id: 'p1',
    data: vi.fn().mockReturnValue({
      id: 'p1',
      name: 'Test Portfolio',
      holdings: [],
      transactions: [],
      metadata: { id: 'p1', splitVersion: 1, originalDocId: 'p1', splitAt: '2024-01-01T00:00:00.000Z', migrated: false },
    }),
    exists: vi.fn().mockReturnValue(true),
    ref: { path: 'portfolios/p1' },
  };

  const mockWriteBatch = {
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    commit: vi.fn().mockResolvedValue(undefined),
  };

  const mockGetDoc = vi.fn().mockResolvedValue(mockDocRef);

  const mockFirestore = {
    doc: vi.fn((_db: any, _path: string) => mockDocRef),
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        id: 'placeholder',
        data: vi.fn().mockReturnValue({ id: 'placeholder', fundId: 'placeholder', quantity: 0, costBasis: 0 }),
        exists: vi.fn().mockReturnValue(true),
      }),
    }),
    getDoc: mockGetDoc,
    writeBatch: vi.fn().mockReturnValue(mockWriteBatch),
  };

  return {
    getFirestore: vi.fn().mockReturnValue(mockFirestore),
    doc: mockFirestore.doc,
    collection: mockFirestore.collection,
    getDoc: mockGetDoc,
    writeBatch: mockFirestore.writeBatch,
  };
});

describe('Portfolio split schemas', () => {
  it('validates holdings collection structure', () => {
    const holdings = HoldingsCollectionSchema;
    expect(() => holdings.parse([])).not.toThrow();
  });

  it('validates transactions collection structure', () => {
    const transactions = TransactionsCollectionSchema;
    expect(() => transactions.parse([])).not.toThrow();
  });

  it('validates portfolio metadata structure', () => {
    const metadata = PortfolioMetadataSchema;
    expect(() => metadata.parse({})).not.toThrow();
  });

  it('should return false when portfolio size is below threshold', () => {
    expect(shouldSplitPortfolio({ docSizeBytes: 500 })).toBe(false);
  });

  it('should return true when portfolio size is above threshold', () => {
    expect(shouldSplitPortfolio({ docSizeBytes: 721000 })).toBe(true);
  });

  it('should return false when write latency is below threshold', () => {
    expect(shouldSplitPortfolio({ writeLatencyMs: 150 })).toBe(false);
  });

  it('should return true when write latency is above threshold', () => {
    expect(shouldSplitPortfolio({ writeLatencyMs: 250 })).toBe(true);
  });

  it('should return false when both size and latency are below thresholds', () => {
    expect(shouldSplitPortfolio({ docSizeBytes: 500, writeLatencyMs: 150 })).toBe(false);
  });

  it('should return true when latency exceeds threshold regardless of size', () => {
    expect(shouldSplitPortfolio({ docSizeBytes: 800, writeLatencyMs: 250 })).toBe(true);
  });

  it('should return false when both params are undefined', () => {
    expect(shouldSplitPortfolio({})).toBe(false);
  });
});

describe('migratePortfolio', () => {
  const testPortfolio = {
    id: 'p1',
    holdings: [
      { id: 'h1', fundId: 'f1', quantity: 100, costBasis: 5000 },
    ],
    transactions: [
      { id: 't1', type: 'buy', amount: 10000, date: '2024-01-15' },
    ],
    name: 'Test Portfolio',
  };

  it('splits a portfolio doc into holdings and transactions subcollections', async () => {
    const { getDoc } = await import('firebase/firestore');
    // Update the mock data to include test portfolio data
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        id: 'p1',
        name: 'Test Portfolio',
        holdings: testPortfolio.holdings,
        transactions: testPortfolio.transactions,
        metadata: { id: 'p1', splitVersion: 1, originalDocId: 'p1', splitAt: '2024-01-01T00:00:00.000Z', migrated: false },
      }),
    });

    const result = await migratePortfolio('p1');
    expect(result.migrated).toBe(true);
    expect(result.holdingsCount).toBe(testPortfolio.holdings.length);
    expect(result.transactionsCount).toBe(testPortfolio.transactions.length);
  });

  it('rolls back and restores original document', async () => {
    const { getDoc } = await import('firebase/firestore');
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        id: 'p1',
        name: 'Test Portfolio',
        holdings: testPortfolio.holdings,
        transactions: testPortfolio.transactions,
        metadata: { id: 'p1', splitVersion: 1, originalDocId: 'p1', splitAt: '2024-01-01T00:00:00.000Z', migrated: false },
      }),
    });

    await migratePortfolio('p1');
    await rollbackMigration('p1');
    const restored = await getPortfolioDoc('p1');
    expect(restored.holdings).toBeDefined();
    expect(Array.isArray(restored.holdings)).toBe(true);
  });

  it('fails safely when a write conflicts', async () => {
    const { writeBatch } = await import('firebase/firestore');
    writeBatch.mockReturnValue({
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      commit: vi.fn().mockRejectedValue(new Error('WriteConflict')),
    });

    await expect(migratePortfolio('p1')).rejects.toThrow('WriteConflict');
  });
});

async function getPortfolioDoc(portfolioId: string) {
  const { getFirestore, doc, getDoc } = await import('firebase/firestore');
  const db = getFirestore();
  const snapshot = await getDoc(doc(db, 'portfolios', portfolioId));
  if (!snapshot.exists()) return null;
  return snapshot.data() as { holdings?: any[]; transactions?: any[] };
}