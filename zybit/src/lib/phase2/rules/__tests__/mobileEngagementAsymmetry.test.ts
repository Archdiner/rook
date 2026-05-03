import { describe, it, expect } from 'vitest';
import { mobileEngagementAsymmetry } from '@/lib/phase2/rules/mobileEngagementAsymmetry';
import { makeContext, makeEvent, makeGoalConfig, makeConfig } from './fixtures';

/**
 * mobileEngagementAsymmetry needs:
 * - ≥2 onboarding steps
 * - Mobile starts ≥50, desktop starts ≥30
 * - Desktop completion rate - mobile completion rate > 0.15
 */
function makeMobileAsymmetryContext(
  mobileStarts: number,
  mobileCompletes: number,
  desktopStarts: number,
  desktopCompletes: number,
) {
  const events: ReturnType<typeof makeEvent>[] = [];
  const step1EventType = 'step_started';
  const step2EventType = 'step_completed';

  // Mobile sessions
  for (let i = 0; i < mobileStarts; i++) {
    const sid = `mobile-${i}`;
    events.push(makeEvent({ type: step1EventType, path: '/onboarding', sessionId: sid, properties: { device_type: 'mobile' } }));
    if (i < mobileCompletes) {
      events.push(makeEvent({ type: step2EventType, path: '/onboarding/done', sessionId: sid, properties: { device_type: 'mobile' } }));
    }
  }
  // Desktop sessions
  for (let i = 0; i < desktopStarts; i++) {
    const sid = `desktop-${i}`;
    events.push(makeEvent({ type: step1EventType, path: '/onboarding', sessionId: sid, properties: { device_type: 'desktop' } }));
    if (i < desktopCompletes) {
      events.push(makeEvent({ type: step2EventType, path: '/onboarding/done', sessionId: sid, properties: { device_type: 'desktop' } }));
    }
  }

  const config = makeConfig({
    onboardingSteps: [
      {
        id: 'step-start',
        label: 'Start onboarding',
        match: { kind: 'event-type', type: step1EventType },
        order: 1,
      },
      {
        id: 'step-done',
        label: 'Complete onboarding',
        match: { kind: 'event-type', type: step2EventType },
        order: 2,
      },
    ],
  });

  return makeContext(events, [], config);
}

describe('mobileEngagementAsymmetry rule', () => {
  it('fewer than 2 onboarding steps → returns []', () => {
    const events = Array.from({ length: 100 }, (_, i) =>
      makeEvent({ type: 'step_start', path: '/onboarding', sessionId: `s-${i}`, properties: { device_type: 'mobile' } }),
    );
    const config = makeConfig({
      onboardingSteps: [
        { id: 's1', label: 'Step 1', match: { kind: 'event-type', type: 'step_start' }, order: 1 },
      ],
    });
    expect(mobileEngagementAsymmetry.evaluate(makeContext(events, [], config))).toEqual([]);
  });

  it('mobile starts < 50 → returns []', () => {
    // Only 30 mobile starts (below MIN_MOBILE_STARTS=50)
    const ctx = makeMobileAsymmetryContext(30, 5, 60, 50);
    expect(mobileEngagementAsymmetry.evaluate(ctx)).toEqual([]);
  });

  it('gap ≤ 15pp → returns []', () => {
    // mobile: 60%, desktop: 70% → gap = 10% < 15%
    const ctx = makeMobileAsymmetryContext(50, 30, 50, 35);
    expect(mobileEngagementAsymmetry.evaluate(ctx)).toEqual([]);
  });

  it('large gap → returns finding', () => {
    // mobile: 20/50=40%, desktop: 45/50=90% → gap=50% > 15%
    const ctx = makeMobileAsymmetryContext(50, 20, 50, 45);
    const findings = mobileEngagementAsymmetry.evaluate(ctx);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it('finding has correct ruleId and category', () => {
    const ctx = makeMobileAsymmetryContext(50, 20, 50, 45);
    const [f] = mobileEngagementAsymmetry.evaluate(ctx);
    expect(f.ruleId).toBe('mobile-engagement-asymmetry');
    expect(f.category).toBe('asymmetry');
  });

  it('prescription is present with all three fields non-empty', () => {
    const ctx = makeMobileAsymmetryContext(50, 20, 50, 45);
    const [f] = mobileEngagementAsymmetry.evaluate(ctx);
    expect(f.prescription).toBeDefined();
    expect(f.prescription!.whatToChange.length).toBeGreaterThan(0);
    expect(f.prescription!.whyItWorks.length).toBeGreaterThan(0);
    expect(f.prescription!.experimentVariantDescription.length).toBeGreaterThan(0);
  });

  it('impactEstimate present with goalConfig', () => {
    const events: ReturnType<typeof makeEvent>[] = [];
    const step1 = 'step_start';
    const step2 = 'step_complete';
    for (let i = 0; i < 50; i++) {
      const sid = `mobile-${i}`;
      events.push(makeEvent({ type: step1, path: '/ob', sessionId: sid, properties: { device_type: 'mobile' } }));
      if (i < 20) events.push(makeEvent({ type: step2, path: '/ob/done', sessionId: sid, properties: { device_type: 'mobile' } }));
    }
    for (let i = 0; i < 50; i++) {
      const sid = `desktop-${i}`;
      events.push(makeEvent({ type: step1, path: '/ob', sessionId: sid, properties: { device_type: 'desktop' } }));
      if (i < 45) events.push(makeEvent({ type: step2, path: '/ob/done', sessionId: sid, properties: { device_type: 'desktop' } }));
    }
    const config = makeGoalConfig('growth');
    config.onboardingSteps = [
      { id: 's1', label: 'Start', match: { kind: 'event-type', type: step1 }, order: 1 },
      { id: 's2', label: 'Complete', match: { kind: 'event-type', type: step2 }, order: 2 },
    ];
    const ctx = makeContext(events, [], config);
    const findings = mobileEngagementAsymmetry.evaluate(ctx);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].impactEstimate).toBeDefined();
    expect(findings[0].impactEstimate!.unit).toBe('signups');
  });

  it('finding id includes ruleId', () => {
    const ctx = makeMobileAsymmetryContext(50, 20, 50, 45);
    const [f] = mobileEngagementAsymmetry.evaluate(ctx);
    expect(f.id).toContain('mobile-engagement-asymmetry');
  });

  it('evidence array is non-empty', () => {
    const ctx = makeMobileAsymmetryContext(50, 20, 50, 45);
    const [f] = mobileEngagementAsymmetry.evaluate(ctx);
    expect(f.evidence.length).toBeGreaterThan(0);
  });
});
