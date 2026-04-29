import type {
  CtaAggregate,
  InsightFinding,
  InsightInput,
} from "./types";

const CONFIDENCE_FLOOR = 0.2;
const CONFIDENCE_CEILING = 0.98;

export function evaluateAllRules(input: InsightInput): InsightFinding[] {
  assertInsightInput(input);

  return [
    ...evaluateCohortAsymmetry(input),
    ...evaluateNarrativeMismatch(input),
    ...evaluateOnboardingFriction(input),
    ...evaluateCtaHierarchyConflict(input),
    ...evaluateDeadEndRageConcentration(input),
  ];
}

export function evaluateCohortAsymmetry(input: InsightInput): InsightFinding[] {
  if (input.cohorts.length < 2) {
    return [];
  }

  const byPerformance = [...input.cohorts].sort((a, b) => {
    const byConversion = b.conversionRate - a.conversionRate;
    if (byConversion !== 0) return byConversion;
    return a.cohortId.localeCompare(b.cohortId);
  });
  const top = byPerformance[0];
  const bottom = byPerformance[byPerformance.length - 1];
  const conversionGap = top.conversionRate - bottom.conversionRate;
  const intentGap = top.avgIntentScore - bottom.avgIntentScore;
  const sessionCoverage = (top.sessionCount + bottom.sessionCount) / Math.max(input.totals.sessions, 1);

  if (conversionGap < 0.12 || top.sessionCount < 30 || bottom.sessionCount < 30) {
    return [];
  }

  const evidenceRefs = uniq([...top.evidenceRefs, ...bottom.evidenceRefs]).slice(0, 10);
  if (evidenceRefs.length === 0) {
    return [];
  }

  return [
    {
      id: `cohort-asymmetry:${top.cohortId}:${bottom.cohortId}`,
      category: "cohort-asymmetry",
      title: "Cohort performance is materially imbalanced",
      summary: `${top.label} converts ${(conversionGap * 100).toFixed(1)}pp higher than ${bottom.label}, indicating a segmented journey gap rather than random variance.`,
      evidenceRefs,
      recommendedChanges: [
        `Replicate high-intent entry framing from ${top.label} for ${bottom.label}.`,
        `Audit copy and offer parity for ${bottom.label} paths that underperform.`,
      ],
      confidence: bounded(0.45 + conversionGap * 1.4 + intentGap * 0.3 + sessionCoverage * 0.2),
      priorityScore: score(0.55, conversionGap, sessionCoverage),
    },
  ];
}

export function evaluateNarrativeMismatch(input: InsightInput): InsightFinding[] {
  const findings: InsightFinding[] = [];
  const sorted = [...input.narratives].sort((a, b) => a.narrativeId.localeCompare(b.narrativeId));
  for (const narrative of sorted) {
    if (narrative.mismatchRate < 0.25 || narrative.dominantPathShare < 0.2) {
      continue;
    }
    const evidenceRefs = uniq(narrative.evidenceRefs).slice(0, 10);
    if (evidenceRefs.length === 0) {
      continue;
    }

    findings.push({
      id: `narrative-ia-mismatch:${narrative.narrativeId}`,
      category: "narrative-ia-mismatch",
      title: "Narrative promise conflicts with information architecture",
      summary: `${narrative.narrativeLabel} has ${(narrative.mismatchRate * 100).toFixed(1)}% mismatch, while flow consolidates on ${narrative.dominantPathRef}.`,
      evidenceRefs,
      recommendedChanges: [
        `Align landing narrative modules to expected paths (${narrative.expectedPathRefs.join(", ")}).`,
        `Reorder IA blocks so ${narrative.dominantPathRef} is not the accidental default route.`,
      ],
      confidence: bounded(0.4 + narrative.mismatchRate * 0.9 + narrative.dominantPathShare * 0.2),
      priorityScore: score(0.5, narrative.mismatchRate, narrative.dominantPathShare),
    });
  }
  return findings;
}

export function evaluateOnboardingFriction(input: InsightInput): InsightFinding[] {
  const findings: InsightFinding[] = [];
  const sorted = [...input.onboarding].sort((a, b) => a.stepId.localeCompare(b.stepId));
  for (const step of sorted) {
    const dropRate = Math.max(0, step.entryRate - step.completionRate);
    if (dropRate < 0.22 || step.rageRate < 0.08) {
      continue;
    }
    const evidenceRefs = uniq(step.evidenceRefs).slice(0, 10);
    if (evidenceRefs.length === 0) {
      continue;
    }

    findings.push({
      id: `onboarding-friction:${step.stepId}`,
      category: "onboarding-friction",
      title: "Onboarding step creates avoidable abandonment",
      summary: `${step.stepLabel} drops ${(dropRate * 100).toFixed(1)}% of entrants with ${(step.rageRate * 100).toFixed(1)}% rage interactions.`,
      evidenceRefs,
      recommendedChanges: [
        `Reduce cognitive load in ${step.stepLabel} by trimming required actions.`,
        `Introduce inline guidance and error prevention for ${step.stepLabel}.`,
      ],
      confidence: bounded(0.38 + dropRate * 1.1 + step.rageRate * 0.7),
      priorityScore: score(0.58, dropRate, step.rageRate),
    });
  }
  return findings;
}

