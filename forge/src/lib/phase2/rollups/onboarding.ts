import type { OnboardingStepAggregate } from "@/lib/phase1/insights/types";
import type {
  CanonicalEvent,
  OnboardingStepConfig,
  RollupContext,
} from "@/lib/phase2/types";

import { isRage, uniqueSorted } from "./helpers";
import { groupEventsBySession } from "./sessions";
import { filterEventsInWindow } from "./timeWindow";

interface StepHit {
  firstAt: number;
  eventIds: string[];
}

/**
 * Builds onboarding step aggregates following the configured `onboardingSteps`,
 * sorted by `order` ascending then `id` ascending.
 *
 * Match policy: `event-type` matches `event.type` exactly; `path-prefix`
 * matches when `event.path.startsWith(prefix)`.
 *
 * Metric semantics:
 * - `entryRate`: for the lowest-order step, `reached / totalSessions`. For
 *   subsequent steps, `reached / sessions_that_reached_any_earlier_step`.
 *   When the earlier-step set is empty (no session entered the funnel before
 *   this step), the denominator falls back to total in-window sessions to
 *   avoid `NaN`.
 * - `completionRate`: `sessions_that_reached_next_step / sessions_that_reached_step`.
 *   For the LAST declared step, completion is `1` — there is no successor to
 *   measure drop-off into.
 * - `medianDurationMs`: median of `nextStepFirstAt - thisStepFirstAt` over
 *   sessions that reached BOTH this step and the next, with non-negative
 *   deltas only. Last step is `0`.
 * - `rageRate`: of the sessions that reached this step, the share whose
 *   session contains any rage signal anywhere in the window.
 */
export function buildOnboardingAggregates(
  ctx: RollupContext,
): OnboardingStepAggregate[] {
  const orderedSteps = [...ctx.config.onboardingSteps].sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return a.id.localeCompare(b.id);
  });

  const filtered = filterEventsInWindow(ctx.events, ctx.window);
  const sessions = groupEventsBySession(filtered);
  const totalSessions = sessions.size;
  const sessionIds = [...sessions.keys()].sort((a, b) => a.localeCompare(b));

  const hitsByStep: Array<Map<string, StepHit>> = orderedSteps.map(() => new Map());
  for (const sid of sessionIds) {
    const events = sessions.get(sid);
    if (!events || events.length === 0) {
      continue;
    }
    for (const [stepIndex, step] of orderedSteps.entries()) {
      const matching: CanonicalEvent[] = [];
      for (const event of events) {
        if (matchesStep(event, step)) {
          matching.push(event);
        }
      }
      if (matching.length === 0) {
        continue;
      }
      const firstAt = Date.parse(matching[0].occurredAt);
      hitsByStep[stepIndex].set(sid, {
        firstAt: Number.isFinite(firstAt) ? firstAt : 0,
        eventIds: matching.map((event) => event.id),
      });
    }
  }

  const rageSessions = new Set<string>();
  for (const sid of sessionIds) {
    const events = sessions.get(sid);
    if (events && events.some(isRage)) {
      rageSessions.add(sid);
    }
  }

  const aggregates: OnboardingStepAggregate[] = [];
  for (const [stepIndex, step] of orderedSteps.entries()) {
    const hits = hitsByStep[stepIndex];
    const reached = hits.size;
    const reachedIds = [...hits.keys()].sort((a, b) => a.localeCompare(b));

    const entryDenom = entryDenominator(stepIndex, hitsByStep, totalSessions);
    const entryRate = entryDenom > 0 ? reached / entryDenom : 0;

    const isLast = stepIndex === orderedSteps.length - 1;
    let completionRate = 1;
    let medianDurationMs = 0;
    if (!isLast) {
      const nextHits = hitsByStep[stepIndex + 1];
      const deltas: number[] = [];
      let completed = 0;
      for (const sid of reachedIds) {
        const next = nextHits.get(sid);
        if (!next) {
          continue;
        }
        const here = hits.get(sid)!;
        completed += 1;
        const delta = next.firstAt - here.firstAt;
        if (delta >= 0) {
          deltas.push(delta);
        }
      }
      completionRate = reached > 0 ? completed / reached : 0;
      medianDurationMs = median(deltas);
    }

    const rageReached = reachedIds.reduce(
      (count, sid) => count + (rageSessions.has(sid) ? 1 : 0),
      0,
    );
    const rageRate = reached > 0 ? rageReached / reached : 0;

    const evidenceRefs = uniqueSorted(
      reachedIds.flatMap((sid) => hits.get(sid)?.eventIds ?? []),
    ).slice(0, 10);

    aggregates.push({
      stepId: step.id,
      stepLabel: step.label,
      entryRate,
      completionRate,
      medianDurationMs,
      rageRate,
      evidenceRefs,
    });
  }

  return aggregates;
}

function matchesStep(event: CanonicalEvent, step: OnboardingStepConfig): boolean {
  if (step.match.kind === "event-type") {
    return event.type === step.match.type;
  }
  return event.path.startsWith(step.match.prefix);
}

function entryDenominator(
  stepIndex: number,
  hitsByStep: Array<Map<string, StepHit>>,
  totalSessions: number,
): number {
  if (stepIndex === 0) {
    return totalSessions;
  }
  const earlier = new Set<string>();
  for (let i = 0; i < stepIndex; i += 1) {
    for (const sid of hitsByStep[i].keys()) {
      earlier.add(sid);
    }
  }
  return earlier.size > 0 ? earlier.size : totalSessions;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}
