import { randomUUID } from 'crypto';
import { createPhase1Repository } from '@/lib/phase1';
import { CANONICAL_EVENT_SCHEMA_VERSION } from '@/lib/phase2/types';
import type { CanonicalEventSource } from '@/lib/phase2/types';
import {
  asObject,
  badRequest,
  mapRouteError,
  parseJsonObject,
  parsePositiveInt,
  resolveOrganizationContext,
  parseString,
  success,
} from '../_shared';

const VALID_SOURCES: ReadonlySet<CanonicalEventSource> = new Set([
  'api',
  'shopify',
  'segment',
  'ga4',
  'posthog',
  'custom',
]);

function parseMetrics(value: unknown): Record<string, number> | undefined {
  if (value == null) return undefined;
  const obj = asObject(value);
  if (!obj) return undefined;

  const entries = Object.entries(obj);
  if (entries.length === 0) return undefined;

  const metrics: Record<string, number> = {};
  for (const [key, raw] of entries) {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      return undefined;
    }
    metrics[key] = raw;
  }

  return Object.keys(metrics).length > 0 ? metrics : undefined;
}

function parseProperties(
  value: unknown
): Record<string, string | number | boolean | null> | undefined {
  if (value == null) return undefined;
  const obj = asObject(value);
  if (!obj) return undefined;
  const props: Record<string, string | number | boolean | null> = {};
  for (const [key, raw] of Object.entries(obj)) {
    if (raw === null || typeof raw === 'boolean' || typeof raw === 'string') {
      props[key] = raw;
      continue;
    }
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      props[key] = raw;
      continue;
    }
    return undefined;
  }
  return Object.keys(props).length > 0 ? props : undefined;
}

function parseSource(value: unknown): CanonicalEventSource {
  if (typeof value !== 'string') return 'api';
  const lower = value.toLowerCase();
  return VALID_SOURCES.has(lower as CanonicalEventSource)
    ? (lower as CanonicalEventSource)
    : 'api';
}

function parseIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (Number.isNaN(Date.parse(value))) return null;
  return value;
}

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonObject(request);
    if (!parsed.ok) {
      return badRequest(parsed.message);
    }
    const body = parsed.value;

    const siteId = parseString(body.siteId);
    if (!siteId) {
      return badRequest('`siteId` is required and must be a non-empty string.');
    }

    const sessionId = parseString(body.sessionId);
    if (!sessionId) {
      return badRequest('`sessionId` is required and must be a non-empty string.');
    }

    const type = parseString(body.type);
    if (!type) {
      return badRequest('`type` is required and must be a non-empty string.');
    }

    const path = parseString(body.path);
    if (!path) {
      return badRequest('`path` is required and must be a non-empty string.');
    }

    if (body.metrics != null && parseMetrics(body.metrics) == null) {
      return badRequest('`metrics` must be an object with numeric values.');
    }

    if (body.properties != null && parseProperties(body.properties) == null) {
      return badRequest(
        '`properties` must be an object with string|number|boolean|null values.'
      );
    }

    if (body.occurredAt != null && parseIsoDate(body.occurredAt) == null) {
      return badRequest('`occurredAt` must be a valid ISO date string when provided.');
    }

    const metrics = parseMetrics(body.metrics);
    const properties = parseProperties(body.properties);
    const source = parseSource(body.source);
    const sourceEventId = parseString(body.sourceEventId) ?? undefined;
    const anonymousId = parseString(body.anonymousId) ?? undefined;
    const occurredAtRaw = parseIsoDate(body.occurredAt);

    const orgContext = resolveOrganizationContext(request, {
      bodyOrganizationId: body.organizationId,
      allowQueryFallback: false,
    });
    if (!orgContext.ok) {
      return orgContext.response;
    }

    const repository = createPhase1Repository();
    const createdAt = new Date().toISOString();
    const occurredAt = occurredAtRaw ?? createdAt;

    const created = await repository.createCanonicalEvent({
      id: randomUUID(),
      organizationId: orgContext.organizationId,
      siteId,
      sessionId,
      type,
      path,
      occurredAt,
      createdAt,
      source,
      schemaVersion: CANONICAL_EVENT_SCHEMA_VERSION,
      ...(metrics ? { metrics } : {}),
      ...(properties ? { properties } : {}),
      ...(sourceEventId ? { sourceEventId } : {}),
      ...(anonymousId ? { anonymousId } : {}),
    });
    return success(created, 201);
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function GET(request: Request) {
  try {
    const repository = createPhase1Repository();
    const url = new URL(request.url);
    const siteId = parseString(url.searchParams.get('siteId'));
    if (!siteId) {
      return badRequest('`siteId` query param is required.');
    }

    const limit = parsePositiveInt(url.searchParams.get('limit'), 100, 500);
    const orgContext = resolveOrganizationContext(request, { allowQueryFallback: true });
    if (!orgContext.ok) {
      return orgContext.response;
    }
    const events = await repository.listEvents({
      organizationId: orgContext.organizationId,
      siteId,
      limit,
    });

    return success(events);
  } catch (error) {
    return mapRouteError(error);
  }
}
