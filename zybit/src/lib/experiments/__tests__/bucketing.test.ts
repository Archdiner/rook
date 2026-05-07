import { describe, expect, it } from 'vitest';
import {
  assignBucket,
  bucketCookieMaxAge,
  bucketCookieName,
  BUCKET_COOKIE_MAX_AGE,
  generateVisitorId,
  VISITOR_COOKIE,
} from '../bucketing';

describe('assignBucket — determinism', () => {
  it('returns the same bucket for the same (visitorId, experimentId)', async () => {
    const a = await assignBucket('visitor-abc', 'exp-1', 50);
    const b = await assignBucket('visitor-abc', 'exp-1', 50);
    expect(a).toBe(b);
  });

  it('different experiments can give different buckets for the same visitor', async () => {
    const buckets = await Promise.all(
      Array.from({ length: 50 }, (_, i) => assignBucket('visitor-x', `exp-${i}`, 50)),
    );
    expect(new Set(buckets).size).toBe(2);
  });
});

describe('assignBucket — boundaries', () => {
  it('controlPct=0 always returns variant', async () => {
    for (let i = 0; i < 20; i++) {
      const b = await assignBucket(`v-${i}`, 'exp-z', 0);
      expect(b).toBe('variant');
    }
  });

  it('controlPct=100 always returns control', async () => {
    for (let i = 0; i < 20; i++) {
      const b = await assignBucket(`v-${i}`, 'exp-z', 100);
      expect(b).toBe('control');
    }
  });
});

describe('assignBucket — distribution', () => {
  it('with controlPct=50, control share is within ±5pp over 1000 visitors', async () => {
    const N = 1000;
    let control = 0;
    for (let i = 0; i < N; i++) {
      const b = await assignBucket(`visitor-${i}`, 'exp-dist', 50);
      if (b === 'control') control++;
    }
    const share = control / N;
    expect(share).toBeGreaterThan(0.45);
    expect(share).toBeLessThan(0.55);
  });
});

describe('cookie helpers', () => {
  it('VISITOR_COOKIE is a stable name', () => {
    expect(VISITOR_COOKIE).toBe('_zybit_vid');
  });

  it('bucketCookieName namespaces by experiment', () => {
    expect(bucketCookieName('abc')).toBe('_zybit_exp_abc');
  });

  it('bucketCookieMaxAge defaults when duration is missing or zero', () => {
    expect(bucketCookieMaxAge()).toBe(BUCKET_COOKIE_MAX_AGE);
    expect(bucketCookieMaxAge(0)).toBe(BUCKET_COOKIE_MAX_AGE);
  });

  it('bucketCookieMaxAge converts days to seconds', () => {
    expect(bucketCookieMaxAge(7)).toBe(7 * 24 * 60 * 60);
  });
});

describe('generateVisitorId', () => {
  it('returns a UUID-shaped string', () => {
    const id = generateVisitorId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateVisitorId()));
    expect(ids.size).toBe(50);
  });
});
