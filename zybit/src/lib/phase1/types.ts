export type ISODateString = string;

export type FindingCategory =
  | "tracking"
  | "traffic"
  | "engagement"
  | "conversion";

export type ReadinessStatus = "blocked" | "building" | "ready";

export type RecommendationSeverity = "low" | "medium" | "high";

export interface Site {
  id: string;
  domain: string;
  name: string;
  timezone: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface GoalMetric {
  id: string;
  siteId: string;
  key: string;
  displayName: string;
  eventName: string;
  description?: string;
  primary: boolean;
  targetValue?: number;
  windowDays?: number;
  createdAt: ISODateString;
}

export interface EventRecord {
  id: string;
  siteId: string;
  eventName: string;
  occurredAt: ISODateString;
  sessionId?: string;
  userId?: string;
  value?: number;
  properties?: Record<string, string | number | boolean | null>;
}

export interface SufficiencyTotals {
  sessions: number;
  events: number;
  conversions: number;
}

export interface CategoryThreshold {
  sessions: number;
  events: number;
  conversions: number;
}

export interface CategoryReadiness {
  category: FindingCategory;
  status: ReadinessStatus;
  floor: CategoryThreshold;
  observed: SufficiencyTotals;
  evidenceCount: number;
  evidenceGrowth: number;
}

export interface SufficiencySnapshot {
  siteId: string;
  generatedAt: ISODateString;
  overallStatus: ReadinessStatus;
  totals: SufficiencyTotals;
  categoryReadiness: CategoryReadiness[];
  evidenceCount: number;
}

export interface SufficiencyInput {
  siteId: string;
  sessions: number;
  events: number;
  conversions: number;
  generatedAt?: ISODateString;
}

export interface UnlockEstimate {
  category: FindingCategory;
  missing: SufficiencyTotals;
  nextStatus: ReadinessStatus;
}

export interface EventAggregate {
  eventName: string;
  count: number;
  evidenceIds: string[];
  conversions?: number;
}

export interface HeuristicInput {
  siteId: string;
  generatedAt?: ISODateString;
  aggregates: EventAggregate[];
}

export interface AuditRecommendation {
  id: string;
  siteId: string;
  createdAt: ISODateString;
  category: FindingCategory;
  severity: RecommendationSeverity;
  title: string;
  rationale: string;
  evidenceIds: string[];
  evidenceCount: number;
}
