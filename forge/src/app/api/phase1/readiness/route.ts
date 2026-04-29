import { computeReadinessSnapshotFromEvents, createPhase1Repository } from '@/lib/phase1';
import type { Phase1Event, Phase1ReadinessSnapshot } from '@/lib/phase1/storage';
import {
  badRequest,
  mapRouteError,
  parseJsonObject,
  parseString,
  resolveOrganizationContext,
  success,
} from '../_shared';

interface ReadinessData {
  snapshot: Phase1ReadinessSnapshot;
  totals: {
    eventCount: number;
    sessionCount: number;
    pageCount: number;
    eventTypeCount: number;
  };
}

async function buildReadinessResponse(siteId: string, organizationId: string) {
  const repository = createPhase1Repository();
  const events = (await repository.listEvents({
    organizationId,
    siteId,
    limit: 2000,
  })) as Phase1Event[];

  const snapshot = computeReadinessSnapshotFromEvents(siteId, events);
  await repository.createReadinessSnapshot({
    id: snapshot.id,
    organizationId,
    siteId,
    score: snapshot.score,
    status: snapshot.status,
    reasons: snapshot.reasons,
    eventCount: snapshot.eventCount,
    sessionCount: snapshot.sessionCount,
    generatedAt: snapshot.generatedAt,
  });

  const totals = {
    eventCount: events.length,
    sessionCount: new Set(events.map((event) => event.sessionId)).size,
    pageCount: new Set(events.map((event) => event.path)).size,
    eventTypeCount: new Set(events.map((event) => event.type)).size,
  };

  const payload: ReadinessData = { snapshot, totals };
  return success(payload);
}

function parseSiteIdFromQuery(request: Request): string | null {
  return parseString(new URL(request.url).searchParams.get('siteId'));
}

async function parseSiteIdFromBody(
  request: Request
): Promise<{ siteId: string; organizationId?: string } | { error: Response }> {
  const parsedBody = await parseJsonObject(request);
  if (!parsedBody.ok) {
    return { error: badRequest(parsedBody.message) };
  }

  const siteId = parseString(parsedBody.value.siteId);
  if (!siteId) {
    return { error: badRequest('`siteId` is required in JSON body.') };
  }

  return {
    siteId,
    organizationId: parseString(parsedBody.value.organizationId) ?? undefined,
  };
}

export async function GET(request: Request) {
  try {
    const siteId = parseSiteIdFromQuery(request);
    if (!siteId) {
      return badRequest('`siteId` query param is required.');
    }
    const orgContext = resolveOrganizationContext(request, { allowQueryFallback: true });
    if (!orgContext.ok) {
      return orgContext.response;
    }
    return await buildReadinessResponse(siteId, orgContext.organizationId);
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsedSiteId = await parseSiteIdFromBody(request);
    if ('error' in parsedSiteId) {
      return parsedSiteId.error;
    }

    const orgContext = resolveOrganizationContext(request, {
      bodyOrganizationId: parsedSiteId.organizationId,
      allowQueryFallback: false,
    });
    if (!orgContext.ok) {
      return orgContext.response;
    }

    return await buildReadinessResponse(parsedSiteId.siteId, orgContext.organizationId);
  } catch (error) {
    return mapRouteError(error);
  }
}
