import { describe, expect, it } from 'vitest';
import {
  HoldingsCollectionSchema,
  PortfolioMetadataSchema,
  TransactionsCollectionSchema,
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
});