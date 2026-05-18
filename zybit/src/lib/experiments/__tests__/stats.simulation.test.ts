/**
 * Monte Carlo simulation of the experiment auto-stop pipeline under the null
 * hypothesis (variant has exactly the same true conversion rate as control).
 *
 * Why this test exists
 * --------------------
 * Unit tests verify each stats function in isolation. They do NOT verify the
 * marketing claim — "when Zybit calls a winner, it's actually a winner."
 * That claim is a property of the *pipeline*: hourly chi-squared tests +
 * sequential guard + classification. A correct chi-squared function does
 * not imply a correct pipeline, because repeated peeking inflates the
 * false-positive rate above the nominal alpha.
 *
 * What the simulation measures
 * ----------------------------
 * Under the null (both arms drawn from Bernoulli(baseRate)), the pipeline
 * should declare a "winner" (positive OR negative — direction-agnostic) in
 * AT MOST `alpha` fraction of runs. With alpha=0.05, no more than 5% of
 * null experiments should auto-stop with a positive or negative result.
 *
 * If the measured rate exceeds 5%, the difference quantifies how badly
 * repeated peeking is inflating the false-positive rate of the pipeline.
 *
 * Test stance (per spec discussion): "Write the simulation, let the number
 * speak." If the pipeline blows the nominal alpha, this test fails and
 * prints the measured rate so the gap is visible.
 *
 * Reproducibility
 * ---------------
 * Uses a seeded mulberry32 RNG. Same seed → same outcomes across runs and
 * across machines, so CI doesn't flake.
 */

import { describe, it, expect } from 'vitest';
import {
  chiSquaredTwoProportions,
  minimumSampleSizePerArm,
  isReadyToStop,
  classifyResult,
} from '../stats';

// ---------------------------------------------------------------------------
// Seeded RNG (mulberry32) — small, fast, deterministic
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sample k ~ Binomial(n, p) via direct summation of Bernoulli draws.
 * Used per hourly batch — n is small (a few hundred), so this is fine.
 */
function sampleBinomial(n: number, p: number, rng: () => number): number {
  let k = 0;
  for (let i = 0; i < n; i++) if (rng() < p) k++;
  return k;
}

// ---------------------------------------------------------------------------
// One simulated null experiment
// ---------------------------------------------------------------------------

interface SimParams {
  baseRate: number;            // true conversion rate (same for both arms — null)
  durationDays: number;        // experiment duration cap
  hourlyTrafficPerArm: number; // visitors per arm per hour
  mde: number;                 // MDE used for sample-size calc (default 0.05)
  minimumDays: number;         // sequential guard floor
  confidenceThreshold: number; // sequential guard confidence threshold
}

type SimOutcome = 'positive' | 'negative' | 'inconclusive_duration' | 'no_data';

/**
 * Simulates the documented pipeline:
 *   - Each hour, traffic arrives in both arms.
 *   - Each hour after the cron tick, chi-squared + sequential guard are
 *     evaluated against cumulative counts.
 *   - If isReadyToStop returns true, the experiment auto-stops and is
 *     classified as positive/negative.
 *   - If duration expires without a stop, the experiment is inconclusive.
 *
 * This is intentionally a black-box simulation against the documented
 * stop rule, not a copy of computeOutcomes.ts. It exercises the public
 * stats API directly.
 */
function simulateNullExperiment(params: SimParams, rng: () => number): SimOutcome {
  const totalHours = params.durationDays * 24;
  let controlConv = 0;
  let controlPart = 0;
  let variantConv = 0;
  let variantPart = 0;

  for (let hour = 1; hour <= totalHours; hour++) {
    controlConv += sampleBinomial(params.hourlyTrafficPerArm, params.baseRate, rng);
    controlPart += params.hourlyTrafficPerArm;
    variantConv += sampleBinomial(params.hourlyTrafficPerArm, params.baseRate, rng);
    variantPart += params.hourlyTrafficPerArm;

    const elapsedDays = hour / 24;

    // Skip cron evaluation until the minimum-days floor — the guard would
    // block any stop before then anyway. This is an optimization, not a
    // behavior change.
    if (elapsedDays < params.minimumDays) continue;

    const r = chiSquaredTwoProportions(controlConv, controlPart, variantConv, variantPart);
    if (r === null) continue;

    const observedBase = controlPart > 0 ? controlConv / controlPart : params.baseRate;
    const minPerArm = minimumSampleSizePerArm(observedBase, params.mde);

    const ready = isReadyToStop({
      confidence: r.confidence,
      participants: Math.min(controlPart, variantPart),
      elapsedDays,
      minimumParticipants: minPerArm,
      minimumDays: params.minimumDays,
      confidenceThreshold: params.confidenceThreshold,
    });

    if (ready) {
      const classified = classifyResult(r, true, params.confidenceThreshold);
      // Under the null, ANY positive/negative classification is a false
      // positive. classifyResult should not return 'inconclusive' here
      // because we passed reachedSignificance=true and confidence>=threshold,
      // but guard against it just in case.
      if (classified === 'positive') return 'positive';
      if (classified === 'negative') return 'negative';
    }
  }

  if (controlPart === 0 || variantPart === 0) return 'no_data';
  return 'inconclusive_duration';
}

