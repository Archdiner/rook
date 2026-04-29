import type { CanonicalEvent, TimeWindow } from "@/lib/phase2/types";

/**
 * Returns events whose `occurredAt` falls within `[window.start, window.end)`.
 *
 * Canonical Phase 2 events always carry `occurredAt` (defaulted from
 * `createdAt` at materialization time). Legacy events lacking `occurredAt`
 * or carrying an unparseable value are silently skipped — they cannot be
 * placed on the time axis and propagating the row would corrupt windowing.
 *
 * Throws `TypeError` when the window itself is invalid.
 */
export function filterEventsInWindow(
  events: CanonicalEvent[],
  window: TimeWindow,
): CanonicalEvent[] {
  const { startMs, endMs } = parseWindow(window);

  const filtered: CanonicalEvent[] = [];
  for (const event of events) {
    if (typeof event.occurredAt !== "string") {
      continue;
    }
    const t = Date.parse(event.occurredAt);
    if (!Number.isFinite(t)) {
      continue;
    }
    if (t >= startMs && t < endMs) {
      filtered.push(event);
    }
  }
  return filtered;
}

/** Returns the duration of the window in milliseconds (always non-negative). */
export function windowDurationMs(window: TimeWindow): number {
  const { startMs, endMs } = parseWindow(window);
  return Math.max(0, endMs - startMs);
}

function parseWindow(window: TimeWindow): { startMs: number; endMs: number } {
  if (typeof window !== "object" || window === null) {
    throw new TypeError("window must be an object.");
  }
  if (typeof window.start !== "string") {
    throw new TypeError("window.start must be a string.");
  }
  if (typeof window.end !== "string") {
    throw new TypeError("window.end must be a string.");
  }
  const startMs = Date.parse(window.start);
  const endMs = Date.parse(window.end);
  if (!Number.isFinite(startMs)) {
    throw new TypeError("window.start must be a valid ISO date string.");
  }
  if (!Number.isFinite(endMs)) {
    throw new TypeError("window.end must be a valid ISO date string.");
  }
  if (endMs <= startMs) {
    throw new TypeError("window.end must be strictly after window.start.");
  }
  return { startMs, endMs };
}
