import type { CtaAggregate } from "@/lib/phase1/insights/types";
import type { CanonicalEvent, CtaConfig, RollupContext } from "@/lib/phase2/types";

import { isConversion, uniqueSorted } from "./helpers";
import { groupEventsBySession } from "./sessions";
import { filterEventsInWindow } from "./timeWindow";

interface CtaStats {
  clicks: string[];
  sessions: Set<string>;
}

interface PageTotals {
  totalClicks: number;
  sessionsAny: Set<string>;
  sessionsAnyConverted: Set<string>;
}

/**
 * Builds CTA aggregates per configured CTA. A click event matches a CTA when:
 *   - `event.path.startsWith(cta.pageRef)` AND
 *   - the CTA `match` clause holds: `event-type` (exact `type` match) or
 *     `property-equals` (string-equality on `event.properties[key]`).
 *
 * - `clickShare`: `clicks_for_this_cta / total_clicks_on_pageRef`.
 * - `conversionShare`: `sessions_that_clicked_this_cta_and_converted /
 *   sessions_that_clicked_any_cta_on_pageRef_and_converted`. When that
 *   denominator is `0`, falls back to `sessions_that_clicked_this_cta /
 *   sessions_that_clicked_any_cta_on_pageRef` so the metric remains
 *   informative on low-traffic pages.
 */
export function buildCtaAggregates(
  ctx: RollupContext,
  conversionTypes: Set<string>,
): CtaAggregate[] {
  const filtered = filterEventsInWindow(ctx.events, ctx.window);
  const sessions = groupEventsBySession(filtered);

  const sessionConverted = new Map<string, boolean>();
  for (const [sid, events] of sessions) {
    sessionConverted.set(
      sid,
      events.some((event) => isConversion(event, conversionTypes)),
    );
  }

  const ctaStatsByConfig = new Map<CtaConfig, CtaStats>();
  for (const cta of ctx.config.ctas) {
    ctaStatsByConfig.set(cta, { clicks: [], sessions: new Set() });
  }

  const ctaByPage = new Map<string, CtaConfig[]>();
  for (const cta of ctx.config.ctas) {
    let bucket = ctaByPage.get(cta.pageRef);
    if (!bucket) {
      bucket = [];
      ctaByPage.set(cta.pageRef, bucket);
    }
    bucket.push(cta);
  }

  const sessionIds = [...sessions.keys()].sort((a, b) => a.localeCompare(b));
  for (const sid of sessionIds) {
    const events = sessions.get(sid)!;
    for (const event of events) {
      for (const cta of ctx.config.ctas) {
        if (matchesCta(event, cta)) {
          const stats = ctaStatsByConfig.get(cta)!;
          stats.clicks.push(event.id);
          stats.sessions.add(sid);
        }
      }
    }
  }

  const pageTotals = new Map<string, PageTotals>();
  for (const [pageRef, ctas] of ctaByPage) {
    const totals: PageTotals = {
      totalClicks: 0,
      sessionsAny: new Set<string>(),
      sessionsAnyConverted: new Set<string>(),
    };
    for (const cta of ctas) {
      const stats = ctaStatsByConfig.get(cta)!;
      totals.totalClicks += stats.clicks.length;
      for (const sid of stats.sessions) {
        totals.sessionsAny.add(sid);
        if (sessionConverted.get(sid) === true) {
          totals.sessionsAnyConverted.add(sid);
        }
      }
    }
    pageTotals.set(pageRef, totals);
  }

  const orderedCtas = [...ctx.config.ctas].sort((a, b) => {
    if (a.pageRef !== b.pageRef) {
      return a.pageRef.localeCompare(b.pageRef);
    }
    return a.ctaId.localeCompare(b.ctaId);
  });

  const aggregates: CtaAggregate[] = [];
  for (const cta of orderedCtas) {
    const stats = ctaStatsByConfig.get(cta)!;
    const totals = pageTotals.get(cta.pageRef)!;

    const clickShare = totals.totalClicks > 0 ? stats.clicks.length / totals.totalClicks : 0;

    const ctaConvertedSessions = [...stats.sessions].reduce(
      (count, sid) => count + (sessionConverted.get(sid) === true ? 1 : 0),
      0,
    );
    let conversionShare: number;
    if (totals.sessionsAnyConverted.size > 0) {
      conversionShare = ctaConvertedSessions / totals.sessionsAnyConverted.size;
    } else if (totals.sessionsAny.size > 0) {
      conversionShare = stats.sessions.size / totals.sessionsAny.size;
    } else {
      conversionShare = 0;
    }

    aggregates.push({
      pageRef: cta.pageRef,
      ctaId: cta.ctaId,
      label: cta.label,
      visualWeight: cta.visualWeight,
      clickShare,
      conversionShare,
      evidenceRefs: uniqueSorted(stats.clicks).slice(0, 10),
    });
  }

  return aggregates;
}

/**
 * Counts the total number of CTA-matching click events in the window — used
 * by the orchestrator's diagnostics. Pure; same input → same output.
 */
export function countCtaClickEvents(ctx: RollupContext): number {
  const filtered = filterEventsInWindow(ctx.events, ctx.window);
  let total = 0;
  for (const event of filtered) {
    for (const cta of ctx.config.ctas) {
      if (matchesCta(event, cta)) {
        total += 1;
      }
    }
  }
  return total;
}

function matchesCta(event: CanonicalEvent, cta: CtaConfig): boolean {
  if (!event.path.startsWith(cta.pageRef)) {
    return false;
  }
  if (cta.match.kind === "event-type") {
    return event.type === cta.match.type;
  }
  const value = event.properties?.[cta.match.key];
  return typeof value === "string" && value === cta.match.value;
}
