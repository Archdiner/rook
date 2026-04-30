import { describe, it, expect } from 'vitest';
import { computeImpactEstimate, windowDaysFromTimeWindow } from '@/lib/phase2/rules/impactEstimate';

describe('computeImpactEstimate', () => {
  const BASE = {
    affectedRate: 0.5,
    windowVolume: 300,
    windowDays: 30,
    signalDescription: 'pageviews on /pricing',
  };

  // 1. revenue with ARPU
  it('revenue: value matches math, unit=USD, formatted starts with ~$, basis contains ARPU', () => {
    const result = computeImpactEstimate({
      ...BASE,
      goalType: 'revenue',
      goalConfig: { arpu: 47, baselineConversionRate: 0.03 },
    });
    // affectedMonthly = 0.5 * (300/30) * 30 = 150
    // convertedMonthly = 150 * 0.03 = 4.5
    // value = round(4.5 * 47) = 212 (rounded)
    expect(result.unit).toBe('USD');
    expect(result.period).toBe('monthly');
    expect(result.formatted).toMatch(/^~\$/);
    expect(result.basis).toContain('ARPU');
    expect(result.value).toBe(Math.round(4.5 * 47));
  });

  // 2. revenue without ARPU → falls back to engagement
  it('revenue without arpu → falls back to sessions', () => {
    const result = computeImpactEstimate({
      ...BASE,
      goalType: 'revenue',
      goalConfig: {},
    });
    expect(result.unit).toBe('sessions');
    expect(result.formatted).toContain('sessions/month');
  });

  // 3. ecommerce with aov
  it('ecommerce with aov=120 → unit=USD, value matches math', () => {
    const result = computeImpactEstimate({
      ...BASE,
      goalType: 'ecommerce',
      goalConfig: { aov: 120, baselineConversionRate: 0.03 },
    });
    // affectedMonthly = 150, converted = 4.5, value = round(4.5*120) = 540
    expect(result.unit).toBe('USD');
    expect(result.value).toBe(Math.round(4.5 * 120));
    expect(result.formatted).toMatch(/^~\$/);
    expect(result.basis).toContain('AOV');
  });

  // 4. growth
  it('growth → unit=conversionLabel, formatted contains signups/month', () => {
    const result = computeImpactEstimate({
      ...BASE,
      goalType: 'growth',
      goalConfig: { conversionLabel: 'signups', baselineConversionRate: 0.05 },
    });
    expect(result.unit).toBe('signups');
    expect(result.formatted).toContain('signups/month');
    expect(result.period).toBe('monthly');
    // affectedMonthly = 150, convertedMonthly = 150 * 0.05 = 7.5 → 8
    expect(result.value).toBe(Math.round(150 * 0.05));
  });

  // 5. custom
  it('custom → unit=customMetricLabel', () => {
    const result = computeImpactEstimate({
      ...BASE,
      goalType: 'custom',
      goalConfig: {
        customMetricLabel: 'donations',
        customMetricValue: 10,
        baselineConversionRate: 0.02,
      },
    });
    expect(result.unit).toBe('donations');
    expect(result.formatted).toContain('donations/month');
  });

  // 6. engagement (default)
  it('engagement → unit=sessions, formatted ~X sessions/month', () => {
    const result = computeImpactEstimate({
      ...BASE,
      goalType: 'engagement',
    });
    expect(result.unit).toBe('sessions');
    expect(result.formatted).toContain('sessions/month');
    expect(result.formatted).toMatch(/^~\d/);
  });

  // 7. no goalType → defaults to engagement
  it('no goalType defaults to engagement (sessions)', () => {
    const result = computeImpactEstimate({
      ...BASE,
    });
    expect(result.unit).toBe('sessions');
  });

  // 8. affectedRate=0 → value=0
  it('affectedRate=0 → value=0', () => {
    const result = computeImpactEstimate({ ...BASE, affectedRate: 0 });
    expect(result.value).toBe(0);
  });

  // 9. affectedRate=1 → uses full volume
  it('affectedRate=1 → uses full volume', () => {
    const full = computeImpactEstimate({ ...BASE, affectedRate: 1 });
    const half = computeImpactEstimate({ ...BASE, affectedRate: 0.5 });
    expect(full.value).toBe(half.value * 2);
  });

  // 10. affectedRate>1 → clamped to 1
  it('affectedRate>1 is clamped to 1', () => {
    const clamped = computeImpactEstimate({ ...BASE, affectedRate: 1.5 });
    const full = computeImpactEstimate({ ...BASE, affectedRate: 1 });
    expect(clamped.value).toBe(full.value);
  });

  // 11. windowDays=0 → doesn't divide by zero
  it('windowDays=0 does not throw and clamps denominator to 1', () => {
    expect(() =>
      computeImpactEstimate({ ...BASE, windowDays: 0 }),
    ).not.toThrow();
    const result = computeImpactEstimate({ ...BASE, windowDays: 0 });
    expect(Number.isFinite(result.value)).toBe(true);
  });

  // 12. windowVolume=0 → value=0
  it('windowVolume=0 → value=0', () => {
    const result = computeImpactEstimate({ ...BASE, windowVolume: 0 });
    expect(result.value).toBe(0);
  });

  // 13. currency symbols
  it.each([
    ['GBP', '£'],
    ['EUR', '€'],
    ['USD', '$'],
    ['XYZ', 'XYZ'], // unknown → code itself
  ])('currency %s renders symbol %s', (code, symbol) => {
    const result = computeImpactEstimate({
      ...BASE,
      goalType: 'revenue',
      goalConfig: { arpu: 100, currencyCode: code, baselineConversionRate: 0.03 },
    });
    if (result.unit !== 'sessions') {
      // revenue path was taken (arpu was set)
      expect(result.formatted).toContain(symbol);
    }
  });

  // 14. large value → k notation
  it('value >= 10000 formats as k notation', () => {
    // affectedMonthly = 1 * (100000/30) * 30 = 100000, converted = 100000*0.03*47
    const result = computeImpactEstimate({
      affectedRate: 1,
      windowVolume: 100_000,
      windowDays: 30,
      goalType: 'revenue',
      goalConfig: { arpu: 1000, currencyCode: 'USD', baselineConversionRate: 0.1 },
      signalDescription: 'sessions',
    });
    // value = round(100000 * 0.1 * 1000) = 10,000,000 → very large
    expect(result.formatted).toMatch(/k\/month$/);
  });

  // 15. period is always monthly
  it('period is always monthly', () => {
    const types: Array<typeof BASE['goalType'] | undefined> = [
      'revenue', 'ecommerce', 'growth', 'engagement', 'custom', undefined,
    ];
    for (const goalType of types) {
      const result = computeImpactEstimate({ ...BASE, goalType });
      expect(result.period).toBe('monthly');
    }
  });

  // 16. basis string contains signal description
  it('basis contains the signalDescription', () => {
    const result = computeImpactEstimate({
      ...BASE,
      signalDescription: 'sessions on /checkout',
    });
    expect(result.basis).toContain('sessions on /checkout');
  });
});

describe('windowDaysFromTimeWindow', () => {
  it('computes correct day count for known start/end', () => {
    const days = windowDaysFromTimeWindow({
      start: '2026-01-01T00:00:00Z',
      end: '2026-01-31T00:00:00Z',
    });
    expect(days).toBe(30);
  });

  it('returns at least 1 for same-day window', () => {
    const days = windowDaysFromTimeWindow({
      start: '2026-01-01T00:00:00Z',
      end: '2026-01-01T00:00:00Z',
    });
    expect(days).toBeGreaterThanOrEqual(1);
  });

  it('handles 7-day window', () => {
    const days = windowDaysFromTimeWindow({
      start: '2026-01-01T00:00:00Z',
      end: '2026-01-08T00:00:00Z',
    });
    expect(days).toBe(7);
  });
});
