export type {
  AuditRecommendation,
  CategoryReadiness,
  CategoryThreshold,
  EventAggregate,
  EventRecord,
  FindingCategory,
  GoalMetric,
  HeuristicInput,
  ISODateString,
  ReadinessStatus,
  RecommendationSeverity,
  Site,
  SufficiencyInput,
  SufficiencySnapshot,
  SufficiencyTotals,
  UnlockEstimate,
} from "./types";

export {
  DEFAULT_REANALYSIS_EVIDENCE_DELTA,
  DEFAULT_SUFFICIENCY_CONFIG,
  DEFAULT_SUFFICIENCY_THRESHOLDS,
  estimateNextTargetEta,
  evaluateAllCategories,
  evaluateCategoryReadiness,
  SUFFICIENCY_CATEGORY_ORDER,
} from "./sufficiency";

export type {
  AllCategoriesReadinessResult,
  CategoryReadinessResult as SufficiencyCategoryReadinessResult,
  EtaEstimate,
  EvaluateAllCategoriesInput,
  EvaluateCategoryReadinessInput,
  EvidenceSnapshot,
  ReadinessReason,
  SufficiencyCategoryKey,
  SufficiencyConfig,
  SufficiencyMetricKey,
  SufficiencyThreshold,
  SufficiencyThresholdConfig,
} from "./sufficiency";

export { generateHeuristicRecommendations } from "./heuristics";

export {
  evaluateAllRules,
  evaluateCohortAsymmetry,
  evaluateCtaHierarchyConflict,
  evaluateDeadEndRageConcentration,
  evaluateNarrativeMismatch,
  evaluateOnboardingFriction,
  generateFindings,
  rankAndDedupeFindings,
} from "./insights";

export type {
  CohortAggregate,
  CtaAggregate,
  DeadEndAggregate,
  GenerateFindingsOptions,
  InsightCategory,
  InsightFinding,
  InsightInput,
  InsightTotals,
  NarrativePathAggregate,
  OnboardingStepAggregate,
} from "./insights";

export type {
  HealthResponse,
  InsightsRequest,
  InsightsResponse,
  SufficiencyRequest,
  SufficiencyResponse,
} from "./contracts";
