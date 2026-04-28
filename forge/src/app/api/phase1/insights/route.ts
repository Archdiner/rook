import { generateFindings, type InsightsRequest, type InsightsResponse } from "@/lib/phase1";
import { asObject, badRequest, mapRouteError, parseJsonObject, success } from "../_shared";

function parseInsightsRequest(value: Record<string, unknown>): InsightsRequest | null {
  const { siteId, generatedAt, totals, cohorts, narratives, onboarding, ctas, deadEnds, maxFindings } = value;
  if (typeof siteId !== "string" || siteId.trim().length === 0) {
    return null;
  }
  if (generatedAt !== undefined && (typeof generatedAt !== "string" || Number.isNaN(Date.parse(generatedAt)))) {
    return null;
  }
  if (!asObject(totals)) {
    return null;
  }
  if (!Array.isArray(cohorts) || !Array.isArray(narratives) || !Array.isArray(onboarding)) {
    return null;
  }
  if (!Array.isArray(ctas) || !Array.isArray(deadEnds)) {
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
    siteId: siteId.trim(),
    totals: totals as InsightsRequest["totals"],
    cohorts: cohorts as InsightsRequest["cohorts"],
    narratives: narratives as InsightsRequest["narratives"],
    onboarding: onboarding as InsightsRequest["onboarding"],
    ctas: ctas as InsightsRequest["ctas"],
    deadEnds: deadEnds as InsightsRequest["deadEnds"],
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
