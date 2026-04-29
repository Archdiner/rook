import { randomUUID } from 'crypto';
import { createPhase1Repository } from '@/lib/phase1';
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

    const metrics = parseMetrics(body.metrics);
    const orgContext = resolveOrganizationContext(request, {
      bodyOrganizationId: body.organizationId,
      allowQueryFallback: false,
    });
    if (!orgContext.ok) {
      return orgContext.response;
    }

    const repository = createPhase1Repository();
    const event = {
      id: randomUUID(),
      organizationId: orgContext.organizationId,
      siteId,
      sessionId,
      type,
      path,
      createdAt: new Date().toISOString(),
      ...(metrics ? { metrics } : {}),
    };

    const created = await repository.createEvent(event);
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
