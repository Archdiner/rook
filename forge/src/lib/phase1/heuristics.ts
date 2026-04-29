import type {
  AuditRecommendation,
  EventAggregate,
  FindingCategory,
  HeuristicInput,
  RecommendationSeverity,
} from "./types";

const MAX_RECOMMENDATIONS = 3;

interface CandidateRule {
  category: FindingCategory;
  title: string;
  rationale: (aggregate: EventAggregate) => string;
  severity: RecommendationSeverity;
  score: (aggregate: EventAggregate) => number;
}

const RULES: readonly CandidateRule[] = [
  {
    category: "engagement",
    title: "High-interest interaction detected",
    rationale: (aggregate) =>
      `Event "${aggregate.eventName}" appears frequently. Promote this interaction earlier in the journey.`,
    severity: "high",
    score: (aggregate) => aggregate.count,
  },
  {
    category: "conversion",
    title: "Conversion signal should be amplified",
    rationale: (aggregate) =>
      `Event "${aggregate.eventName}" has conversion activity. Add tighter UX paths to increase completion rate.`,
    severity: "high",
    score: (aggregate) => (aggregate.conversions ?? 0) * 5 + aggregate.count,
  },
  {
    category: "traffic",
    title: "Top entry behavior deserves segmentation",
    rationale: (aggregate) =>
      `Event "${aggregate.eventName}" has meaningful volume. Segment acquisition paths to tailor follow-up messaging.`,
    severity: "medium",
    score: (aggregate) => Math.round(aggregate.count * 0.75),
  },
];

/**
 * Creates deterministic recommendation candidates from aggregate event evidence.
 */
export function generateHeuristicRecommendations(input: HeuristicInput): AuditRecommendation[] {
  assertHeuristicInput(input);

  const createdAt = input.generatedAt ?? new Date().toISOString();
  const byStrength = [...input.aggregates].sort((a, b) => {
    const byCount = b.count - a.count;
    if (byCount !== 0) {
      return byCount;
    }
    return a.eventName.localeCompare(b.eventName);
  });

  const recommendations: AuditRecommendation[] = [];

  for (const aggregate of byStrength) {
    for (const rule of RULES) {
      const score = rule.score(aggregate);
      if (score <= 0) {
        continue;
      }
      const recommendation = toRecommendation(input.siteId, createdAt, aggregate, rule, score);
      recommendations.push(recommendation);
      if (recommendations.length >= MAX_RECOMMENDATIONS) {
        return sortRecommendations(recommendations);
      }
    }
  }

  return sortRecommendations(recommendations);
}

function toRecommendation(
  siteId: string,
  createdAt: string,
  aggregate: EventAggregate,
  rule: CandidateRule,
  score: number,
): AuditRecommendation {
  const cappedEvidenceIds = aggregate.evidenceIds.slice(0, 10);
  return {
    id: `${rule.category}:${sanitize(aggregate.eventName)}`,
    siteId,
    createdAt,
    category: rule.category,
    severity: rule.severity,
    title: rule.title,
    rationale: `${rule.rationale(aggregate)} (score=${score})`,
    evidenceIds: cappedEvidenceIds,
    evidenceCount: aggregate.count,
  };
}

function sortRecommendations(input: AuditRecommendation[]): AuditRecommendation[] {
  return [...input]
    .sort((a, b) => {
      const bySeverity = severityRank(b.severity) - severityRank(a.severity);
      if (bySeverity !== 0) {
        return bySeverity;
      }
      const byEvidence = b.evidenceCount - a.evidenceCount;
      if (byEvidence !== 0) {
        return byEvidence;
      }
      return a.id.localeCompare(b.id);
    })
    .slice(0, MAX_RECOMMENDATIONS);
}

function severityRank(value: RecommendationSeverity): number {
  switch (value) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function sanitize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function assertHeuristicInput(input: HeuristicInput): void {
  if (typeof input !== "object" || input === null) {
    throw new TypeError("input must be an object.");
  }
  if (typeof input.siteId !== "string" || input.siteId.trim().length === 0) {
    throw new TypeError("input.siteId must be a non-empty string.");
  }
  if (input.generatedAt !== undefined && Number.isNaN(Date.parse(input.generatedAt))) {
    throw new TypeError("input.generatedAt must be a valid ISO date string.");
  }
  if (!Array.isArray(input.aggregates)) {
    throw new TypeError("input.aggregates must be an array.");
  }

  for (const [index, aggregate] of input.aggregates.entries()) {
    assertAggregate(aggregate, `input.aggregates[${index}]`);
  }
}

function assertAggregate(aggregate: EventAggregate, path: string): void {
  if (typeof aggregate !== "object" || aggregate === null) {
    throw new TypeError(`${path} must be an object.`);
  }
  if (typeof aggregate.eventName !== "string" || aggregate.eventName.trim().length === 0) {
    throw new TypeError(`${path}.eventName must be a non-empty string.`);
  }
  if (typeof aggregate.count !== "number" || !Number.isFinite(aggregate.count) || aggregate.count < 0) {
    throw new TypeError(`${path}.count must be a non-negative finite number.`);
  }
  if (!Array.isArray(aggregate.evidenceIds)) {
    throw new TypeError(`${path}.evidenceIds must be an array.`);
  }
  for (const [idIndex, id] of aggregate.evidenceIds.entries()) {
    if (typeof id !== "string" || id.trim().length === 0) {
      throw new TypeError(`${path}.evidenceIds[${idIndex}] must be a non-empty string.`);
    }
  }
  if (
    aggregate.conversions !== undefined &&
    (typeof aggregate.conversions !== "number" ||
      !Number.isFinite(aggregate.conversions) ||
      aggregate.conversions < 0)
  ) {
    throw new TypeError(`${path}.conversions must be a non-negative finite number when present.`);
  }
}
