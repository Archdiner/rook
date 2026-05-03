export type InsightCategory =
  | "cohort-asymmetry"
  | "narrative-ia-mismatch"
  | "onboarding-friction"
  | "cta-hierarchy-conflict"
  | "dead-end-rage-concentration";

export interface InsightTotals {
  sessions: number;
}

export interface CohortAggregate {
  cohortId: string;
  label: string;
  sessionCount: number;
  conversionRate: number;
  avgIntentScore: number;
  evidenceRefs: string[];
}

export interface NarrativePathAggregate {
  narrativeId: string;
  narrativeLabel: string;
  expectedPathRefs: string[];
  dominantPathRef: string;
  dominantPathShare: number;
  mismatchRate: number;
  evidenceRefs: string[];
}

export interface OnboardingStepAggregate {
  stepId: string;
  stepLabel: string;
  entryRate: number;
  completionRate: number;
  medianDurationMs: number;
  rageRate: number;
  evidenceRefs: string[];
}

export interface CtaAggregate {
  pageRef: string;
  ctaId: string;
  label: string;
  visualWeight: number;
  clickShare: number;
  conversionShare: number;
  evidenceRefs: string[];
}

export interface DeadEndAggregate {
  pageRef: string;
  deadEndRate: number;
  rageRate: number;
  impactedSessions: number;
  evidenceRefs: string[];
}

export interface InsightInput {
  siteId: string;
  generatedAt?: string;
  totals: InsightTotals;
  cohorts: CohortAggregate[];
  narratives: NarrativePathAggregate[];
  onboarding: OnboardingStepAggregate[];
  ctas: CtaAggregate[];
  deadEnds: DeadEndAggregate[];
}

export interface InsightFinding {
  id: string;
  category: InsightCategory;
  title: string;
  summary: string;
  evidenceRefs: string[];
  recommendedChanges: string[];
  confidence: number;
  priorityScore: number;
}

export interface GenerateFindingsOptions {
  maxFindings?: number;
}
