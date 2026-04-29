/**
 * PostHog → Forge canonical event mapping.
 *
 * Pure, deterministic transformation: same input → same output. No I/O,
 * no clocks, no env reads. Designed to run inside connector adapters and
 * inside ad-hoc backfill scripts with identical results.
 *
 * PII guardrails: this mapper never copies `$ip`, `$user_agent`, `email`,
 * `name`, `phone`, raw cookies, or other unknown property blobs. Only the
 * explicitly named subset below is forwarded onto the canonical event.
 *
 * Conversion proxy: if a PostHog event carries `$revenue` (any finite
 * number, even 0) we set `metrics.conversion = 1`. Phase 2 rollups treat
 * any revenue-tagged event as a conversion signal; if a downstream config
 * needs stricter rules it should match by event type instead.
 */

import type { CanonicalEventInput } from "@/lib/phase2/types";

import type { PostHogEventDTO } from "./types";

export interface MapResult {
  event: CanonicalEventInput | null;
  /** Reason the event was skipped, when event is null. Stable codes: "MISSING_TIMESTAMP", "MISSING_EVENT_NAME", "INVALID_TIMESTAMP", "INVALID_PATH". */
  skippedReason?: "MISSING_TIMESTAMP" | "MISSING_EVENT_NAME" | "INVALID_TIMESTAMP" | "INVALID_PATH";
}

export interface MapOptions {
  /** Forge site id assigned to events that come from this integration. */
  siteId: string;
}

type SkipReason = NonNullable<MapResult["skippedReason"]>;

const SESSION_PROPERTY_KEYS = ["$session_id", "$window_id", "session_id"] as const;

const PROPERTY_PASSTHROUGH_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const PROPERTY_RENAME_MAP: ReadonlyArray<{ from: string; to: string }> = [
  { from: "$browser", to: "browser" },
  { from: "$device_type", to: "device_type" },
  { from: "$referrer", to: "referrer" },
  { from: "$host", to: "host" },
];

/**
 * Map a single PostHog event to a CanonicalEventInput.
 *
 * Returns `{ event: null, skippedReason }` when the event cannot be
 * canonicalized but the input shape is otherwise structurally sound.
 * Throws `TypeError` when `dto` or `options` is not an object — the
 * adapter is expected to feed us valid PostHog DTOs.
 */
export function mapPostHogEvent(dto: PostHogEventDTO, options: MapOptions): MapResult {
  assertOptions(options);
  assertDto(dto);

  if (typeof dto.event !== "string" || dto.event.trim().length === 0) {
    return { event: null, skippedReason: "MISSING_EVENT_NAME" };
  }
  const rawEventName = dto.event.trim();
  const type = canonicalizeEventName(rawEventName);

  if (dto.timestamp === undefined || dto.timestamp === null || dto.timestamp === "") {
    return { event: null, skippedReason: "MISSING_TIMESTAMP" };
  }
  if (typeof dto.timestamp !== "string") {
    return { event: null, skippedReason: "INVALID_TIMESTAMP" };
  }
  const parsedTs = Date.parse(dto.timestamp);
  if (Number.isNaN(parsedTs)) {
    return { event: null, skippedReason: "INVALID_TIMESTAMP" };
  }
  const occurredAt = new Date(parsedTs).toISOString();

  const properties = isRecord(dto.properties) ? dto.properties : {};

  const pathResult = derivePath(properties);
  if (pathResult.kind === "invalid") {
    return { event: null, skippedReason: "INVALID_PATH" };
  }

  const distinctId = dto.distinct_id ?? dto.person?.distinct_id;
  const sessionId = deriveSessionId(properties, distinctId);
  const anonymousId = deriveAnonymousId(distinctId);
  const sourceEventId = deriveSourceEventId(dto);
  const metrics = deriveMetrics(properties, type);
  const mappedProperties = deriveProperties(properties, rawEventName);

  const event: CanonicalEventInput = {
    siteId: options.siteId,
    sessionId,
    type,
    path: pathResult.value,
    occurredAt,
    source: "posthog",
  };

  if (anonymousId !== undefined) {
    event.anonymousId = anonymousId;
  }
  if (sourceEventId !== undefined) {
    event.sourceEventId = sourceEventId;
  }
  if (metrics !== undefined) {
    event.metrics = metrics;
  }
  if (mappedProperties !== undefined) {
    event.properties = mappedProperties;
  }

  return { event };
}

/**
 * Map many PostHog events. Preserves input order for emitted events and
 * for skip diagnostics; skip diagnostics carry the original index so the
 * caller can correlate against the input array.
 */
export function mapPostHogEvents(
  dtos: PostHogEventDTO[],
  options: MapOptions,
): { events: CanonicalEventInput[]; skipped: Array<{ index: number; reason: SkipReason }> } {
  if (!Array.isArray(dtos)) {
    throw new TypeError("dtos must be an array.");
  }
  assertOptions(options);

  const events: CanonicalEventInput[] = [];
  const skipped: Array<{ index: number; reason: SkipReason }> = [];

  for (let index = 0; index < dtos.length; index++) {
    const result = mapPostHogEvent(dtos[index], options);
    if (result.event === null) {
      if (result.skippedReason === undefined) {
        continue;
      }
      skipped.push({ index, reason: result.skippedReason });
      continue;
    }
    events.push(result.event);
  }

  return { events, skipped };
}

/**
 * Known PostHog event names get a stable Forge type. Unknown `$`-prefixed
 * names lose the leading `$` for canonical readability; bare event names
 * pass through untouched so custom product events keep their identity.
 */
