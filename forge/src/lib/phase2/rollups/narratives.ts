import type { NarrativePathAggregate } from "@/lib/phase1/insights/types";
import type { RollupContext } from "@/lib/phase2/types";

import { uniqueSorted } from "./helpers";
import { groupEventsBySession } from "./sessions";
import { filterEventsInWindow } from "./timeWindow";

const MIN_SCOPED_SESSIONS = 10;

/**
 * Builds narrative-path aggregates per declared narrative.
 *
 * Scoping: a session belongs to a narrative when its first in-window event's
 * `path` starts with `narrative.sourcePathRef`.
 *
 * Next-path resolution: walk the scoped session's events in chronological
 * order and pick the first `path` that is NOT exactly equal to
 * `sourcePathRef`. Sub-paths of the source (e.g. `/landing/sub` when source is
 * `/landing`) DO count as a next path because the canonical `path` is the
 * stable address of that screen.
 *
 * - `dominantPathRef`: most common next path; ties broken by `localeCompare`.
 * - `dominantPathShare`: `sessions_with_dominant_next / scoped_sessions`.
 * - `mismatchRate`: share of scoped sessions whose next path is not in
 *   `expectedPathRefs`. Sessions that NEVER leave the source path are
 *   counted as mismatches (the narrative did not fulfil its promise).
 *
 * Narratives with fewer than {@link MIN_SCOPED_SESSIONS} scoped sessions are
 * dropped — too few signals to draw conclusions from.
 */
export function buildNarrativeAggregates(
  ctx: RollupContext,
): NarrativePathAggregate[] {
  const filtered = filterEventsInWindow(ctx.events, ctx.window);
  const sessions = groupEventsBySession(filtered);
  const sessionIds = [...sessions.keys()].sort((a, b) => a.localeCompare(b));

  const orderedNarratives = [...ctx.config.narratives].sort((a, b) =>
    a.id.localeCompare(b.id),
  );

  const aggregates: NarrativePathAggregate[] = [];
  for (const narrative of orderedNarratives) {
    const scoped: string[] = [];
    const nextPathBySession = new Map<string, string | null>();
    const evidenceIds: string[] = [];

    for (const sid of sessionIds) {
      const events = sessions.get(sid);
      if (!events || events.length === 0) {
        continue;
      }
      if (!events[0].path.startsWith(narrative.sourcePathRef)) {
        continue;
      }
      scoped.push(sid);

      let next: string | null = null;
      for (const event of events) {
        if (event.path !== narrative.sourcePathRef) {
          next = event.path;
          break;
        }
      }
      nextPathBySession.set(sid, next);
      for (const event of events) {
        evidenceIds.push(event.id);
      }
    }

    if (scoped.length < MIN_SCOPED_SESSIONS) {
      continue;
    }

    const counts = new Map<string, number>();
    let mismatchCount = 0;
    const expected = new Set(narrative.expectedPathRefs);
    for (const sid of scoped) {
      const next = nextPathBySession.get(sid) ?? null;
      if (next === null) {
        mismatchCount += 1;
        continue;
      }
      counts.set(next, (counts.get(next) ?? 0) + 1);
      if (!expected.has(next)) {
        mismatchCount += 1;
      }
    }

    let dominantPath = "";
    let dominantCount = 0;
    const orderedPaths = [...counts.keys()].sort((a, b) => a.localeCompare(b));
    for (const path of orderedPaths) {
      const count = counts.get(path) ?? 0;
      if (count > dominantCount) {
        dominantCount = count;
        dominantPath = path;
      }
    }

    const dominantPathShare = scoped.length > 0 ? dominantCount / scoped.length : 0;
    const mismatchRate = scoped.length > 0 ? mismatchCount / scoped.length : 0;
    const evidenceRefs = uniqueSorted(evidenceIds).slice(0, 10);

    aggregates.push({
      narrativeId: narrative.id,
      narrativeLabel: narrative.label,
      expectedPathRefs: [...narrative.expectedPathRefs],
      dominantPathRef: dominantPath,
      dominantPathShare,
      mismatchRate,
      evidenceRefs,
    });
  }

  return aggregates;
}
