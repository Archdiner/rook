# Phase 1 Sufficiency Core

This module provides a deterministic, framework-agnostic data sufficiency engine for Phase 1 analysis readiness.

## What it does

- Evaluates each readiness category against explicit thresholds.
- Produces deterministic "not ready" reasons in a fixed metric order (`sessions`, `events`, `conversions`).
- Aggregates category-level results into an overall readiness summary.
- Estimates time to target using current collection rate.

## Categories

- `heroDropoff`
- `rageClicks`
- `funnelDropoff`
- `cohortAsymmetry`
- `narrativeSignals`
- `abValidation`

## Default thresholds

Thresholds are in `config.ts` as `DEFAULT_SUFFICIENCY_THRESHOLDS`. Each category defines minimum:

- `sessions`
- `events`
- `conversions`

Reanalysis trigger is defined as `DEFAULT_REANALYSIS_EVIDENCE_DELTA = 0.2` (20%).

## Algorithm

For each category:

1. Load threshold values for sessions/events/conversions.
2. Compare observed evidence counts with required counts.
3. Emit one reason per unmet metric in fixed order.
4. Mark category as ready only when all required metrics are satisfied.
5. Compute progress as the minimum metric ratio, clamped to `[0, 1]`.

All-category evaluation:

1. Evaluate categories in `SUFFICIENCY_CATEGORY_ORDER`.
2. Build a stable map and ordered result array.
3. Mark `overallReady` only if every category is ready.

ETA estimation:

1. Compute remaining amount (`target - current`).
2. Return `null` if remaining is positive and rate is `0`.
3. Return floating-point days remaining and optional ISO ETA when `nowIso` is provided.

## Extension points

- Override thresholds by passing a custom `thresholds` object into evaluate functions.
- Replace defaults by constructing your own `SufficiencyConfig`.
- Add future metrics by extending metric types and keeping deterministic reason ordering.

## Purity guarantees

- No network or database access.
- No module-level mutable state.
- Outputs are deterministic for the same inputs.
