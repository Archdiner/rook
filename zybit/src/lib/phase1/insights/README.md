# Phase 1 Insight Engine

Deterministic insight generation from normalized behavior aggregates. This module emits evidence-grounded findings with confidence and priority scoring.

## Files

- `types.ts`: Input aggregate contracts and `InsightFinding` output schema.
- `rules.ts`: Category evaluators for cohort asymmetry, narrative/IA mismatch, onboarding friction, CTA hierarchy conflict, and dead-end rage concentration.
- `rank.ts`: Evidence filter, dedupe, stable ranking, and output capping.
- `generate.ts`: Orchestrator (`generateFindings`) combining rules and ranking.
- `index.ts`: Public exports.

## Guarantees

- Findings without `evidenceRefs` are always dropped.
- Ranking is deterministic with stable tie-breakers.
- Output is capped to top 3 by default.

## Usage

```ts
import { generateFindings, type InsightInput } from "@/lib/phase1/insights";

const input: InsightInput = {
  siteId: "site_123",
  totals: { sessions: 420 },
  cohorts: [],
  narratives: [],
  onboarding: [],
  ctas: [],
  deadEnds: [],
};

const findings = generateFindings(input, { maxFindings: 3 });
```
