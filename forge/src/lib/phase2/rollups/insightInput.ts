import type { InsightInput } from "@/lib/phase1/insights/types";
import type {
  CanonicalEvent,
  CanonicalEventSource,
  Phase2SiteConfig,
  RollupContext,
  RollupDiagnostics,
  RollupResult,
  TimeWindow,
} from "@/lib/phase2/types";

import { buildCohortAggregates } from "./cohorts";
import { buildCtaAggregates, countCtaClickEvents } from "./ctas";
import { buildDeadEndAggregates } from "./deadEnds";
import { resolveConversionTypes } from "./helpers";
import { buildNarrativeAggregates } from "./narratives";
import { buildOnboardingAggregates } from "./onboarding";
import { countUniqueSessions } from "./sessions";
import { filterEventsInWindow, windowDurationMs } from "./timeWindow";

/**
 * Orchestrates the Phase 2 rollups: validates the context, filters events to
 * the window, runs each builder, and assembles the {@link InsightInput} that
 * Phase 1 `generateFindings` consumes plus a {@link RollupDiagnostics} sidecar.
 *
 * Determinism: with `now` provided the entire return value is a pure function
 * of `ctx`. The default `now = new Date().toISOString()` exists for ergonomic
 * one-shot calls; tests/replays should always pass `now`.
 */
export function buildInsightInputFromEvents(
  ctx: RollupContext,
  now?: string,
): RollupResult {
  assertRollupContext(ctx);

  const generatedAt = resolveGeneratedAt(now);
  const conversionTypes = resolveConversionTypes(ctx.config);
  const filtered = filterEventsInWindow(ctx.events, ctx.window);

  const cohorts = buildCohortAggregates(ctx, conversionTypes);
  const narratives = buildNarrativeAggregates(ctx);
  const onboarding = buildOnboardingAggregates(ctx);
  const ctas = buildCtaAggregates(ctx, conversionTypes);
  const deadEnds = buildDeadEndAggregates(ctx, conversionTypes);

  const uniqueSessions = countUniqueSessions(filtered);

  const insightInput: InsightInput = {
    siteId: ctx.siteId,
    generatedAt,
    totals: { sessions: uniqueSessions },
    cohorts,
    narratives,
    onboarding,
    ctas,
    deadEnds,
  };

  const diagnostics: RollupDiagnostics = {
    windowDurationMs: windowDurationMs(ctx.window),
    totalEvents: filtered.length,
    uniqueSessions,
    perCategory: {
      cohorts: {
        assignments: cohorts.reduce((sum, c) => sum + c.sessionCount, 0),
        cohortCount: cohorts.length,
      },
      narratives: {
        matched: narratives.length,
        configured: ctx.config.narratives.length,
      },
      onboarding: {
        matched: onboarding.length,
        configured: ctx.config.onboardingSteps.length,
      },
      ctas: {
        clicks: countCtaClickEvents(ctx),
        configured: ctx.config.ctas.length,
      },
      deadEnds: { pages: deadEnds.length },
    },
    sources: uniqueSources(filtered),
    sourceCounts: countSources(filtered),
  };

  return { insightInput, diagnostics };
}

function resolveGeneratedAt(now: string | undefined): string {
  if (now === undefined) {
    return new Date().toISOString();
  }
  if (typeof now !== "string" || Number.isNaN(Date.parse(now))) {
    throw new TypeError("now must be a valid ISO date string when provided.");
  }
  return now;
}

function uniqueSources(events: CanonicalEvent[]): CanonicalEventSource[] {
  const sources = new Set<CanonicalEventSource>();
  for (const event of events) {
    sources.add(event.source);
  }
  return [...sources].sort((a, b) => a.localeCompare(b));
}

function countSources(
  events: CanonicalEvent[],
): Array<{ source: CanonicalEventSource; events: number }> {
  const counts = new Map<CanonicalEventSource, number>();
  for (const event of events) {
    counts.set(event.source, (counts.get(event.source) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([source, total]) => ({ source, events: total }))
    .sort((a, b) => a.source.localeCompare(b.source));
}

function assertRollupContext(ctx: RollupContext): void {
  if (typeof ctx !== "object" || ctx === null) {
    throw new TypeError("ctx must be an object.");
  }
  if (typeof ctx.siteId !== "string" || ctx.siteId.trim().length === 0) {
    throw new TypeError("ctx.siteId must be a non-empty string.");
  }
  assertWindow(ctx.window, "ctx.window");
  assertConfig(ctx.config, "ctx.config");
  if (!Array.isArray(ctx.events)) {
    throw new TypeError("ctx.events must be an array.");
  }
}

function assertWindow(window: TimeWindow, path: string): void {
  if (typeof window !== "object" || window === null) {
    throw new TypeError(`${path} must be an object.`);
  }
  if (typeof window.start !== "string" || Number.isNaN(Date.parse(window.start))) {
    throw new TypeError(`${path}.start must be a valid ISO date string.`);
  }
  if (typeof window.end !== "string" || Number.isNaN(Date.parse(window.end))) {
    throw new TypeError(`${path}.end must be a valid ISO date string.`);
  }
  if (Date.parse(window.end) <= Date.parse(window.start)) {
    throw new TypeError(`${path}.end must be strictly after ${path}.start.`);
  }
}

function assertConfig(config: Phase2SiteConfig, path: string): void {
  if (typeof config !== "object" || config === null) {
    throw new TypeError(`${path} must be an object.`);
  }
  if (typeof config.siteId !== "string" || config.siteId.trim().length === 0) {
    throw new TypeError(`${path}.siteId must be a non-empty string.`);
  }
  if (!Array.isArray(config.cohortDimensions)) {
    throw new TypeError(`${path}.cohortDimensions must be an array.`);
  }
  if (!Array.isArray(config.onboardingSteps)) {
    throw new TypeError(`${path}.onboardingSteps must be an array.`);
  }
  if (!Array.isArray(config.ctas)) {
    throw new TypeError(`${path}.ctas must be an array.`);
  }
  if (!Array.isArray(config.narratives)) {
    throw new TypeError(`${path}.narratives must be an array.`);
  }
  if (
    config.conversionEventTypes !== undefined &&
    !Array.isArray(config.conversionEventTypes)
  ) {
    throw new TypeError(`${path}.conversionEventTypes must be an array when present.`);
  }
}
