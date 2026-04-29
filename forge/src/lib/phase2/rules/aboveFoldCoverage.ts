/**
 * Rule: above-fold-coverage
 *
 * Per page that has a snapshot AND ≥ 30 `page_view` events with a finite
 * scroll metric: pick the visually heaviest CTA whose `foldGuess` is not
 * `'above'` (an important call-to-action that lives below the fold). If
 * more than half of pageviews never scroll past 40% of the page, emit a
 * finding — most visitors literally never see the ask.
 */

import type { CtaCandidate, PageSnapshot } from "@/lib/phase2/snapshots/types";
import type { CanonicalEvent } from "@/lib/phase2/types";

import { clamp, formatCount, pct, quote, readScrollFraction } from "./helpers";
import type {
  DesignFinding,
  DesignFindingEvidence,
  DesignRule,
  DesignRuleContext,
} from "./types";

const MIN_PAGEVIEWS = 30;
const FOLD_FRACTION = 0.4;
const MIN_VISUAL_WEIGHT = 0.4;
const MIN_BELOW_FOLD_SHARE = 0.5;

export const aboveFoldCoverage: DesignRule = {
  id: "above-fold-coverage",
  name: "Above-fold CTA coverage",
  category: "fold",

  evaluate(ctx: DesignRuleContext): DesignFinding[] {
    const findings: DesignFinding[] = [];

    const pageviewsByPath = new Map<string, CanonicalEvent[]>();
    for (const event of ctx.events) {
      if (event.type !== "page_view") continue;
      if (readScrollFraction(event) === null) continue;
      let bucket = pageviewsByPath.get(event.path);
      if (!bucket) {
        bucket = [];
        pageviewsByPath.set(event.path, bucket);
      }
      bucket.push(event);
    }

    for (const [pathRef, pageviews] of pageviewsByPath) {
      if (pageviews.length < MIN_PAGEVIEWS) continue;
      const snapshot = ctx.pageSnapshotsByPath.get(pathRef);
      if (!snapshot) continue;

      const finding = evaluatePage(pathRef, snapshot, pageviews);
      if (finding !== null) {
        findings.push(finding);
      }
    }

    return findings;
  },
};

function evaluatePage(
  pathRef: string,
  snapshot: PageSnapshot,
  pageviews: CanonicalEvent[],
): DesignFinding | null {
  const primary = pickPrimaryBelowFoldCta(snapshot.data.ctas);
  if (!primary) return null;
  if (primary.visualWeight < MIN_VISUAL_WEIGHT) return null;

  let lowScrollCount = 0;
  for (const event of pageviews) {
    const fraction = readScrollFraction(event);
    if (fraction === null) continue;
    if (fraction < FOLD_FRACTION) {
      lowScrollCount += 1;
    }
  }
  const totalPageviews = pageviews.length;
  const belowFoldShare = totalPageviews > 0 ? lowScrollCount / totalPageviews : 0;
  if (belowFoldShare <= MIN_BELOW_FOLD_SHARE) return null;

  const signals = primary.visualWeightSignals.slice(0, 3);
  const signalList = signals.length > 0 ? signals.join(", ") : "no class signals";

  const summary =
    `${pct(belowFoldShare)}% of pageviews on ${pathRef} never scroll past 40% of the page. ` +
    `${quote(primary.text)} (visual weight ${primary.visualWeight}, foldGuess ${primary.foldGuess}) ` +
    `sits inside the ${primary.landmark} — most visitors never see it.`;

  const recommendation: string[] = [
    `Move ${quote(primary.text)} above the fold, or duplicate it as a secondary CTA in the hero. ` +
      `Right now your ask costs the visitor a scroll, and ${pct(belowFoldShare)}% of them don't pay it.`,
    `If ${primary.landmark} can't be restructured, add an anchor link or sticky version. The signals ` +
      `making this CTA visually important (${signalList}) only matter when the CTA is rendered.`,
  ];

  const evidence: DesignFindingEvidence[] = [
    {
      label: "Primary CTA",
      value: primary.text || "(unnamed CTA)",
      context: `weight ${primary.visualWeight}, fold ${primary.foldGuess}, landmark ${primary.landmark}`,
    },
    {
      label: "Below-fold sessions",
      value: `${pct(belowFoldShare)}%`,
      context: `${formatCount(lowScrollCount)} of ${formatCount(totalPageviews)} pageviews scrolled <40%`,
    },
    { label: "Page", value: pathRef },
  ];

  return {
    id: `above-fold-coverage:${pathRef}`,
    ruleId: "above-fold-coverage",
    category: "fold",
    severity: belowFoldShare > 0.7 ? "critical" : "warn",
    confidence: clamp(0.5 + Math.log10(Math.max(totalPageviews, 1)) * 0.15, 0, 0.95),
    priorityScore: clamp(belowFoldShare, 0, 1),
    pathRef,
    title: `Primary CTA hidden below the fold on ${pathRef}`,
    summary,
    recommendation,
    evidence,
    refs: { snapshotId: snapshot.id, ctaRef: primary.ref },
  };
}

function pickPrimaryBelowFoldCta(ctas: readonly CtaCandidate[]): CtaCandidate | null {
  let best: CtaCandidate | null = null;
  for (const cta of ctas) {
    if (cta.disabled) continue;
    if (cta.foldGuess === "above") continue;
    if (
      best === null ||
      cta.visualWeight > best.visualWeight ||
      (cta.visualWeight === best.visualWeight && cta.documentIndex < best.documentIndex)
    ) {
      best = cta;
    }
  }
  return best;
}
