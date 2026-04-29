/**
 * PostHog sync adapter. Composes the HTTP client, cursor helpers, and
 * mapping module into one orderly run.
 *
 * Returns the canonical events to insert and the cursor to persist; the
 * route layer is responsible for both repository writes and cursor durability.
 * The adapter never reads or writes Forge storage directly.
 */

import type { CanonicalEventInput } from "@/lib/phase2/types";

import { fetchPostHogEventsPage } from "./client";
import {
  advanceCursor,
  filterAfterCursor,
  readCursor,
  writeCursor,
} from "./cursor";
import { PostHogConnectorError } from "./errors";
import { mapPostHogEvents } from "./mapping";
import type {
  ConnectorContext,
  ValidateReport,
} from "../types";
import type {
  PostHogConnectorConfig,
  PostHogCursor,
  PostHogEventDTO,
} from "./types";

export interface RunSyncResult {
  events: CanonicalEventInput[];
  cursor: Record<string, unknown> | null;
  hasMore: boolean;
  pages: number;
}

const PAGE_SIZE = 100;

interface ResolvedConfig {
  host: string;
  projectId: string;
  maxEventsPerSync: number;
}

function resolveConfig(ctx: ConnectorContext): ResolvedConfig {
  const config = ctx.integration.config as Partial<PostHogConnectorConfig>;
  const host = typeof config.host === "string" ? config.host.trim() : "";
  const projectId = typeof config.projectId === "string" ? config.projectId.trim() : "";
  if (host.length === 0) {
    throw new PostHogConnectorError(
      "POSTHOG_CONFIG",
      "Integration is missing PostHog host.",
    );
  }
  if (projectId.length === 0) {
    throw new PostHogConnectorError(
      "POSTHOG_CONFIG",
      "Integration is missing PostHog projectId.",
    );
  }
  const maxEventsPerSync =
    typeof config.maxEventsPerSync === "number" && Number.isFinite(config.maxEventsPerSync)
      ? Math.max(0, Math.floor(config.maxEventsPerSync))
      : 5000;
  return { host, projectId, maxEventsPerSync };
}

function applyUntilFilter(events: PostHogEventDTO[], until: string | null): PostHogEventDTO[] {
  if (until === null) return events;
  const untilMs = Date.parse(until);
  if (!Number.isFinite(untilMs)) return events;
  return events.filter((event) => {
    const ts = Date.parse(event.timestamp);
    if (!Number.isFinite(ts)) return true;
    return ts < untilMs;
  });
}

function sortCanonicalAscending(events: CanonicalEventInput[]): CanonicalEventInput[] {
  return [...events].sort((a, b) => {
    const at = a.occurredAt !== undefined ? Date.parse(a.occurredAt) : NaN;
    const bt = b.occurredAt !== undefined ? Date.parse(b.occurredAt) : NaN;
    if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt;
    if (a.occurredAt !== b.occurredAt) {
      const ax = a.occurredAt ?? "";
      const bx = b.occurredAt ?? "";
      if (ax < bx) return -1;
      if (ax > bx) return 1;
    }
    const au = a.sourceEventId ?? "";
    const bu = b.sourceEventId ?? "";
    if (au < bu) return -1;
    if (au > bu) return 1;
    return 0;
  });
}

/**
 * Executes one sync run. Stops when:
 *   - PostHog returns no `next`.
 *   - Total fetched reaches `ctx.maxEvents`.
 *   - Caller AbortSignal fires.
 *
 * Throws `PostHogConnectorError` only on non-recoverable failures; recoverable
 * cases are handled internally via the client's retry policy.
 */
export async function runPostHogSync(
  ctx: ConnectorContext,
  signal?: AbortSignal,
): Promise<RunSyncResult> {
  const { host, projectId, maxEventsPerSync } = resolveConfig(ctx);
  const apiKey = ctx.secret;

  const persistedCursor = readCursor(ctx.integration.cursor);
  const sinceOverride = ctx.since;

  // When `ctx.since` is provided, treat the run as a fresh window starting
  // strictly after it. Otherwise resume from the persisted cursor.
  const effectiveAfter = sinceOverride ?? persistedCursor.lastTimestamp ?? undefined;
  const cursorForFilter: PostHogCursor =
    sinceOverride !== null
      ? { lastTimestamp: sinceOverride, lastUuid: null }
      : persistedCursor;

  const maxEvents = Math.max(0, Math.floor(ctx.maxEvents));
  const cap = maxEventsPerSync > 0 ? Math.min(maxEvents, maxEventsPerSync) : maxEvents;

  const accumulated: CanonicalEventInput[] = [];
  let cursor: PostHogCursor = persistedCursor;
  let pages = 0;
  let nextUrl: string | undefined;
  let hasMore = false;

  while (accumulated.length < cap) {
    if (signal?.aborted) {
      hasMore = nextUrl !== undefined;
      break;
    }

    const page = await fetchPostHogEventsPage(
      { host, projectId, apiKey },
      {
        after: nextUrl !== undefined ? undefined : effectiveAfter,
        nextUrl,
        limit: PAGE_SIZE,
        signal,
      },
    );
    pages += 1;

    const filtered = applyUntilFilter(
      filterAfterCursor(page.results, cursorForFilter),
      ctx.until,
    );

    cursor = advanceCursor(cursor, filtered);

    const { events: canonical } = mapPostHogEvents(filtered, {
      siteId: ctx.integration.siteId,
    });

    const remaining = cap - accumulated.length;
    accumulated.push(...canonical.slice(0, remaining));

    const next = page.next ?? null;
    if (next === null || next.length === 0) {
      hasMore = false;
      break;
    }
    nextUrl = next;

    if (accumulated.length >= cap) {
      hasMore = true;
      break;
    }
  }

  return {
    events: sortCanonicalAscending(accumulated),
    cursor: writeCursor(cursor),
    hasMore,
    pages,
  };
}

/**
 * Dry-run check: hit one page and report whether credentials, host, and
 * projectId appear correct. Non-throwing for recoverable errors; surfaces them
 * as `warnings` with stable error codes. Throws POSTHOG_CONFIG only when
 * config is fundamentally missing.
 */
export async function validatePostHogConnection(
  ctx: ConnectorContext,
): Promise<ValidateReport> {
  const { host, projectId } = resolveConfig(ctx);

  try {
    const page = await fetchPostHogEventsPage(
      { host, projectId, apiKey: ctx.secret },
      { limit: PAGE_SIZE },
    );
    const { events } = mapPostHogEvents(page.results, {
      siteId: ctx.integration.siteId,
    });
    const types = Array.from(new Set(events.map((e) => e.type))).sort();
    return {
      ok: true,
      sampleEvents: page.results.length,
      recentEventTypes: types,
      warnings: [],
    };
  } catch (err) {
    if (err instanceof PostHogConnectorError) {
      if (err.code === "POSTHOG_CONFIG") throw err;
      return {
        ok: false,
        sampleEvents: null,
        recentEventTypes: [],
        warnings: [{ code: err.code, message: err.message }],
      };
    }
    return {
      ok: false,
      sampleEvents: null,
      recentEventTypes: [],
      warnings: [
        {
          code: "POSTHOG_HTTP",
          message: err instanceof Error ? err.message : "Unknown PostHog error.",
        },
      ],
    };
  }
}
