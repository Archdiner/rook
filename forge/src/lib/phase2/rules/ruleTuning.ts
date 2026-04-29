/**
 * Tunable knobs for Phase 2 audit rules. Operators can tweak these when
 * calibrating against live traffic (see `docs/PHASE2_LIVE_TUNING_PLAYBOOK.md`).
 * Exported as named constants so rules import in one place.
 */

/** ----- cohort pain (composite asymmetry) ----- */

export const COHORT_PAIN_WEIGHTS = {
  /** rage events per mapped session intensity */
  rage: 0.45,
  /** JavaScript `$exception`-style errors per session */
  error: 0.35,
  /** shallow single-path sessions ("stuck browsing") density */
  stagnation: 0.2,
} as const;

export const COHORT_PAIN_ELIGIBILITY = {
  minSessionsPerCohort: 50,
  /** composite scale is 0..1-ish; fires when top ≥ median * multiple AND absolute floor */
  medianMultipleFloor: 2,
  compositeAbsoluteFloor: 0.05,
  severityMultipleCritical: 4,
  /** denominator guard for stagnation normalization */
  epsilon: 1e-6,
} as const;
