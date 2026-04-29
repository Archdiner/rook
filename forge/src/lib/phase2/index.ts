export {
  CANONICAL_EVENT_SCHEMA_VERSION,
} from "./types";

export type {
  CanonicalEvent,
  CanonicalEventInput,
  CanonicalEventSchemaVersion,
  CanonicalEventSource,
  CohortDimensionConfig,
  CtaConfig,
  GateLevel,
  GateResult,
  GateWarning,
  ISODateString,
  NarrativeConfig,
  OnboardingStepConfig,
  Phase2SiteConfig,
  RollupContext,
  RollupDiagnostics,
  RollupResult,
  RunInsightsRequest,
  RunInsightsResponse,
  TimeWindow,
} from "./types";

export {
  canonicalEventInputSchema,
  dedupeKey,
  materializeCanonicalEvent,
} from "./canonicalEvent";

export {
  buildCohortAggregates,
  buildCtaAggregates,
  buildDeadEndAggregates,
  buildInsightInputFromEvents,
  buildNarrativeAggregates,
  buildOnboardingAggregates,
  countUniqueSessions,
  filterEventsInWindow,
  groupEventsBySession,
  windowDurationMs,
} from "./rollups";

export { runInsightInputGate } from "./validation/insightInputGate";
export type { RunGateInput } from "./validation/insightInputGate";
