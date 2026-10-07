import { describe, expect, it } from 'vitest';
import {
  HoldingsCollectionSchema,
  PortfolioMetadataSchema,
  TransactionsCollectionSchema,
  shouldSplitPortfolio,
} from '../../../src/lib/portfolio/types';

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

  it('should return true when both size and latency exceed thresholds', () => {
    expect(shouldSplitPortfolio({ docSizeBytes: 800, writeLatencyMs: 250 })).toBe(true);
  });
});