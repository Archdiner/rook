import type {
  AllCategoriesReadinessResult,
  EvaluateAllCategoriesInput,
} from "./sufficiency";
import type { InsightFinding, InsightInput } from "./insights";

export type SufficiencyRequest = EvaluateAllCategoriesInput;

export interface SufficiencyResponse {
  snapshot: AllCategoriesReadinessResult;
}

export interface InsightsRequest extends InsightInput {
  maxFindings?: number;
}

export interface InsightsResponse {
  findings: InsightFinding[];
  totalFindings: number;
  maxFindings: number;
}

export interface HealthResponse {
  module: "phase1";
  status: "ok";
  version: "v1";
  capabilities: {
    sufficiency: boolean;
    insights: boolean;
  };
}
