/**
 * Fund classification.
 *
 * A fund's asset-class bucket is user data: `SIPFund.bucketId`, assigned by the
 * user (or by the one-off migration default). Source code never keys off a
 * specific fund name. `classifyFundName` is only a generic category-word
 * fallback for holdings that carry no explicit `bucketId` (and the default the
 * migration applies), so a fund whose name says "Small Cap" lands in the
 * small-cap bucket while an unfamiliar name falls back to `other`.
 */

import {
  FUND_BUCKET_IDS,
  type FundBucket,
  type FundBucketId,
  type SIPFund,
} from '../types/portfolio';

/** Default user-owned bucket vocabulary. Target percentages start unset (0). */
export const DEFAULT_FUND_BUCKETS: FundBucket[] = [
  { id: 'large-cap', label: 'Large Cap', targetPercent: 0 },
  { id: 'mid-cap', label: 'Mid Cap', targetPercent: 0 },
  { id: 'small-cap', label: 'Small Cap', targetPercent: 0 },
  { id: 'gold', label: 'Gold', targetPercent: 0 },
  { id: 'other', label: 'Other', targetPercent: 0 },
];

export function isFundBucketId(value: unknown): value is FundBucketId {
  return typeof value === 'string' && (FUND_BUCKET_IDS as readonly string[]).includes(value);
}

/**
 * Generic category-word classifier used only as a fallback default. It matches
 * whole category phrases ("small cap", "mid cap", "gold"), not bare words, so a
 * fund named "... Growth Fund" is not mis-bucketed by the word "Growth".
 */
export function classifyFundName(name: string): FundBucketId {
  const normalized = (name || '').toLowerCase();
  if (/\bgold\b|gold\s*etf|\bcommodit/.test(normalized)) return 'gold';
  if (/small\s*-?\s*cap|smallcap/.test(normalized)) return 'small-cap';
  if (/mid\s*-?\s*cap|midcap/.test(normalized)) return 'mid-cap';
  if (/large\s*-?\s*cap|largecap|blue\s*-?\s*chip|flexi|index|nifty|balanced/.test(normalized)) {
    return 'large-cap';
  }
  return 'other';
}

/**
 * Resolve a holding's bucket: explicit user data first, then the generic name
 * heuristic, clamped to a bucket the user actually has.
 */
export function resolveFundBucket(
  holding: Pick<SIPFund, 'name' | 'bucketId'>,
  buckets: FundBucket[] = DEFAULT_FUND_BUCKETS,
): FundBucketId {
  const known = new Set(buckets.map((bucket) => bucket.id));
  if (holding.bucketId && known.has(holding.bucketId)) return holding.bucketId;
  const guessed = classifyFundName(holding.name);
  return known.has(guessed) ? guessed : 'other';
}

/** Target percentages keyed by bucket id, for the allocation-drift calculation. */
export function bucketTargets(buckets: FundBucket[]): Record<string, number> {
  return Object.fromEntries(buckets.map((bucket) => [bucket.id, bucket.targetPercent]));
}