export function evaluateCtaHierarchyConflict(input: InsightInput): InsightFinding[] {
  const findings: InsightFinding[] = [];
  const groups = groupByPage(input.ctas);
  const pageRefs = Object.keys(groups).sort((a, b) => a.localeCompare(b));

  for (const pageRef of pageRefs) {
    const pageCtas = groups[pageRef];
    if (pageCtas.length < 2) {
      continue;
    }

    const visualTop = [...pageCtas].sort((a, b) => {
      const byWeight = b.visualWeight - a.visualWeight;
      if (byWeight !== 0) return byWeight;
      return a.ctaId.localeCompare(b.ctaId);
    })[0];
    const conversionTop = [...pageCtas].sort((a, b) => {
      const byConv = b.conversionShare - a.conversionShare;
      if (byConv !== 0) return byConv;
      return a.ctaId.localeCompare(b.ctaId);
    })[0];

    if (visualTop.ctaId === conversionTop.ctaId) {
      continue;
    }

    const conversionGap = conversionTop.conversionShare - visualTop.conversionShare;
    if (conversionGap < 0.08) {
      continue;
    }

    const evidenceRefs = uniq([...visualTop.evidenceRefs, ...conversionTop.evidenceRefs]).slice(0, 10);
    if (evidenceRefs.length === 0) {
      continue;
    }

    findings.push({
      id: `cta-hierarchy-conflict:${pageRef}:${visualTop.ctaId}:${conversionTop.ctaId}`,
      category: "cta-hierarchy-conflict",
      title: "Primary CTA emphasis conflicts with conversion behavior",
      summary: `On ${pageRef}, visually dominant "${visualTop.label}" underperforms while "${conversionTop.label}" drives higher conversion share.`,
      evidenceRefs,
      recommendedChanges: [
        `Promote "${conversionTop.label}" above "${visualTop.label}" in hierarchy and styling.`,
        `Reduce visual dominance of low-converting CTA variants on ${pageRef}.`,
      ],
      confidence: bounded(0.42 + conversionGap * 1.3 + conversionTop.clickShare * 0.2),
      priorityScore: score(0.52, conversionGap, conversionTop.clickShare),
    });
  }

  return findings;
}

export function evaluateDeadEndRageConcentration(input: InsightInput): InsightFinding[] {
  const findings: InsightFinding[] = [];
  const sorted = [...input.deadEnds].sort((a, b) => a.pageRef.localeCompare(b.pageRef));
  for (const node of sorted) {
    if (node.deadEndRate < 0.18 || node.rageRate < 0.12 || node.impactedSessions < 20) {
      continue;
    }
    const evidenceRefs = uniq(node.evidenceRefs).slice(0, 10);
    if (evidenceRefs.length === 0) {
      continue;
    }

    findings.push({
      id: `dead-end-rage-concentration:${node.pageRef}`,
      category: "dead-end-rage-concentration",
      title: "Dead-end path concentrates rage interactions",
      summary: `${node.pageRef} shows ${(node.deadEndRate * 100).toFixed(1)}% dead-end exits and ${(node.rageRate * 100).toFixed(1)}% rage signals across ${node.impactedSessions} sessions.`,
      evidenceRefs,
      recommendedChanges: [
        `Add explicit next-step exits from ${node.pageRef} to high-intent destinations.`,
        `Instrument and remove interaction traps causing repeated dead-end actions.`,
      ],
      confidence: bounded(0.46 + node.deadEndRate * 0.9 + node.rageRate * 0.8),
      priorityScore: score(0.6, node.deadEndRate, node.rageRate),
    });
  }
  return findings;
}

function assertInsightInput(input: InsightInput): void {
  if (typeof input !== "object" || input === null) {
    throw new TypeError("input must be an object.");
  }
  if (typeof input.siteId !== "string" || input.siteId.trim().length === 0) {
    throw new TypeError("input.siteId must be a non-empty string.");
  }
  if (input.generatedAt !== undefined && Number.isNaN(Date.parse(input.generatedAt))) {
    throw new TypeError("input.generatedAt must be a valid ISO date string.");
  }
  assertNonNegativeFinite(input.totals?.sessions, "input.totals.sessions");
  assertArray(input.cohorts, "input.cohorts");
  assertArray(input.narratives, "input.narratives");
  assertArray(input.onboarding, "input.onboarding");
  assertArray(input.ctas, "input.ctas");
  assertArray(input.deadEnds, "input.deadEnds");
}

function assertArray(value: unknown, path: string): void {
  if (!Array.isArray(value)) {
    throw new TypeError(`${path} must be an array.`);
  }
}

function assertNonNegativeFinite(value: unknown, path: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${path} must be a non-negative finite number.`);
  }
}

function bounded(value: number): number {
  return Math.max(CONFIDENCE_FLOOR, Math.min(CONFIDENCE_CEILING, round(value)));
}

function score(weight: number, intensity: number, coverage: number): number {
  return round(100 * (weight + intensity * 0.7 + coverage * 0.5));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function uniq(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function groupByPage(input: CtaAggregate[]): Record<string, CtaAggregate[]> {
  const out: Record<string, CtaAggregate[]> = {};
  for (const cta of input) {
    if (!out[cta.pageRef]) {
      out[cta.pageRef] = [];
    }
    out[cta.pageRef].push(cta);
  }
  return out;
}
