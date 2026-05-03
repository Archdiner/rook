import { evaluateAllCategories, type SufficiencyRequest, type SufficiencyResponse } from "@/lib/phase1";
import { badRequest, mapRouteError, parseJsonObject, success } from "../_shared";

function parseSufficiencyRequest(value: Record<string, unknown>): SufficiencyRequest | null {
  const evidence = value.evidence;
  if (typeof evidence !== "object" || evidence === null || Array.isArray(evidence)) {
    return null;
  }

  const typedEvidence = evidence as Record<string, unknown>;
  const sessions = typedEvidence.sessions;
  const events = typedEvidence.events;
  const conversions = typedEvidence.conversions;
  const observedAt = typedEvidence.observedAt;

  if (!isNonNegativeNumber(sessions) || !isNonNegativeNumber(events) || !isNonNegativeNumber(conversions)) {
    return null;
  }
  if (observedAt !== undefined && (typeof observedAt !== "string" || Number.isNaN(Date.parse(observedAt)))) {
    return null;
  }

  return {
    evidence: {
      sessions,
      events,
      conversions,
      ...(observedAt ? { observedAt } : {}),
    },
  };
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonObject(request);
    if (!parsed.ok) {
      return badRequest(parsed.message);
    }

    const payload = parseSufficiencyRequest(parsed.value);
    if (!payload) {
      return badRequest(
        "`evidence.sessions`, `evidence.events`, and `evidence.conversions` are required non-negative numbers. `evidence.observedAt` must be ISO date when provided."
      );
    }

    const snapshot = evaluateAllCategories(payload);
    const response: SufficiencyResponse = { snapshot };
    return success(response);
  } catch (error) {
    return mapRouteError(error);
  }
}
