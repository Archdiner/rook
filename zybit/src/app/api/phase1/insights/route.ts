import { generateFindings, type InsightsRequest, type InsightsResponse } from "@/lib/phase1";
import { asObject, badRequest, mapRouteError, parseJsonObject, success } from "../_shared";

function getAliasedValue(
  source: Record<string, unknown>,
  aliases: readonly string[],
): unknown {
  for (const alias of aliases) {
    if (alias in source) {
      return source[alias];
    }
  }
  return undefined;
}

function parseRequiredString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseRequiredFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed: string[] = [];
  for (const item of value) {
    const parsedItem = parseRequiredString(item);
    if (!parsedItem) {
      return null;
    }
    parsed.push(parsedItem);
  }
  return parsed;
}

function parseCohort(item: unknown): InsightsRequest["cohorts"][number] | null {
  const obj = asObject(item);
  if (!obj) {
    return null;
  }

  const cohortId = parseRequiredString(obj.cohortId);
  const label = parseRequiredString(obj.label);
  const sessionCount = parseRequiredFiniteNumber(getAliasedValue(obj, ["sessionCount", "sampleSize"]));
  const conversionRate = parseRequiredFiniteNumber(obj.conversionRate);
  const avgIntentScore = parseRequiredFiniteNumber(obj.avgIntentScore);
  const evidenceRefs = parseStringArray(getAliasedValue(obj, ["evidenceRefs", "evidence_refs"]));
  if (!cohortId || !label || sessionCount === null || conversionRate === null || avgIntentScore === null || !evidenceRefs) {
    return null;
  }

  return {
    cohortId,
    label,
    sessionCount,
    conversionRate,
    avgIntentScore,
    evidenceRefs,
  };
}

function parseNarrative(item: unknown): InsightsRequest["narratives"][number] | null {
  const obj = asObject(item);
  if (!obj) {
    return null;
  }

  const narrativeId = parseRequiredString(getAliasedValue(obj, ["narrativeId", "id"]));
  const narrativeLabel = parseRequiredString(getAliasedValue(obj, ["narrativeLabel", "label"]));
  const expectedPathRefs = parseStringArray(getAliasedValue(obj, ["expectedPathRefs", "expectedPaths"]));
  const dominantPathRef = parseRequiredString(getAliasedValue(obj, ["dominantPathRef", "dominantPath"]));
  const dominantPathShare = parseRequiredFiniteNumber(
    getAliasedValue(obj, ["dominantPathShare", "dominantShare"]),
  );
  const mismatchRate = parseRequiredFiniteNumber(obj.mismatchRate);
  const evidenceRefs = parseStringArray(getAliasedValue(obj, ["evidenceRefs", "evidence_refs"]));
  if (
    !narrativeId ||
    !narrativeLabel ||
    !expectedPathRefs ||
    !dominantPathRef ||
    dominantPathShare === null ||
    mismatchRate === null ||
    !evidenceRefs
  ) {
    return null;
  }

  return {
    narrativeId,
    narrativeLabel,
    expectedPathRefs,
    dominantPathRef,
    dominantPathShare,
    mismatchRate,
    evidenceRefs,
  };
}

function parseOnboarding(item: unknown): InsightsRequest["onboarding"][number] | null {
  const obj = asObject(item);
  if (!obj) {
    return null;
  }

  const stepId = parseRequiredString(getAliasedValue(obj, ["stepId", "id"]));
  const stepLabel = parseRequiredString(getAliasedValue(obj, ["stepLabel", "label", "step"]));
  const entryRate = parseRequiredFiniteNumber(obj.entryRate);
  const completionRate = parseRequiredFiniteNumber(obj.completionRate);
  const medianDurationMs = parseRequiredFiniteNumber(obj.medianDurationMs);
  const rageRate = parseRequiredFiniteNumber(obj.rageRate);
  const evidenceRefs = parseStringArray(getAliasedValue(obj, ["evidenceRefs", "evidence_refs"]));
  if (
    !stepId ||
    !stepLabel ||
    entryRate === null ||
    completionRate === null ||
    medianDurationMs === null ||
    rageRate === null ||
    !evidenceRefs
  ) {
    return null;
  }

  return {
    stepId,
    stepLabel,
    entryRate,
    completionRate,
    medianDurationMs,
    rageRate,
    evidenceRefs,
  };
}

