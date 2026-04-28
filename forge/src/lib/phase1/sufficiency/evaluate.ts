import {
  DEFAULT_SUFFICIENCY_THRESHOLDS,
  SUFFICIENCY_CATEGORY_ORDER,
} from "./config";
import type {
  AllCategoriesReadinessResult,
  CategoryReadinessResult,
  EtaEstimate,
  EvaluateAllCategoriesInput,
  EvaluateCategoryReadinessInput,
  EvidenceSnapshot,
  ReadinessReason,
  SufficiencyMetricKey,
  SufficiencyThreshold,
} from "./types";

const METRIC_ORDER: readonly SufficiencyMetricKey[] = ["sessions", "events", "conversions"] as const;

/**
 * Evaluates readiness for a single category using configured thresholds and evidence.
 */
export function evaluateCategoryReadiness(
  input: EvaluateCategoryReadinessInput,
): CategoryReadinessResult {
  const thresholds = input.thresholds ?? DEFAULT_SUFFICIENCY_THRESHOLDS;
  assertEvidenceSnapshot(input.evidence, "input.evidence");
  const threshold = thresholds[input.category];
  assertThreshold(threshold, `thresholds.${input.category}`);

  const reasons = buildReasons(input.evidence, threshold);
  const progress = computeProgress(input.evidence, threshold);

  return {
    category: input.category,
    ready: reasons.length === 0,
    threshold,
    evidence: input.evidence,
    progress,
    reasons,
  };
}

/**
 * Evaluates all categories in deterministic order and returns an aggregate readiness view.
 */
export function evaluateAllCategories(
  input: EvaluateAllCategoriesInput,
): AllCategoriesReadinessResult {
  const thresholds = input.thresholds ?? DEFAULT_SUFFICIENCY_THRESHOLDS;
  assertEvidenceSnapshot(input.evidence, "input.evidence");

  const orderedResults = SUFFICIENCY_CATEGORY_ORDER.map((category) =>
    evaluateCategoryReadiness({ category, evidence: input.evidence, thresholds }),
  );

  const categories = Object.fromEntries(
    orderedResults.map((result) => [result.category, result]),
  ) as AllCategoriesReadinessResult["categories"];

  const readyCount = orderedResults.filter((result) => result.ready).length;

  return {
    overallReady: readyCount === SUFFICIENCY_CATEGORY_ORDER.length,
    readyCount,
    totalCount: SUFFICIENCY_CATEGORY_ORDER.length,
    categories,
    orderedResults,
  };
}

/**
 * Estimates days and optional ISO ETA to reach a target at the current daily rate.
 */
export function estimateNextTargetEta(args: {
  current: number;
  target: number;
  ratePerDay: number;
  nowIso?: string;
}): EtaEstimate | null {
  assertCount(args.current, "args.current");
  assertCount(args.target, "args.target");
  assertCount(args.ratePerDay, "args.ratePerDay");
  if (args.nowIso !== undefined) {
    assertIsoDate(args.nowIso, "args.nowIso");
  }

  if (args.current >= args.target) {
    return {
      target: args.target,
      current: args.current,
      remaining: 0,
      ratePerDay: args.ratePerDay,
      daysRemaining: 0,
      etaIso: args.nowIso ?? null,
    };
  }

  if (args.ratePerDay === 0) {
    return null;
  }

  const remaining = args.target - args.current;
  const daysRemaining = remaining / args.ratePerDay;
  const etaIso = args.nowIso ? addDaysToIso(args.nowIso, Math.ceil(daysRemaining)) : null;

  return {
    target: args.target,
    current: args.current,
    remaining,
    ratePerDay: args.ratePerDay,
    daysRemaining,
    etaIso,
  };
}

function buildReasons(evidence: EvidenceSnapshot, threshold: SufficiencyThreshold): ReadinessReason[] {
  return METRIC_ORDER.flatMap((metric) => {
    const required = threshold[metric];
    const observed = evidence[metric];
    const missing = Math.max(0, required - observed);

    if (missing === 0) {
      return [];
    }

    return [
      {
        metric,
        required,
        observed,
        missing,
        message: `Need ${missing} more ${metric} (${observed}/${required}).`,
      },
    ];
  });
}

function computeProgress(evidence: EvidenceSnapshot, threshold: SufficiencyThreshold): number {
  const ratios = METRIC_ORDER.map((metric) => {
    const required = threshold[metric];
    if (required === 0) {
      return 1;
    }
    return evidence[metric] / required;
  });

  const minRatio = Math.min(...ratios);
  return Math.max(0, Math.min(1, minRatio));
}

function addDaysToIso(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function assertThreshold(value: SufficiencyThreshold, path: string): void {
  assertCount(value.sessions, `${path}.sessions`);
  assertCount(value.events, `${path}.events`);
  assertCount(value.conversions, `${path}.conversions`);
}

function assertEvidenceSnapshot(value: EvidenceSnapshot, path: string): void {
  assertCount(value.sessions, `${path}.sessions`);
  assertCount(value.events, `${path}.events`);
  assertCount(value.conversions, `${path}.conversions`);
  if (value.observedAt !== undefined) {
    assertIsoDate(value.observedAt, `${path}.observedAt`);
  }
}

function assertCount(value: number, path: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${path} must be a non-negative finite number.`);
  }
}

function assertIsoDate(value: string, path: string): void {
  if (Number.isNaN(Date.parse(value))) {
    throw new TypeError(`${path} must be a valid ISO date string.`);
  }
}
