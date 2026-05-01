/**
 * Zod schemas + helpers for the Phase 2 canonical event.
 * Used by ingestion routes and by connector adapters before persistence.
 */

import { z } from "zod";

import {
  CANONICAL_EVENT_SCHEMA_VERSION,
  type CanonicalEvent,
  type CanonicalEventInput,
  type CanonicalEventSource,
} from "./types";

const ISO_DATE = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "must be a valid ISO date string",
  });

const NON_EMPTY_STRING = z.string().trim().min(1);

const NUMERIC_RECORD = z.record(
  NON_EMPTY_STRING,
  z.number().refine((n) => Number.isFinite(n), { message: "must be finite" }),
);

const PROPERTY_VALUE = z.union([
  z.string(),
  z.number().refine((n) => Number.isFinite(n), { message: "must be finite" }),
  z.boolean(),
  z.null(),
]);

const PROPERTY_RECORD = z.record(NON_EMPTY_STRING, PROPERTY_VALUE);

const SOURCE: z.ZodType<CanonicalEventSource> = z.enum([
  "api",
  "shopify",
  "segment",
  "ga4",
  "posthog",
  "custom",
]);

export const canonicalEventInputSchema: z.ZodType<CanonicalEventInput> = z.object({
  siteId: NON_EMPTY_STRING,
  sessionId: NON_EMPTY_STRING,
  type: NON_EMPTY_STRING,
  path: NON_EMPTY_STRING,
  occurredAt: ISO_DATE.optional(),
  metrics: NUMERIC_RECORD.optional(),
  properties: PROPERTY_RECORD.optional(),
  anonymousId: NON_EMPTY_STRING.optional(),
  source: SOURCE.optional(),
  sourceEventId: NON_EMPTY_STRING.optional(),
});

export interface MaterializeArgs {
  input: CanonicalEventInput;
  organizationId: string;
  id: string;
  createdAt: string;
}

/**
 * Fills server-controlled fields and applies defaults to produce a CanonicalEvent.
 * Pure; same args → same output.
 */
export function materializeCanonicalEvent(args: MaterializeArgs): CanonicalEvent {
  const { input, organizationId, id, createdAt } = args;
  const source: CanonicalEventSource = input.source ?? "api";
  const occurredAt = input.occurredAt ?? createdAt;

  const event: CanonicalEvent = {
    id,
    organizationId,
    siteId: input.siteId,
    sessionId: input.sessionId,
    type: input.type,
    path: input.path,
    occurredAt,
    createdAt,
    source,
    schemaVersion: CANONICAL_EVENT_SCHEMA_VERSION,
  };

  if (input.metrics) event.metrics = input.metrics;
  if (input.properties) event.properties = input.properties;
  if (input.anonymousId) event.anonymousId = input.anonymousId;
  if (input.sourceEventId) event.sourceEventId = input.sourceEventId;

  return event;
}

/** Stable dedupe key for a canonical event from a given source. */
export function dedupeKey(event: Pick<CanonicalEvent, "siteId" | "source" | "sourceEventId">): string | null {
  if (!event.sourceEventId) return null;
  return `${event.siteId}|${event.source}|${event.sourceEventId}`;
}
