export type SufficiencyCategoryKey =
  | "heroDropoff"
  | "rageClicks"
  | "funnelDropoff"
  | "cohortAsymmetry"
  | "narrativeSignals"
  | "abValidation";

export type SufficiencyMetricKey = "sessions" | "events" | "conversions";

export interface SufficiencyThreshold {
  sessions: number;
  events: number;
  conversions: number;
}

export type SufficiencyThresholdConfig = Record<SufficiencyCategoryKey, SufficiencyThreshold>;

export interface EvidenceSnapshot {
  sessions: number;
  events: number;
  conversions: number;
  observedAt?: string;
}

export interface ReadinessReason {
  metric: SufficiencyMetricKey;
  required: number;
  observed: number;
  missing: number;
  message: string;
}

export interface CategoryReadinessResult {
  category: SufficiencyCategoryKey;
  ready: boolean;
  threshold: SufficiencyThreshold;
  evidence: EvidenceSnapshot;
  progress: number;
  reasons: ReadinessReason[];
}

export interface AllCategoriesReadinessResult {
  overallReady: boolean;
  readyCount: number;
  totalCount: number;
  categories: Record<SufficiencyCategoryKey, CategoryReadinessResult>;
  orderedResults: CategoryReadinessResult[];
}

export interface SufficiencyConfig {
  thresholds: SufficiencyThresholdConfig;
  reanalysisEvidenceDelta: number;
}

export interface EvaluateCategoryReadinessInput {
  category: SufficiencyCategoryKey;
  evidence: EvidenceSnapshot;
  thresholds?: SufficiencyThresholdConfig;
}

export interface EvaluateAllCategoriesInput {
  evidence: EvidenceSnapshot;
  thresholds?: SufficiencyThresholdConfig;
}

export interface EtaEstimate {
  target: number;
  current: number;
  remaining: number;
  ratePerDay: number;
  daysRemaining: number;
  etaIso: string | null;
}
