/**
 * Fixture replay tests for the capture pipeline.
 *
 * These tests validate the rule evaluation path using a pre-baked PageCapture
 * JSON fixture — no Browserless calls, no network, no DB. They verify that:
 *
 *   1. The fixture parses as a valid PageCapture.
 *   2. `buildCaptureIndex` correctly groups captures by pathRef.
 *   3. `aboveFoldCoverage` and `heroHierarchyInversion` correctly consume
 *      the capture path (not the legacy snapshot path) when pageCapturesByPath
 *      is present in the AuditRuleContext.
 *
 * To add a new fixture: drop a PageCapture JSON into
 * `src/lib/phase2/__fixtures__/captures/<site>/<path-slug>.json`
 * and import it in the relevant test block.
 */

import { describe, it, expect } from 'vitest';
import { buildCaptureIndex } from '@/lib/phase2/capture';
import type { PageCapture } from '@/lib/phase2/capture/types';
import { aboveFoldCoverage } from '@/lib/phase2/rules/aboveFoldCoverage';
import { heroHierarchyInversion } from '@/lib/phase2/rules/heroHierarchyInversion';
import { makeContext, makeLowScrollViews, makeHighScrollViews, makeEvent } from '@/lib/phase2/rules/__tests__/fixtures';

import rootFixture from '@/lib/phase2/__fixtures__/captures/example/root.json';

const capture = rootFixture as unknown as PageCapture;

// ---------------------------------------------------------------------------
// Fixture validity
// ---------------------------------------------------------------------------

describe('PageCapture fixture shape', () => {
  it('has required top-level fields', () => {
    expect(typeof capture.pathRef).toBe('string');
    expect(typeof capture.capturedAt).toBe('string');
    expect(typeof capture.breakpoint).toBe('string');
    expect(capture.fold).toBeDefined();
    expect(typeof capture.fold.foldY).toBe('number');
    expect(Array.isArray(capture.ctas)).toBe(true);
    expect(Array.isArray(capture.headings)).toBe(true);
    expect(Array.isArray(capture.forms)).toBe(true);
  });

  it('ctas carry bbox and visualWeight', () => {
    for (const cta of capture.ctas) {
      expect(typeof cta.visualWeight).toBe('number');
      // bbox may be null for hidden elements; when present it must have dimensions
      if (cta.bbox !== null) {
        expect(typeof cta.bbox.x).toBe('number');
        expect(typeof cta.bbox.y).toBe('number');
        expect(typeof cta.bbox.width).toBe('number');
        expect(typeof cta.bbox.height).toBe('number');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// buildCaptureIndex
// ---------------------------------------------------------------------------

describe('buildCaptureIndex', () => {
  it('groups captures by pathRef', () => {
    const index = buildCaptureIndex([capture]);
    expect(index.has('/')).toBe(true);
    expect(index.get('/')!.length).toBe(1);
    expect(index.get('/')![0]).toBe(capture);
  });

  it('accumulates multiple breakpoints under the same pathRef', () => {
    const mobile: PageCapture = { ...capture, breakpoint: 'mobile' };
    const index = buildCaptureIndex([capture, mobile]);
    expect(index.get('/')!.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// aboveFoldCoverage — measured path
// ---------------------------------------------------------------------------

describe('aboveFoldCoverage with PageCapture', () => {
  function makeCtx(lowCount: number, highCount: number) {
    const events = [
      ...makeLowScrollViews('/', lowCount),
      ...makeHighScrollViews('/', highCount),
    ];
    // No legacy snapshots — force the rule onto the capture path
    const ctx = makeContext(events, []);
    return {
      ...ctx,
      pageCapturesByPath: buildCaptureIndex([capture]),
    };
  }

  it('returns [] when below minimum pageview threshold', () => {
    const ctx = makeCtx(10, 5);
    expect(aboveFoldCoverage.evaluate(ctx)).toEqual([]);
  });

  it('returns [] when most sessions scroll past fold', () => {
    // Only 5 of 60 are low-scroll → belowFoldShare ~0.08
    const ctx = makeCtx(5, 55);
    expect(aboveFoldCoverage.evaluate(ctx)).toEqual([]);
  });

  it('fixture CTAs are all above the fold (foldY=900, all bbox.y < 900)', () => {
    // The example fixture has all CTAs above fold → rule should not fire
    const ctx = makeCtx(40, 10);
    const findings = aboveFoldCoverage.evaluate(ctx);
    // All example CTAs are above fold so no finding expected
    expect(findings).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// heroHierarchyInversion — measured path
// ---------------------------------------------------------------------------

describe('heroHierarchyInversion with PageCapture', () => {
  function makeCtxWithClicks(mostClickedText: string, otherClickCount = 5) {
    // 40 clicks on mostClickedText, otherClickCount on the other button
    const clicks = [
      ...Array.from({ length: 40 }, () =>
        makeEvent({
          type: 'cta_click',
          path: '/',
          properties: { cta_text: mostClickedText },
        }),
      ),
      ...Array.from({ length: otherClickCount }, () =>
        makeEvent({
          type: 'cta_click',
          path: '/',
          properties: { cta_text: mostClickedText === 'Get started' ? 'Learn more' : 'Get started' },
        }),
      ),
    ];
    const ctx = makeContext(clicks, []);
    return {
      ...ctx,
      pageCapturesByPath: buildCaptureIndex([capture]),
    };
  }

  it('returns [] when most-clicked CTA is also the heaviest (aligned)', () => {
    // "Get started" has visualWeight 0.9 (heaviest) and gets most clicks → no inversion
    const ctx = makeCtxWithClicks('Get started');
    expect(heroHierarchyInversion.evaluate(ctx)).toEqual([]);
  });

  it('returns a finding when lighter CTA gets most clicks', () => {
    // "Learn more" has visualWeight 0.3 but gets most clicks → inversion
    const ctx = makeCtxWithClicks('Learn more');
    const findings = heroHierarchyInversion.evaluate(ctx);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('hero-hierarchy-inversion');
    expect(findings[0].category).toBe('hierarchy');
  });

  it('inversion finding summary mentions both CTAs', () => {
    const ctx = makeCtxWithClicks('Learn more');
    const [f] = heroHierarchyInversion.evaluate(ctx);
    expect(f.summary).toContain('Learn more');
    expect(f.summary).toContain('Get started');
  });

  it('below threshold → returns []', () => {
    // Only 10 clicks total (< MIN_CTA_CLICKS 30)
    const clicks = Array.from({ length: 10 }, () =>
      makeEvent({ type: 'cta_click', path: '/', properties: { cta_text: 'Learn more' } }),
    );
    const ctx = {
      ...makeContext(clicks, []),
      pageCapturesByPath: buildCaptureIndex([capture]),
    };
    expect(heroHierarchyInversion.evaluate(ctx)).toEqual([]);
  });
});
