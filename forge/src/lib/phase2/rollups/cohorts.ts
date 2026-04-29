import type { CohortAggregate } from "@/lib/phase1/insights/types";
import type {
  CanonicalEvent,
  CohortDimensionConfig,
  RollupContext,
} from "@/lib/phase2/types";

import { isConversion, sanitizeIdSegment, uniqueSorted } from "./helpers";
import { groupEventsBySession } from "./sessions";
import { filterEventsInWindow } from "./timeWindow";

interface SessionStats {
  sessionId: string;
  converted: boolean;
  intent: number;
  evidenceIds: string[];
}

/**
 * Builds cohort aggregates per declared dimension. For each dimension, every
 * session is assigned to a single cohort based on the dimension value seen on
 * its FIRST in-window event (deterministic). Sessions whose value is missing
 * fall back to `dimension.fallback`; if neither resolves they are skipped.
 *
 * Cohort id format: `${dimension.id}:${sanitizeIdSegment(value)}` — sessions
 * whose sanitized value collapses to empty are skipped to avoid degenerate
 * ids.
 *
 * `avgIntentScore` is the mean of per-session intent scores. A session's
 * intent is the mean of `event.metrics.intent` across its in-window events;
 * if no event exposes an `intent` metric, the session contributes `0.5` (the
 * neutral mid-point).
 */
export function buildCohortAggregates(
  ctx: RollupContext,
  conversionTypes: Set<string>,
): CohortAggregate[] {
  const filtered = filterEventsInWindow(ctx.events, ctx.window);
  const sessions = groupEventsBySession(filtered);

  const aggregates: CohortAggregate[] = [];
  for (const dimension of ctx.config.cohortDimensions) {
    aggregates.push(...buildForDimension(dimension, sessions, conversionTypes));
  }

  return aggregates.sort((a, b) => a.cohortId.localeCompare(b.cohortId));
}

function buildForDimension(
  dimension: CohortDimensionConfig,
  sessions: Map<string, CanonicalEvent[]>,
  conversionTypes: Set<string>,
): CohortAggregate[] {
  const buckets = new Map<string, SessionStats[]>();
  const labels = new Map<string, string>();

  const sessionIds = [...sessions.keys()].sort((a, b) => a.localeCompare(b));
  for (const sid of sessionIds) {
    const events = sessions.get(sid);
    if (!events || events.length === 0) {
      continue;
    }

    const value = resolveDimensionValue(dimension, events[0]);
    if (value === null) {
      continue;
    }

    const slug = sanitizeIdSegment(value);
    if (slug.length === 0) {
      continue;
    }

    const cohortId = `${dimension.id}:${slug}`;
    if (!buckets.has(cohortId)) {
      buckets.set(cohortId, []);
      labels.set(cohortId, `${dimension.label} = ${value}`);
    }
    buckets.get(cohortId)!.push(computeSessionStats(sid, events, conversionTypes));
  }

  const aggregates: CohortAggregate[] = [];
  const cohortIds = [...buckets.keys()].sort((a, b) => a.localeCompare(b));
  for (const cohortId of cohortIds) {
    const bucket = buckets.get(cohortId)!;
    const sessionCount = bucket.length;
    const conversions = bucket.reduce((sum, s) => sum + (s.converted ? 1 : 0), 0);
    const conversionRate = sessionCount > 0 ? conversions / sessionCount : 0;
    const avgIntentScore =
      sessionCount > 0
        ? bucket.reduce((sum, s) => sum + s.intent, 0) / sessionCount
        : 0.5;
    const evidenceRefs = uniqueSorted(bucket.flatMap((s) => s.evidenceIds)).slice(0, 10);

    aggregates.push({
      cohortId,
      label: labels.get(cohortId) ?? cohortId,
      sessionCount,
      conversionRate,
      avgIntentScore,
      evidenceRefs,
    });
  }
  return aggregates;
}

function resolveDimensionValue(
  dimension: CohortDimensionConfig,
  event: CanonicalEvent,
): string | null {
  let raw: string | number | boolean | null | undefined;
  switch (dimension.source) {
    case "property":
      raw = dimension.key ? event.properties?.[dimension.key] : undefined;
      break;
    case "metric":
      raw = dimension.key ? event.metrics?.[dimension.key] : undefined;
      break;
    case "path-prefix":
      raw = pathFirstSegment(event.path);
      break;
  }

  const direct = normaliseValue(raw);
  if (direct !== null) {
    return direct;
  }
  const fallback = dimension.fallback;
  if (typeof fallback === "string" && fallback.trim().length > 0) {
    return fallback.trim();
  }
  return null;
}

function normaliseValue(
  raw: string | number | boolean | null | undefined,
): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? String(raw) : null;
  }
  if (typeof raw === "boolean") {
    return raw ? "true" : "false";
  }
  return null;
}

function pathFirstSegment(path: string): string {
  if (typeof path !== "string" || path.length === 0) {
    return "";
  }
  if (path === "/") {
    return "/";
  }
  const stripped = path.startsWith("/") ? path.slice(1) : path;
  const idx = stripped.indexOf("/");
  const segment = idx === -1 ? stripped : stripped.slice(0, idx);
  return segment.length > 0 ? `/${segment}` : "/";
}

function computeSessionStats(
  sessionId: string,
  events: CanonicalEvent[],
  conversionTypes: Set<string>,
): SessionStats {
  let converted = false;
  let intentSum = 0;
  let intentCount = 0;
  const evidenceIds: string[] = [];

  for (const event of events) {
    evidenceIds.push(event.id);
    if (isConversion(event, conversionTypes)) {
      converted = true;
    }
    const intent = event.metrics?.intent;
    if (typeof intent === "number" && Number.isFinite(intent)) {
      intentSum += intent;
      intentCount += 1;
    }
  }

  const intent = intentCount > 0 ? intentSum / intentCount : 0.5;
  return { sessionId, converted, intent, evidenceIds };
}
