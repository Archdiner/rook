import type { SufficiencyCategoryKey, SufficiencyConfig, SufficiencyThresholdConfig } from "./types";

export const SUFFICIENCY_CATEGORY_ORDER: readonly SufficiencyCategoryKey[] = [
  "heroDropoff",
  "rageClicks",
  "funnelDropoff",
  "cohortAsymmetry",
  "narrativeSignals",
  "abValidation",
] as const;

export const DEFAULT_SUFFICIENCY_THRESHOLDS: Readonly<SufficiencyThresholdConfig> = {
  heroDropoff: { sessions: 150, events: 500, conversions: 8 },
  rageClicks: { sessions: 120, events: 400, conversions: 0 },
  funnelDropoff: { sessions: 250, events: 800, conversions: 20 },
  cohortAsymmetry: { sessions: 300, events: 900, conversions: 25 },
  narrativeSignals: { sessions: 180, events: 700, conversions: 10 },
  abValidation: { sessions: 500, events: 1500, conversions: 50 },
};

export const DEFAULT_REANALYSIS_EVIDENCE_DELTA = 0.2;

export const DEFAULT_SUFFICIENCY_CONFIG: Readonly<SufficiencyConfig> = {
  thresholds: DEFAULT_SUFFICIENCY_THRESHOLDS,
  reanalysisEvidenceDelta: DEFAULT_REANALYSIS_EVIDENCE_DELTA,
};
