import { describe, expect, it } from 'vitest';
import { buildTimestamp, isoToGa4StartDate } from '../client';

describe('buildTimestamp — timezone correctness', () => {
  it('treats UTC (and missing tz) as a literal UTC instant', () => {
    expect(buildTimestamp('20260519', '10', '30', 'UTC')).toBe('2026-05-19T10:30:00.000Z');
    expect(buildTimestamp('20260519', '10', '30', '')).toBe('2026-05-19T10:30:00.000Z');
  });

  it('converts a positive-offset zone (Asia/Kolkata, +05:30) to UTC', () => {
    // 10:30 IST → 05:00 UTC
    expect(buildTimestamp('20260519', '10', '30', 'Asia/Kolkata')).toBe(
      '2026-05-19T05:00:00.000Z',
    );
  });

  it('converts a negative-offset zone respecting DST (America/New_York)', () => {
    // Winter: EST (UTC-5) → 10:30 → 15:30Z
    expect(buildTimestamp('20260115', '10', '30', 'America/New_York')).toBe(
      '2026-01-15T15:30:00.000Z',
    );
    // Summer: EDT (UTC-4) → 10:30 → 14:30Z
    expect(buildTimestamp('20260715', '10', '30', 'America/New_York')).toBe(
      '2026-07-15T14:30:00.000Z',
    );
  });

  it('handles a date crossing UTC midnight', () => {
    // 2026-05-19 02:00 IST → 2026-05-18 20:30 UTC
    expect(buildTimestamp('20260519', '02', '00', 'Asia/Kolkata')).toBe(
      '2026-05-18T20:30:00.000Z',
    );
  });

  it('returns null for a malformed date', () => {
    expect(buildTimestamp('2026-05', '10', '30', 'UTC')).toBeNull();
  });

  it('falls back to UTC for an invalid timezone instead of throwing', () => {
    expect(buildTimestamp('20260519', '10', '30', 'Not/AZone')).toBe(
      '2026-05-19T10:30:00.000Z',
    );
  });
});

describe('isoToGa4StartDate', () => {
  it('extracts the UTC calendar date', () => {
    expect(isoToGa4StartDate('2026-05-19T23:30:00.000Z')).toBe('2026-05-19');
  });

  it('falls back to today for an unparseable input', () => {
    expect(isoToGa4StartDate('garbage')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
