interface AdvisorReviewRequest {
  userEmail: string;
  portfolioSummary: {
    totalCorpus: number;
    allocation: { [fund: string]: number };
  };
}

interface ReviewResponse {
  status: "review_request_sent" | "error";
  reviewUrl?: string;
  error?: string;
}

export async function registerAdvisorReview(
  request: AdvisorReviewRequest
): Promise<ReviewResponse> {
  try {
    // Send webhook to advisor service
    const response = await fetch("https://api.fire-os.app/advisor/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: request.userEmail,
        portfolio: request.portfolioSummary,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      return { status: "error", error: "Failed to register review" };
    }

    const data = await response.json();
    return {
      status: "review_request_sent",
      reviewUrl: `https://advisor.fire-os.app/review/${data.reviewId}`,
    };
  } catch (e) {
    return { status: "error", error: String(e) };
  }
}

export function renderAdvisorIntegrationWidget(state: any): string {
  return `
    <div class="advisor-widget">
      <h3>Certified Financial Planner Review</h3>
      <p>Get an expert review of your portfolio allocation and SWP strategy.</p>
      <button id="request-advisor-review-btn" class="btn btn-secondary">Request Review</button>
      <p><small>Optional. Your portfolio summary will be shared with the CFP.</small></p>
    </div>
  `;
}
