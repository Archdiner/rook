export { generateFindings } from "./generate";
export { rankAndDedupeFindings } from "./rank";
export {
  evaluateAllRules,
  evaluateCohortAsymmetry,
  evaluateCtaHierarchyConflict,
  evaluateDeadEndRageConcentration,
  evaluateNarrativeMismatch,
  evaluateOnboardingFriction,
} from "./rules";
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
} from "./types";
