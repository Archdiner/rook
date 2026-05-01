/**
 * Phase 2 validation gate. Inspects a `RollupResult` together with the active
 * `Phase2SiteConfig` and emits structured warnings before findings are returned
 * to clients. Pure; deterministic for fixed input; no I/O.
 *
 * Warning order is `(level rank desc, code asc)` where rank is
 * block=3, warn=2, info=1. `GateResult.ok` is `true` iff there are zero
 * `block`-level warnings; the route layer maps it to `trustworthy`.
 */

import type {
  GateLevel,
  GateResult,
  GateWarning,
  Phase2SiteConfig,
  RollupResult,
  TimeWindow,
} from "../types";

export interface RunGateInput {
  rollup: RollupResult;
  config: Phase2SiteConfig;
  window: TimeWindow;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

/** Threshold mirrors `RULE.cohortAsymmetry.minSessionsPerCohort` in phase1/insights/rules.ts. */
const COHORT_MIN_SESSIONS = 30;
const COHORT_IMBALANCE_RATIO = 5;
const LOW_SESSION_WARN = 50;
const LOW_SESSION_BLOCK = 10;
const DOMINANT_SOURCE_SHARE = 0.9;

const LEVEL_RANK: Record<GateLevel, number> = { block: 3, warn: 2, info: 1 };

type GateCheck = (input: RunGateInput) => GateWarning | null;

const CHECKS: readonly GateCheck[] = [
  checkWindowTooShort,
  checkLowSessionCount,
  checkCohortImbalance,
  checkEmptyNarrativesConfig,
  checkEmptyOnboardingConfig,
  checkEmptyCtaConfig,
  checkNoDeadEndData,
  checkDominantSource,
];

export function runInsightInputGate(input: RunGateInput): GateResult {
  assertRunGateInput(input);

  const warnings: GateWarning[] = [];
  for (const check of CHECKS) {
    const warning = check(input);
    if (warning !== null) {
      warnings.push(warning);
    }
  }

  const sorted = sortWarnings(warnings);
  const ok = sorted.every((w) => w.level !== "block");
  return { ok, warnings: sorted };
}

function checkWindowTooShort(input: RunGateInput): GateWarning | null {
  const ms = input.rollup.diagnostics.windowDurationMs;
  if (ms >= ONE_DAY_MS) {
    return null;
  }
  const hours = round1(ms / ONE_HOUR_MS);
  return {
    code: "WINDOW_TOO_SHORT",
    level: "warn",
    message: `Window covers ${hours}h; insight rules assume at least 24h of activity.`,
    detail: { hours },
  };
}

function checkLowSessionCount(input: RunGateInput): GateWarning | null {
  const sessions = input.rollup.diagnostics.uniqueSessions;
  if (sessions >= LOW_SESSION_WARN) {
    return null;
  }
  const level: GateLevel = sessions < LOW_SESSION_BLOCK ? "block" : "warn";
  return {
    code: "LOW_SESSION_COUNT",
    level,
    message: `${sessions} unique sessions in window; rules need materially more for stable signals.`,
    detail: { sessions },
  };
}

function checkCohortImbalance(input: RunGateInput): GateWarning | null {
  const cohorts = input.rollup.insightInput.cohorts;
  if (cohorts.length < 2) {
    return null;
  }

  let smallest = Number.POSITIVE_INFINITY;
  let largest = 0;
  for (const cohort of cohorts) {
    if (cohort.sessionCount < smallest) smallest = cohort.sessionCount;
    if (cohort.sessionCount > largest) largest = cohort.sessionCount;
  }

  if (smallest >= COHORT_MIN_SESSIONS) {
    return null;
  }
  // Skip when smallest is 0: ratio is undefined and LOW_SESSION_COUNT
  // already captures the population problem.
  if (smallest === 0) {
    return null;
  }

  const ratio = largest / smallest;
  if (ratio < COHORT_IMBALANCE_RATIO) {
    return null;
  }

  return {
    code: "COHORT_IMBALANCE",
    level: "warn",
    message: `Cohorts imbalanced: smallest=${smallest}, largest=${largest} (${round1(ratio)}x); cohort rule needs >=${COHORT_MIN_SESSIONS} per cohort.`,
    detail: { smallest, largest, ratio: round1(ratio) },
  };
}

function checkEmptyNarrativesConfig(input: RunGateInput): GateWarning | null {
  if (input.config.narratives.length > 0) {
    return null;
  }
  return {
    code: "EMPTY_NARRATIVES_CONFIG",
    level: "info",
    message: "No narratives configured; narrative-ia-mismatch findings will not fire.",
  };
}

function checkEmptyOnboardingConfig(input: RunGateInput): GateWarning | null {
  if (input.config.onboardingSteps.length > 0) {
    return null;
  }
  return {
    code: "EMPTY_ONBOARDING_CONFIG",
    level: "info",
    message: "No onboarding steps configured; onboarding-friction findings will not fire.",
  };
}

function checkEmptyCtaConfig(input: RunGateInput): GateWarning | null {
  if (input.config.ctas.length > 0) {
    return null;
  }
  return {
    code: "EMPTY_CTA_CONFIG",
    level: "info",
    message: "No CTAs configured; cta-hierarchy-conflict findings will not fire.",
  };
}

function checkNoDeadEndData(input: RunGateInput): GateWarning | null {
  if (input.rollup.insightInput.deadEnds.length > 0) {
    return null;
  }
  if (input.rollup.diagnostics.totalEvents <= 0) {
    return null;
  }
  return {
    code: "NO_DEAD_END_DATA",
    level: "info",
    message: "Engine had events but no path crossed the dead-end minimum.",
  };
}

/**
 * DOMINANT_SOURCE: when one source contributes >= 90% of events the window
 * may not represent the full traffic mix and findings should be read with
 * that bias in mind.
 */
function checkDominantSource(input: RunGateInput): GateWarning | null {
  const counts = input.rollup.diagnostics.sourceCounts;
  if (counts.length < 2) {
    return null;
  }
  const total = counts.reduce((sum, entry) => sum + entry.events, 0);
  if (total === 0) {
    return null;
  }
  const top = counts.reduce((best, entry) => (entry.events > best.events ? entry : best));
  const share = top.events / total;
  if (share < DOMINANT_SOURCE_SHARE) {
    return null;
  }
  return {
    code: "DOMINANT_SOURCE",
    level: "info",
    message: `Source "${top.source}" contributes ${Math.round(share * 100)}% of events; findings may not generalize across other sources.`,
    detail: { source: top.source, share: round1(share) },
  };
}

function sortWarnings(warnings: GateWarning[]): GateWarning[] {
  return [...warnings].sort((a, b) => {
    const byLevel = LEVEL_RANK[b.level] - LEVEL_RANK[a.level];
    if (byLevel !== 0) return byLevel;
    return a.code.localeCompare(b.code);
  });
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function assertRunGateInput(input: RunGateInput): void {
  if (typeof input !== "object" || input === null) {
    throw new TypeError("input must be an object.");
  }
  assertRollup(input.rollup, "input.rollup");
  assertConfig(input.config, "input.config");
  assertWindow(input.window, "input.window");
}

function assertRollup(value: unknown, path: string): void {
  if (typeof value !== "object" || value === null) {
    throw new TypeError(`${path} must be an object.`);
  }
  const rollup = value as RollupResult;

  if (typeof rollup.diagnostics !== "object" || rollup.diagnostics === null) {
    throw new TypeError(`${path}.diagnostics must be an object.`);
  }
  assertNonNegativeFinite(rollup.diagnostics.windowDurationMs, `${path}.diagnostics.windowDurationMs`);
  assertNonNegativeFinite(rollup.diagnostics.totalEvents, `${path}.diagnostics.totalEvents`);
  assertNonNegativeFinite(rollup.diagnostics.uniqueSessions, `${path}.diagnostics.uniqueSessions`);
  assertArray(rollup.diagnostics.sources, `${path}.diagnostics.sources`);
  assertArray(rollup.diagnostics.sourceCounts, `${path}.diagnostics.sourceCounts`);

  if (typeof rollup.insightInput !== "object" || rollup.insightInput === null) {
    throw new TypeError(`${path}.insightInput must be an object.`);
  }
  assertArray(rollup.insightInput.cohorts, `${path}.insightInput.cohorts`);
  assertArray(rollup.insightInput.deadEnds, `${path}.insightInput.deadEnds`);
}

function assertConfig(value: unknown, path: string): void {
  if (typeof value !== "object" || value === null) {
    throw new TypeError(`${path} must be an object.`);
  }
  const config = value as Phase2SiteConfig;
  assertArray(config.narratives, `${path}.narratives`);
  assertArray(config.onboardingSteps, `${path}.onboardingSteps`);
  assertArray(config.ctas, `${path}.ctas`);
}

function assertWindow(value: unknown, path: string): void {
  if (typeof value !== "object" || value === null) {
    throw new TypeError(`${path} must be an object.`);
  }
  const window = value as TimeWindow;
  if (typeof window.start !== "string" || Number.isNaN(Date.parse(window.start))) {
    throw new TypeError(`${path}.start must be a valid ISO date string.`);
  }
  if (typeof window.end !== "string" || Number.isNaN(Date.parse(window.end))) {
    throw new TypeError(`${path}.end must be a valid ISO date string.`);
  }
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