// ---------------------------------------------------------------------------
// The simulation test
// ---------------------------------------------------------------------------

describe('null-experiment pipeline false-positive rate', () => {
  /**
   * Default parameters: baseRate 10%, 14-day duration, ~300/hour per arm.
   * With baseRate=0.10 and mde=0.05, minPerArm ≈ 57,776. At 300/hour per
   * arm that's reached at day ~8, so the sample-size guard kicks in
   * shortly after the 7-day floor — a realistic operating regime.
   */
  const DEFAULT_PARAMS: SimParams = {
    baseRate: 0.10,
    durationDays: 14,
    hourlyTrafficPerArm: 300,
    mde: 0.05,
    minimumDays: 7,
    confidenceThreshold: 0.95,
  };

  // 2,000 experiments → Monte Carlo standard error ≈ sqrt(0.05*0.95/2000) ≈ 0.49%.
  // So a measured FP rate of e.g. 7% is well outside the 95% CI of nominal 5%.
  const N_EXPERIMENTS = 2000;
  const NOMINAL_ALPHA = 0.05;

  it(
    `pipeline false-positive rate <= nominal alpha (${NOMINAL_ALPHA}) over ${N_EXPERIMENTS} null experiments`,
    () => {
      const rng = mulberry32(42);
      let falsePositives = 0;
      let inconclusive = 0;
      let noData = 0;
      let positives = 0;
      let negatives = 0;

      for (let i = 0; i < N_EXPERIMENTS; i++) {
        const outcome = simulateNullExperiment(DEFAULT_PARAMS, rng);
        if (outcome === 'positive') {
          falsePositives++;
          positives++;
        } else if (outcome === 'negative') {
          falsePositives++;
          negatives++;
        } else if (outcome === 'inconclusive_duration') {
          inconclusive++;
        } else if (outcome === 'no_data') {
          noData++;
        }
      }

      const fpRate = falsePositives / N_EXPERIMENTS;

      // Print the measured number unconditionally so the test failure
      // message includes the diagnostic, not just "expected < 0.05".
      console.log(
        `[null-pipeline simulation] FP rate = ${(fpRate * 100).toFixed(2)}% ` +
        `(${falsePositives}/${N_EXPERIMENTS}: ${positives} positive, ${negatives} negative, ` +
        `${inconclusive} inconclusive, ${noData} no-data)`,
      );

      expect(fpRate).toBeLessThanOrEqual(NOMINAL_ALPHA);
    },
    60_000, // generous timeout for the Monte Carlo
  );

  /**
   * Sanity check: with the sequential guard's confidenceThreshold raised
   * to 0.999, far fewer false positives should slip through. This isn't
   * a fix; it's a sanity test that the simulation responds to parameters.
   * Reduces test brittleness — if BOTH this and the main test fail with
   * the same FP rate, the simulation itself is broken.
   */
  it(
    'sanity: raising confidenceThreshold to 0.999 drops the FP rate substantially',
    () => {
      const rng = mulberry32(43);
      const params = { ...DEFAULT_PARAMS, confidenceThreshold: 0.999 };
      let fp = 0;
      for (let i = 0; i < N_EXPERIMENTS; i++) {
        const outcome = simulateNullExperiment(params, rng);
        if (outcome === 'positive' || outcome === 'negative') fp++;
      }
      const fpRate = fp / N_EXPERIMENTS;
      console.log(
        `[null-pipeline sanity, 0.999 threshold] FP rate = ${(fpRate * 100).toFixed(2)}% (${fp}/${N_EXPERIMENTS})`,
      );
      // Should be very low — definitely well under 5%.
      expect(fpRate).toBeLessThan(0.02);
    },
    60_000,
  );

  /**
   * Sanity check: positive and negative false positives should be roughly
   * balanced under the null (symmetric noise). If we see e.g. 95% positives,
   * something in classifyResult or the lift computation is biased.
   * Documents the expectation for future debugging.
   */
  it(
    'sanity: false positives are roughly symmetric in direction under the null',
    () => {
      const rng = mulberry32(44);
      let pos = 0;
      let neg = 0;
      for (let i = 0; i < N_EXPERIMENTS; i++) {
        const outcome = simulateNullExperiment(DEFAULT_PARAMS, rng);
        if (outcome === 'positive') pos++;
        else if (outcome === 'negative') neg++;
      }
      const total = pos + neg;
      if (total < 20) {
        // Too few to assess symmetry; the main test will catch FP rate issues.
        return;
      }
      const posFraction = pos / total;
      console.log(
        `[null-pipeline symmetry] pos=${pos}, neg=${neg}, posFraction=${(posFraction * 100).toFixed(1)}%`,
      );
      // Expect roughly 50/50 (+/- 15%) under symmetric null noise.
      expect(posFraction).toBeGreaterThan(0.35);
      expect(posFraction).toBeLessThan(0.65);
    },
    60_000,
  );
});
