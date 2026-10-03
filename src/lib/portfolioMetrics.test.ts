import { describe, expect, it } from 'vitest';
import { measurePortfolioWrite } from './portfolioMetrics';

describe('portfolio write metrics', () => {
  it('reports UTF-8 document sizes and holding count without including portfolio values', () => {
    const metrics = measurePortfolioWrite(
      { schemaVersion: 'fireOS_v4', data: { profile: { name: 'A' } } },
      {
        fund: { name: 'Fund', units: 2, startDate: '2024-01', monthlyAmount: 1000 },
      },
      '2026-01-01T00:00:00.000Z',
    );

    expect(metrics.stateDocumentBytes).toBeGreaterThan(0);
    expect(metrics.holdingsDocumentBytes).toBeGreaterThan(0);
    expect(metrics.largestHoldingDocumentBytes).toBe(metrics.holdingsDocumentBytes);
    expect(metrics.holdingCount).toBe(1);
    expect(metrics.totalBytes).toBe(metrics.stateDocumentBytes + metrics.holdingsDocumentBytes);
    expect(JSON.stringify(metrics)).not.toContain('Fund');
  });

  it('measures an empty holdings set without reporting a largest entry', () => {
    const metrics = measurePortfolioWrite({ data: {} }, {}, '2026-01-01T00:00:00.000Z');

    expect(metrics.holdingCount).toBe(0);
    expect(metrics.holdingsDocumentBytes).toBe(0);
    expect(metrics.largestHoldingDocumentBytes).toBe(0);
  });
});
