/**
 * Pure statistical functions for experiment outcome computation.
 *
 * No external dependencies — all math is implemented here so the
 * results are reproducible, auditable, and independent of any
 * third-party stats library.
 *
 * References:
 *   - Chi-squared test for two proportions: standard frequentist formula
 *   - Abramowitz & Stegun 7.1.26 for erfc approximation (max error 1.5e-7)
 *   - Welch's t-test: Welch (1947), Biometrika
 *   - Minimum sample size: standard two-proportion z-test power formula
 */

// ---------------------------------------------------------------------------
// Error function
// ---------------------------------------------------------------------------

/** erfc(x) — complementary error function. Max error ~1.5e-7. */
function erfc(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly =
    t *
    (0.254829592 +
      t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const result = poly * Math.exp(-x * x);
  return x >= 0 ? result : 2 - result;
}

/** Two-sided p-value from a z-score. */
function pValueFromZ(z: number): number {
  return erfc(Math.abs(z) / Math.sqrt(2));
}

// ---------------------------------------------------------------------------
// Chi-squared test for two proportions (binary outcome, e.g., converted/not)
// ---------------------------------------------------------------------------

export interface ProportionTestResult {
  pValue: number;
  confidence: number; // 1 - pValue
  zScore: number;
  controlRate: number;
  variantRate: number;
  liftPct: number; // absolute pp lift (variantRate - controlRate) * 100
  relLift: number; // relative lift: (variantRate - controlRate) / controlRate
}

/**
 * Chi-squared test (as z-test for two proportions) for binary conversion rates.
 * Use this when the primary metric is "converted or not" (click, signup, purchase).
 *
 * Returns null if there is insufficient data to compute (zero participants in
 * either arm, or zero pooled rate — avoid division by zero).
 */
export function chiSquaredTwoProportions(
  controlConversions: number,
  controlParticipants: number,
  variantConversions: number,
  variantParticipants: number,
): ProportionTestResult | null {
  if (controlParticipants <= 0 || variantParticipants <= 0) return null;

  const p1 = controlConversions / controlParticipants;
  const p2 = variantConversions / variantParticipants;
  const pPool = (controlConversions + variantConversions) / (controlParticipants + variantParticipants);

  if (pPool <= 0 || pPool >= 1) return null;

  const se = Math.sqrt(pPool * (1 - pPool) * (1 / controlParticipants + 1 / variantParticipants));
  if (se === 0) return null;

  const zScore = (p2 - p1) / se;
  const pValue = pValueFromZ(zScore);
  const liftPct = (p2 - p1) * 100;
  const relLift = p1 > 0 ? (p2 - p1) / p1 : 0;

  return {
    pValue,
    confidence: 1 - pValue,
    zScore,
    controlRate: p1,
    variantRate: p2,
    liftPct,
    relLift,
  };
}

// ---------------------------------------------------------------------------
// One-sided test for guardrail evaluation
// ---------------------------------------------------------------------------

/**
 * One-sided p-value: probability that variant rate is lower than control
 * by chance alone. Used for guardrail metrics ("do not degrade this metric").
 *
 * Returns the one-sided p-value (lower = more confident the variant hurt this metric).
 */
export function guardrailOneSidedPValue(
  controlConversions: number,
  controlParticipants: number,
  variantConversions: number,
  variantParticipants: number,
): number | null {
  const result = chiSquaredTwoProportions(
    controlConversions,
    controlParticipants,
    variantConversions,
    variantParticipants,
  );
  if (!result) return null;
  // One-sided: we care about the direction (variant < control, i.e. zScore < 0)
  return result.zScore < 0 ? result.pValue / 2 : 1 - result.pValue / 2;
}

// ---------------------------------------------------------------------------
// Minimum sample size (for sequential testing guard)
// ---------------------------------------------------------------------------

/**
 * Minimum participants per arm before significance can be declared.
 *
 * Uses the standard two-proportion z-test power formula:
 *   n = (z_alpha + z_beta)^2 * (p1*(1-p1) + p2*(1-p2)) / (p1-p2)^2
 *
 * @param baseRate     Estimated baseline conversion rate (0..1)
 * @param mde          Minimum detectable effect as relative lift (default 0.05 = 5%)
 * @param power        Desired power (default 0.80)
 * @param alpha        Significance level, two-sided (default 0.05)
 */
export function minimumSampleSizePerArm(
  baseRate: number,
  mde = 0.05,
  power = 0.8,
  alpha = 0.05,
): number {
  if (baseRate <= 0 || baseRate >= 1 || mde <= 0) return 100; // safe default

  const p1 = baseRate;
  const p2 = baseRate * (1 + mde);
  if (p2 >= 1) return 100;

  // z_alpha/2 for two-sided test; z_beta for power
  const zAlpha = 1.96; // alpha = 0.05
  const zBeta = power === 0.9 ? 1.282 : power === 0.95 ? 1.645 : 0.842; // default power=0.8

  const numerator = (zAlpha + zBeta) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2));
  const denominator = (p2 - p1) ** 2;

  return Math.ceil(numerator / denominator);

  void alpha; // alpha is encoded in zAlpha above
}

// ---------------------------------------------------------------------------
// Sequential testing guard
// ---------------------------------------------------------------------------

export interface SequentialGuardParams {
  confidence: number;        // computed confidence (1 - pValue)
  participants: number;      // total participants (both arms combined)
  elapsedDays: number;       // days since experiment start
  minimumParticipants: number; // from minimumSampleSizePerArm * 2
  minimumDays?: number;      // default 7
  confidenceThreshold?: number; // default 0.95
}

/**
 * Returns true only when ALL three conditions are met:
 *   1. confidence >= threshold (default 0.95)
 *   2. total participants >= minimumParticipants (power analysis)
 *   3. elapsed days >= minimumDays (default 7, to wash out day-of-week noise)
 *
 * This prevents false positives from early stopping on noise.
 */
export function isReadyToStop(params: SequentialGuardParams): boolean {
  const {
    confidence,
    participants,
    elapsedDays,
    minimumParticipants,
    minimumDays = 7,
    confidenceThreshold = 0.95,
  } = params;
  return (
    confidence >= confidenceThreshold &&
    participants >= minimumParticipants &&
    elapsedDays >= minimumDays
  );
}

// ---------------------------------------------------------------------------
// Result classification
// ---------------------------------------------------------------------------

export type ExperimentResult = 'positive' | 'negative' | 'inconclusive';

/**
 * Classify experiment outcome once it is ready to stop.
 * A positive result means the variant meaningfully outperformed control.
 * A negative result means control meaningfully outperformed variant.
 * Inconclusive means significance was never reached within the duration.
 */
export function classifyResult(
  result: ProportionTestResult | null,
  reachedSignificance: boolean,
  confidenceThreshold = 0.95,
): ExperimentResult {
  if (!reachedSignificance || !result || result.confidence < confidenceThreshold) {
    return 'inconclusive';
  }
  return result.liftPct >= 0 ? 'positive' : 'negative';
}
