# Phase 1 Core Domain

This module provides deterministic, serializable contracts and pure decision logic for Phase 1 readiness.

## Files

- `types.ts`: Core entities and API-safe DTO shapes (`Site`, `GoalMetric`, `EventRecord`, `SufficiencySnapshot`, `AuditRecommendation`).
- `sufficiency.ts`: Evidence-floor readiness engine with deterministic ordering and severity ranking.
- `heuristics.ts`: Deterministic recommendation generation from event aggregates (no LLMs), capped at 3 items.
- `insights/`: Deterministic high-signal finding engine with evidence gating, confidence, and priority ranking.
- `index.ts`: Barrel exports for external consumers.

## Contracts

- `computeSufficiency(input)`: Produces a `SufficiencySnapshot` from aggregate counts.
- `nextUnlockEstimate(input)`: Returns the next not-ready category plus missing counts, or `null` if fully ready.
- `shouldReanalyze(previous, current)`: Returns `true` when evidence count grows by at least 20%.
- `generateHeuristicRecommendations(input)`: Returns at most 3 stable recommendations sorted by severity, evidence strength, then id.
- `generateFindings(input, options)`: Generates evidence-grounded findings across five behavioral categories and returns top-ranked, deduped output.

## Runtime Validation

All exported engines validate malformed inputs and throw `TypeError` with explicit field paths.
