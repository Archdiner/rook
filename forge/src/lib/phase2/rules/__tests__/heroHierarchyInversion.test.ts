import { describe, it, expect } from 'vitest';
import { heroHierarchyInversion } from '@/lib/phase2/rules/heroHierarchyInversion';
import { makeContext, makeCtaClick, makeGoalConfig, makeSnapshot, makeCta } from './fixtures';

const PATH = '/pricing';

/**
 * Build a context where:
 * - The snapshot has two CTAs: heavy (high visual weight) and secondary (clicked more)
 * - Most clicks go to 'secondary' but heavy CTA has more visual weight → inversion
 */
function makeInversionContext(clickCount = 40, withSnapshot = true) {
  // Most clicks go to "Secondary action" text
  const events = [
    ...Array.from({ length: Math.floor(clickCount * 0.7) }, (_, i) =>
      makeCtaClick(PATH, 'Secondary action', `s-${i}`),
    ),
    ...Array.from({ length: Math.floor(clickCount * 0.3) }, (_, i) =>
      makeCtaClick(PATH, 'Primary action', `s2-${i}`),
    ),
  ];

  // Heavy CTA = "Primary action" but users click "Secondary action" more
  const heavyCta = makeCta('Primary action', 0.9, 'above', 'cta-primary');
  const secondaryCta = makeCta('Secondary action', 0.3, 'above', 'cta-secondary');
  const snapshot = makeSnapshot(PATH, [heavyCta, secondaryCta]);

  return makeContext(events, withSnapshot ? [snapshot] : []);
}

describe('heroHierarchyInversion rule', () => {
  it('fewer than 30 CTA clicks → returns []', () => {
    const ctx = makeInversionContext(10);
    expect(heroHierarchyInversion.evaluate(ctx)).toEqual([]);
  });

  it('no snapshot → returns []', () => {
    const ctx = makeInversionContext(40, false);
    expect(heroHierarchyInversion.evaluate(ctx)).toEqual([]);
  });

  it('clicked CTA === heaviest CTA → returns []', () => {
    // All clicks go to the heavy CTA → no inversion
    const events = Array.from({ length: 40 }, (_, i) =>
      makeCtaClick(PATH, 'Primary action', `s-${i}`),
    );
    const cta = makeCta('Primary action', 0.9, 'above');
    const snapshot = makeSnapshot(PATH, [cta]);
    const ctx = makeContext(events, [snapshot]);
    expect(heroHierarchyInversion.evaluate(ctx)).toEqual([]);
  });

  it('click inversion → returns finding', () => {
    const ctx = makeInversionContext(40);
    const findings = heroHierarchyInversion.evaluate(ctx);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it('finding has correct ruleId and category', () => {
    const ctx = makeInversionContext(40);
    const [f] = heroHierarchyInversion.evaluate(ctx);
    expect(f.ruleId).toBe('hero-hierarchy-inversion');
    expect(f.category).toBe('hierarchy');
  });

  it('prescription is present with all three fields non-empty', () => {
    const ctx = makeInversionContext(40);
    const [f] = heroHierarchyInversion.evaluate(ctx);
    expect(f.prescription).toBeDefined();
    expect(f.prescription!.whatToChange.length).toBeGreaterThan(0);
    expect(f.prescription!.whyItWorks.length).toBeGreaterThan(0);
    expect(f.prescription!.experimentVariantDescription.length).toBeGreaterThan(0);
  });

  it('impactEstimate present with goalConfig', () => {
    const events = [
      ...Array.from({ length: 28 }, (_, i) => makeCtaClick(PATH, 'Secondary action', `s-${i}`)),
      ...Array.from({ length: 12 }, (_, i) => makeCtaClick(PATH, 'Primary action', `s2-${i}`)),
    ];
    const heavyCta = makeCta('Primary action', 0.9, 'above', 'cta-p');
    const secondaryCta = makeCta('Secondary action', 0.3, 'above', 'cta-s');
    const snapshot = makeSnapshot(PATH, [heavyCta, secondaryCta]);
    const config = makeGoalConfig('revenue');
    const ctx = makeContext(events, [snapshot], config);
    const [f] = heroHierarchyInversion.evaluate(ctx);
    expect(f.impactEstimate).toBeDefined();
    expect(f.impactEstimate!.unit).toBe('USD');
  });

  it('finding id includes ruleId', () => {
    const ctx = makeInversionContext(40);
    const [f] = heroHierarchyInversion.evaluate(ctx);
    expect(f.id).toContain('hero-hierarchy-inversion');
  });

  it('evidence array is non-empty', () => {
    const ctx = makeInversionContext(40);
    const [f] = heroHierarchyInversion.evaluate(ctx);
    expect(f.evidence.length).toBeGreaterThan(0);
  });

  it('severity is valid', () => {
    const ctx = makeInversionContext(40);
    const [f] = heroHierarchyInversion.evaluate(ctx);
    expect(['critical', 'warn', 'info']).toContain(f.severity);
  });
});