function canonicalizeEventName(raw: string): string {
  switch (raw) {
    case "$pageview":
      return "page_view";
    case "$pageleave":
      return "page_leave";
    case "$autocapture":
      return "cta_click";
    case "$rageclick":
      return "rage_click";
    default:
      return raw.startsWith("$") ? raw.slice(1) : raw;
  }
}

function deriveSessionId(properties: Record<string, unknown>, distinctId: unknown): string {
  for (const key of SESSION_PROPERTY_KEYS) {
    const candidate = properties[key];
    const trimmed = trimToString(candidate);
    if (trimmed !== null) {
      return trimmed;
    }
  }
  const fromDistinct = trimToString(distinctId);
  if (fromDistinct !== null) {
    return fromDistinct;
  }
  return "unknown_session";
}

function deriveAnonymousId(distinctId: unknown): string | undefined {
  const trimmed = trimToString(distinctId);
  return trimmed === null ? undefined : trimmed;
}

function deriveSourceEventId(dto: PostHogEventDTO): string | undefined {
  const fromUuid = trimToString(dto.uuid);
  if (fromUuid !== null) {
    return fromUuid;
  }
  const fromId = trimToString(dto.id);
  if (fromId !== null) {
    return fromId;
  }
  return undefined;
}

type PathDerivation = { kind: "ok"; value: string } | { kind: "invalid" };

function derivePath(properties: Record<string, unknown>): PathDerivation {
  const pathname = properties["$pathname"];
  if (typeof pathname === "string") {
    const cleaned = pathname.trimEnd();
    if (cleaned.length > 0) {
      return { kind: "ok", value: ensureLeadingSlash(cleaned) };
    }
  }

  const currentUrl = properties["$current_url"];
  if (typeof currentUrl === "string" && currentUrl.length > 0) {
    try {
      const parsed = new URL(currentUrl);
      const pathFromUrl = parsed.pathname.trimEnd();
      return { kind: "ok", value: ensureLeadingSlash(pathFromUrl.length === 0 ? "/" : pathFromUrl) };
    } catch {
      const trimmed = currentUrl.trimEnd();
      if (trimmed.startsWith("/")) {
        return { kind: "ok", value: trimmed };
      }
      return { kind: "invalid" };
    }
  }

  return { kind: "ok", value: "/" };
}

function ensureLeadingSlash(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}

function deriveMetrics(
  properties: Record<string, unknown>,
  type: string,
): Record<string, number> | undefined {
  const metrics: Record<string, number> = {};

  const duration = properties["$duration"];
  if (isFiniteNumber(duration)) {
    metrics.dwellMs = duration * 1000;
  } else {
    const dwell = properties["dwell_ms"];
    if (isFiniteNumber(dwell)) {
      metrics.dwellMs = dwell;
    }
  }

  const scroll = properties["$scroll_percentage"];
  if (isFiniteNumber(scroll)) {
    metrics.scrollPct = clamp(scroll, 0, 100);
  }

  const intent = properties["intent"];
  if (isFiniteNumber(intent)) {
    metrics.intent = clamp(intent, 0, 1);
  }

  if (type === "rage_click") {
    metrics.rage = 1;
  } else {
    const rageCount = properties["$rage_click_count"];
    if (isFiniteNumber(rageCount)) {
      metrics.rage = rageCount;
    }
  }

  const revenue = properties["$revenue"];
  if (isFiniteNumber(revenue)) {
    metrics.conversion = 1;
  }

  if (Object.keys(metrics).length === 0) {
    return undefined;
  }
  return sortRecord(metrics);
}

function deriveProperties(
  properties: Record<string, unknown>,
  rawEventName: string,
): Record<string, string | number | boolean | null> | undefined {
  const out: Record<string, string | number | boolean | null> = {};

  for (const key of PROPERTY_PASSTHROUGH_KEYS) {
    const value = properties[key];
    if (isCanonicalPropertyValue(value)) {
      out[key] = value;
    }
  }

  for (const { from, to } of PROPERTY_RENAME_MAP) {
    const value = properties[from];
    if (isCanonicalPropertyValue(value)) {
      out[to] = value;
    }
  }

  if (rawEventName === "$autocapture") {
    const ctaText = properties["$el_text"];
    if (typeof ctaText === "string") {
      out.cta_text = ctaText;
    }
    const ctaId = properties["$el_attr__data-attr"];
    if (typeof ctaId === "string") {
      out.cta_id = ctaId;
    }
    const ctaTag = properties["tag_name"];
    if (typeof ctaTag === "string") {
      out.cta_tag = ctaTag;
    }
  }

  if (Object.keys(out).length === 0) {
    return undefined;
  }
  return sortRecord(out);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isCanonicalPropertyValue(value: unknown): value is string | number | boolean | null {
  if (value === null) {
    return true;
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  return false;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimToString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  const keys = Object.keys(record).sort((a, b) => a.localeCompare(b));
  const out: Record<string, T> = {};
  for (const key of keys) {
    out[key] = record[key];
  }
  return out;
}

function assertOptions(options: MapOptions): void {
  if (typeof options !== "object" || options === null) {
    throw new TypeError("options must be an object.");
  }
  if (typeof options.siteId !== "string" || options.siteId.trim().length === 0) {
    throw new TypeError("options.siteId must be a non-empty string.");
  }
}

function assertDto(dto: PostHogEventDTO): void {
  if (typeof dto !== "object" || dto === null) {
    throw new TypeError("dto must be an object.");
  }
}
