/**
 * Deterministic visitor bucketing for A/B experiments.
 *
 * Uses SHA-256 to hash `visitorId + experimentId`, then maps
 * the first 4 bytes to a 0-99 percentile. Visitors whose percentile
 * is below `controlPct` are assigned to "control"; the rest to "variant".
 */

export const VISITOR_COOKIE = '_zybit_vid';

export function bucketCookieName(experimentId: string): string {
  return `_zybit_exp_${experimentId}`;
}

/** 1 year in seconds — used for the visitor ID cookie. */
export const VISITOR_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/** Default experiment bucket cookie max-age (14 days). */
export const BUCKET_COOKIE_MAX_AGE = 14 * 24 * 60 * 60;

export function bucketCookieMaxAge(durationDays?: number): number {
  if (durationDays && durationDays > 0) return durationDays * 24 * 60 * 60;
  return BUCKET_COOKIE_MAX_AGE;
}

export type Bucket = 'control' | 'variant';

/**
 * Deterministic bucket assignment via SHA-256.
 * Returns "control" when the hash-derived percentile < controlPct,
 * otherwise "variant".
 */
export async function assignBucket(
  visitorId: string,
  experimentId: string,
  controlPct: number,
): Promise<Bucket> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${visitorId}:${experimentId}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const view = new DataView(hashBuffer);
  const num = view.getUint32(0);
  const percentile = num % 100;
  return percentile < controlPct ? 'control' : 'variant';
}

export function generateVisitorId(): string {
  return crypto.randomUUID();
}
