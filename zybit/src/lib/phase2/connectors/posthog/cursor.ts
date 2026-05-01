/**
 * Pure cursor helpers. The cursor tracks the last (timestamp, uuid) pair
 * we processed so that subsequent syncs resume after it. ISO timestamps are
 * compared via `Date.parse` for correctness across formats; uuids break ties
 * lexicographically.
 *
 * No I/O, no clocks. The route layer is responsible for persistence.
 */

import type { PostHogCursor, PostHogEventDTO } from "./types";

export function emptyCursor(): PostHogCursor {
  return { lastTimestamp: null, lastUuid: null };
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : value;
}

export function readCursor(value: Record<string, unknown> | null | undefined): PostHogCursor {
  if (!value) return emptyCursor();
  return {
    lastTimestamp: asNonEmptyString(value.lastTimestamp),
    lastUuid: asNonEmptyString(value.lastUuid),
  };
}

export function writeCursor(cursor: PostHogCursor): Record<string, unknown> {
  return {
    lastTimestamp: cursor.lastTimestamp,
    lastUuid: cursor.lastUuid,
  };
}

function eventUuid(event: PostHogEventDTO): string {
  if (typeof event.uuid === "string" && event.uuid.length > 0) return event.uuid;
  if (typeof event.id === "string" && event.id.length > 0) return event.id;
  return "";
}

/** Compares two ISO timestamps. Returns -1 / 0 / 1 (a vs b). */
function compareTimestamps(a: string, b: string): number {
  const at = Date.parse(a);
  const bt = Date.parse(b);
  if (Number.isFinite(at) && Number.isFinite(bt)) {
    if (at < bt) return -1;
    if (at > bt) return 1;
    return 0;
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function compareLex(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Returns the largest (timestamp, uuid) pair seen across `page` and the
 * incoming cursor. When `page` is empty, `current` is returned unchanged.
 */
export function advanceCursor(current: PostHogCursor, page: PostHogEventDTO[]): PostHogCursor {
  if (page.length === 0) return current;

  let maxTimestamp = page[0].timestamp;
  let maxUuid = eventUuid(page[0]);

  for (let i = 1; i < page.length; i++) {
    const ts = page[i].timestamp;
    const uuid = eventUuid(page[i]);
    const cmp = compareTimestamps(ts, maxTimestamp);
    if (cmp > 0 || (cmp === 0 && compareLex(uuid, maxUuid) > 0)) {
      maxTimestamp = ts;
      maxUuid = uuid;
    }
  }

  if (current.lastTimestamp === null) {
    return { lastTimestamp: maxTimestamp, lastUuid: maxUuid.length === 0 ? null : maxUuid };
  }

  const cmp = compareTimestamps(maxTimestamp, current.lastTimestamp);
  if (cmp > 0) {
    return { lastTimestamp: maxTimestamp, lastUuid: maxUuid.length === 0 ? null : maxUuid };
  }
  if (cmp === 0) {
    const currentUuid = current.lastUuid ?? "";
    if (compareLex(maxUuid, currentUuid) > 0) {
      return { lastTimestamp: maxTimestamp, lastUuid: maxUuid.length === 0 ? null : maxUuid };
    }
  }
  return current;
}

/**
 * Drops events that are at or before the cursor; ties on timestamp are
 * broken by uuid. When the cursor is empty, the input array is returned.
 */
export function filterAfterCursor(
  events: PostHogEventDTO[],
  cursor: PostHogCursor,
): PostHogEventDTO[] {
  if (cursor.lastTimestamp === null) return events;
  const cursorTs = cursor.lastTimestamp;
  const cursorUuid = cursor.lastUuid ?? "";

  return events.filter((event) => {
    const cmp = compareTimestamps(event.timestamp, cursorTs);
    if (cmp > 0) return true;
    if (cmp < 0) return false;
    return compareLex(eventUuid(event), cursorUuid) > 0;
  });
}
