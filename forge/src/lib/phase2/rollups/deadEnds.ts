import type { DeadEndAggregate } from "@/lib/phase1/insights/types";
import type { RollupContext } from "@/lib/phase2/types";

import { isConversion, isRage, uniqueSorted } from "./helpers";
import { groupEventsBySession } from "./sessions";
import { filterEventsInWindow } from "./timeWindow";

const MIN_VISITORS = 5;

interface PathStats {
  visitors: Set<string>;
  impacted: Set<string>;
  rageVisitors: Set<string>;
  evidenceIds: string[];
}

/**
 * Builds dead-end aggregates per path.
 *
 * - `impactedSessions`: sessions whose LAST in-window event is on this path
 *   AND that did not convert anywhere in the window.
 * - `deadEndRate`: `impactedSessions / sessions_that_visited_this_path`.
 * - `rageRate`: fraction of visitors of this path whose session contains any
 *   rage signal (`metrics.rage > 0` or `type === "rage_click"`).
 *
 * Paths visited by fewer than {@link MIN_VISITORS} sessions are dropped to
 * suppress noise — Phase 1 rules apply their own thresholds on top.
 */
export function buildDeadEndAggregates(
  ctx: RollupContext,
  conversionTypes: Set<string>,
): DeadEndAggregate[] {
  const filtered = filterEventsInWindow(ctx.events, ctx.window);
  const sessions = groupEventsBySession(filtered);

  const byPath = new Map<string, PathStats>();
  const sessionIds = [...sessions.keys()].sort((a, b) => a.localeCompare(b));

  for (const sid of sessionIds) {
    const events = sessions.get(sid);
    if (!events || events.length === 0) {
      continue;
    }

    let converted = false;
    let rage = false;
    const visitedPaths = new Set<string>();
    const idsByPath = new Map<string, string[]>();

    for (const event of events) {
      visitedPaths.add(event.path);
      if (isConversion(event, conversionTypes)) {
        converted = true;
      }
      if (isRage(event)) {
        rage = true;
      }
      let bucket = idsByPath.get(event.path);
      if (!bucket) {
        bucket = [];
        idsByPath.set(event.path, bucket);
      }
      bucket.push(event.id);
    }

    const lastPath = events[events.length - 1].path;
    const orderedPaths = [...visitedPaths].sort((a, b) => a.localeCompare(b));
    for (const path of orderedPaths) {
      let stats = byPath.get(path);
      if (!stats) {
        stats = {
          visitors: new Set(),
          impacted: new Set(),
          rageVisitors: new Set(),
          evidenceIds: [],
        };
        byPath.set(path, stats);
      }
      stats.visitors.add(sid);
      if (rage) {
        stats.rageVisitors.add(sid);
      }
      const ids = idsByPath.get(path);
      if (ids) {
        stats.evidenceIds.push(...ids);
      }
      if (lastPath === path && !converted) {
        stats.impacted.add(sid);
      }
    }
  }

  const aggregates: DeadEndAggregate[] = [];
  const orderedPaths = [...byPath.keys()].sort((a, b) => a.localeCompare(b));
  for (const pageRef of orderedPaths) {
    const stats = byPath.get(pageRef)!;
    if (stats.visitors.size < MIN_VISITORS) {
      continue;
    }
    const visitorCount = stats.visitors.size;
    aggregates.push({
      pageRef,
      deadEndRate: visitorCount > 0 ? stats.impacted.size / visitorCount : 0,
      rageRate: visitorCount > 0 ? stats.rageVisitors.size / visitorCount : 0,
      impactedSessions: stats.impacted.size,
      evidenceRefs: uniqueSorted(stats.evidenceIds).slice(0, 10),
    });
  }
  return aggregates;
}
