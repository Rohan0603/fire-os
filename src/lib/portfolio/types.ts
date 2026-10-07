import { z } from 'zod';

// Schema for a single holding in the portfolio
export const HoldingSchema = z.object({
  id: z.string(),
  fundId: z.string(),
  quantity: z.number().positive(),
  costBasis: z.number().nonnegative(),
});

// Schema for a transaction in the portfolio
export const TransactionSchema = z.object({
  id: z.string(),
  type: z.enum(['buy', 'sell', 'dividend']),
  amount: z.number(),
  date: z.string(),
});

// Schema for portfolio metadata
export const PortfolioMetadataSchema = z.object({
  id: z.string().default(''),
  splitVersion: z.literal(1).default(1),
  originalDocId: z.string().default(''),
  splitAt: z.string().default(() => new Date().toISOString()),
  migrated: z.boolean().default(false),
});

// Combined schema for splitting portfolio documents
export const SplitPortfolioSchema = z.object({
  holdings: HoldingSchema.array(),
  transactions: TransactionSchema.array(),
  metadata: PortfolioMetadataSchema,
});

// Aggregated collection schemas (arrays of the above records)
export const HoldingsCollectionSchema = HoldingSchema.array();
export const TransactionsCollectionSchema = TransactionSchema.array();

// Trigger check: split when the portfolio document approaches the 750 KB
// Firestore warning threshold or write latency on portfolio operations
// becomes measurable.
export const PORTFOLIO_SPLIT_SIZE_THRESHOLD_BYTES = 700 * 1024; // 700 KB
export const PORTFOLIO_SPLIT_LATENCY_THRESHOLD_MS = 200;

export function shouldSplitPortfolio(params: {
  docSizeBytes?: number;
  writeLatencyMs?: number;
}): boolean {
  const { docSizeBytes, writeLatencyMs } = params;
  if (docSizeBytes !== undefined && docSizeBytes > PORTFOLIO_SPLIT_SIZE_THRESHOLD_BYTES) {
    return true;
  }
  if (writeLatencyMs !== undefined && writeLatencyMs > PORTFOLIO_SPLIT_LATENCY_THRESHOLD_MS) {
    return true;
  }
  return false;
}