function parseCta(item: unknown): InsightsRequest["ctas"][number] | null {
  const obj = asObject(item);
  if (!obj) {
    return null;
  }

  const pageRef = parseRequiredString(getAliasedValue(obj, ["pageRef", "page"]));
  const ctaId = parseRequiredString(getAliasedValue(obj, ["ctaId", "id"]));
  const label = parseRequiredString(obj.label);
  const visualWeight = parseRequiredFiniteNumber(obj.visualWeight);
  const clickShare = parseRequiredFiniteNumber(obj.clickShare);
  const conversionShare = parseRequiredFiniteNumber(obj.conversionShare);
  const evidenceRefs = parseStringArray(getAliasedValue(obj, ["evidenceRefs", "evidence_refs"]));
  if (
    !pageRef ||
    !ctaId ||
    !label ||
    visualWeight === null ||
    clickShare === null ||
    conversionShare === null ||
    !evidenceRefs
  ) {
    return null;
  }

  return {
    pageRef,
    ctaId,
    label,
    visualWeight,
    clickShare,
    conversionShare,
    evidenceRefs,
  };
}

function parseDeadEnd(item: unknown): InsightsRequest["deadEnds"][number] | null {
  const obj = asObject(item);
  if (!obj) {
    return null;
  }

  const pageRef = parseRequiredString(getAliasedValue(obj, ["pageRef", "path"]));
  const deadEndRate = parseRequiredFiniteNumber(getAliasedValue(obj, ["deadEndRate", "dropOffRate"]));
  const rageRate = parseRequiredFiniteNumber(obj.rageRate);
  const impactedSessions = parseRequiredFiniteNumber(getAliasedValue(obj, ["impactedSessions", "sampleSize"]));
  const evidenceRefs = parseStringArray(getAliasedValue(obj, ["evidenceRefs", "evidence_refs"]));
  if (!pageRef || deadEndRate === null || rageRate === null || impactedSessions === null || !evidenceRefs) {
    return null;
  }

  return {
    pageRef,
    deadEndRate,
    rageRate,
    impactedSessions,
    evidenceRefs,
  };
}

function parseAggregateArray<T>(
  value: unknown,
  parseItem: (item: unknown) => T | null,
): T[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsedItems: T[] = [];
  for (const item of value) {
    const parsedItem = parseItem(item);
    if (!parsedItem) {
      return null;
    }
    parsedItems.push(parsedItem);
  }
  return parsedItems;
}

function parseInsightsRequest(value: Record<string, unknown>): InsightsRequest | null {
  const { siteId, generatedAt, totals, cohorts, narratives, onboarding, ctas, deadEnds, maxFindings } = value;
  const parsedSiteId = parseRequiredString(siteId);
  if (!parsedSiteId) {
    return null;
  }
  if (generatedAt !== undefined && (typeof generatedAt !== "string" || Number.isNaN(Date.parse(generatedAt)))) {
    return null;
  }
  const totalsObject = asObject(totals);
  if (!totalsObject) {
    return null;
  }
  const sessions = parseRequiredFiniteNumber(totalsObject.sessions);
  if (sessions === null) {
    return null;
  }

  const parsedCohorts = parseAggregateArray(cohorts, parseCohort);
  const parsedNarratives = parseAggregateArray(narratives, parseNarrative);
  const parsedOnboarding = parseAggregateArray(onboarding, parseOnboarding);
  const parsedCtas = parseAggregateArray(ctas, parseCta);
  const parsedDeadEnds = parseAggregateArray(deadEnds, parseDeadEnd);
  if (!parsedCohorts || !parsedNarratives || !parsedOnboarding || !parsedCtas || !parsedDeadEnds) {
    return null;
  }
  if (
    maxFindings !== undefined &&
    maxFindings !== null &&
    (typeof maxFindings !== "number" || !Number.isInteger(maxFindings) || maxFindings < 1)
  ) {
    return null;
  }

  return {
    siteId: parsedSiteId,
    totals: { sessions },
    cohorts: parsedCohorts,
    narratives: parsedNarratives,
    onboarding: parsedOnboarding,
    ctas: parsedCtas,
    deadEnds: parsedDeadEnds,
    ...(generatedAt ? { generatedAt } : {}),
    ...(typeof maxFindings === "number" ? { maxFindings } : {}),
  };
}

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonObject(request);
    if (!parsed.ok) {
      return badRequest(parsed.message);
    }

    const payload = parseInsightsRequest(parsed.value);
    if (!payload) {
      return badRequest(
        "`siteId`, `totals`, `cohorts[]`, `narratives[]`, `onboarding[]`, `ctas[]`, and `deadEnds[]` are required. `maxFindings` must be a positive integer when provided."
      );
    }

    const maxFindings = payload.maxFindings ?? 3;
    const findings = generateFindings(payload, { maxFindings });
    const response: InsightsResponse = {
      findings,
      totalFindings: findings.length,
      maxFindings,
    };

    return success(response);
  } catch (error) {
    return mapRouteError(error);
  }
}
