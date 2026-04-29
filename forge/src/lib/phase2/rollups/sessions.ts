import type { CanonicalEvent } from "@/lib/phase2/types";

/**
 * Groups events by `sessionId`. Each session bucket is sorted ascending by
 * `occurredAt`, with `id` as a deterministic tiebreaker for events that
 * share a millisecond.
 */
export function groupEventsBySession(
  events: CanonicalEvent[],
): Map<string, CanonicalEvent[]> {
  const grouped = new Map<string, CanonicalEvent[]>();
  for (const event of events) {
    let bucket = grouped.get(event.sessionId);
    if (!bucket) {
      bucket = [];
      grouped.set(event.sessionId, bucket);
    }
    bucket.push(event);
  }
  for (const bucket of grouped.values()) {
    bucket.sort((a, b) => {
      const at = Date.parse(a.occurredAt);
      const bt = Date.parse(b.occurredAt);
      if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) {
        return at - bt;
      }
      return a.id.localeCompare(b.id);
    });
  }
  return grouped;
}

/** Counts unique session ids across the supplied events. */
export function countUniqueSessions(events: CanonicalEvent[]): number {
  const ids = new Set<string>();
  for (const event of events) {
    ids.add(event.sessionId);
  }
  return ids.size;
}
