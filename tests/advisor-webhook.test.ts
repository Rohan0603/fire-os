import { test, expect } from '@playwright/test';
import { registerAdvisorReview } from '../src/modules/integrations/advisor-webhook';

test("registerAdvisorReview sends review request to CFP", async () => {
  // Mock global fetch for this test
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return {
      ok: true,
      json: async () => ({ reviewId: 'mock-12345' })
    } as any;
  };

  try {
    const result = await registerAdvisorReview({
      userEmail: "user@example.com",
      portfolioSummary: {
        totalCorpus: 5500000,
        allocation: { PPFCF: 40, NipponGrowth: 30, NipponSmallCap: 20, Gold: 10 },
      },
    });

    expect(result.status).toBe("review_request_sent");
    expect(result.reviewUrl).toContain("https://advisor.fire-os.app/");
  } finally {
    // Restore fetch
    globalThis.fetch = originalFetch;
  }
});
