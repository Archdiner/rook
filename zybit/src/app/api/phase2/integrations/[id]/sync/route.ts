import { NextResponse } from 'next/server';
import { createPhase1Repository } from '@/lib/phase1';
import {
  badRequest,
  mapRouteError,
  parseJsonObject,
  parseString,
  success,
} from '@/app/api/phase1/_shared';
import { assertApiKeyHasScope, resolveZybitActor } from '@/lib/auth/actor';
import { assertIntegrationScopedToOrganization } from '@/lib/auth/tenantScope';
import { runPostHogPullSyncJob } from '@/lib/phase2/jobs/runPostHogPullSyncJob';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return badRequest('`id` is required.');
    }

    const parsed = await parseJsonObject(request).catch(() => null);
    const body = parsed && parsed.ok ? parsed.value : {};

    const actorResult = await resolveZybitActor(request, {
      bodyOrganizationId: body.organizationId,
      allowQueryFallback: false,
    });
    if (!actorResult.ok) {
      return actorResult.response;
    }
    const scopeErr = assertApiKeyHasScope(actorResult.actor, 'integrations:manage');
    if (scopeErr) return scopeErr;

    const since = parseString(body.since ?? null);
    const until = parseString(body.until ?? null);
    const maxEventsRaw = body.maxEvents;
    const maxEvents =
      typeof maxEventsRaw === 'number' && Number.isInteger(maxEventsRaw) && maxEventsRaw > 0
        ? Math.min(maxEventsRaw, 25000)
        : undefined;

    const repository = createPhase1Repository();
    const integrationRow = await repository.getIntegration({
      organizationId: actorResult.actor.organizationId,
      id,
    });
    const scoped = assertIntegrationScopedToOrganization(
      integrationRow,
      actorResult.actor.organizationId
    );
    if (!scoped.ok) {
      return scoped.response;
    }

    const outcome = await runPostHogPullSyncJob({
      repository,
      integration: scoped.integration,
      since,
      until,
      maxEvents,
    });

    if (!outcome.ok) {
      return NextResponse.json(
        { success: false, error: { code: outcome.code, message: outcome.message } },
        { status: outcome.httpStatus }
      );
    }

    return success(outcome.report);
  } catch (error) {
    return mapRouteError(error);
  }
}
