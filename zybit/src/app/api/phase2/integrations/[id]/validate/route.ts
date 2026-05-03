import { NextResponse } from 'next/server';
import { createPhase1Repository } from '@/lib/phase1';
import {
  badRequest,
  mapRouteError,
  success,
} from '@/app/api/phase1/_shared';
import { assertApiKeyHasScope, resolveZybitActor } from '@/lib/auth/actor';
import { assertIntegrationScopedToOrganization } from '@/lib/auth/tenantScope';
import {
  PostHogConnectorError,
  resolvePostHogSecret,
  validatePostHogConnection,
} from '@/lib/phase2/connectors/posthog';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return badRequest('`id` is required.');
    }

    const actorResult = await resolveZybitActor(request, { allowQueryFallback: false });
    if (!actorResult.ok) {
      return actorResult.response;
    }
    const scopeErr = assertApiKeyHasScope(actorResult.actor, 'integrations:manage');
    if (scopeErr) return scopeErr;

    const repository = createPhase1Repository();
    const row = await repository.getIntegrationById(id);
    const scoped = assertIntegrationScopedToOrganization(row, actorResult.actor.organizationId);
    if (!scoped.ok) {
      return scoped.response;
    }
    const integration = scoped.integration;
    if (integration.provider !== 'posthog') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNSUPPORTED_PROVIDER',
            message: `Validate is only implemented for PostHog; got "${integration.provider}".`,
          },
        },
        { status: 501 }
      );
    }

    let secret: string;
    try {
      secret = resolvePostHogSecret(integration.secretRef);
    } catch (error) {
      if (error instanceof PostHogConnectorError) {
        return success({
          ok: false,
          sampleEvents: null,
          recentEventTypes: [],
          warnings: [{ code: error.code, message: error.message }],
        });
      }
      throw error;
    }

    const report = await validatePostHogConnection({
      integration,
      secret,
      since: null,
      until: null,
      maxEvents: 100,
    });

    return success(report);
  } catch (error) {
    if (error instanceof PostHogConnectorError) {
      return NextResponse.json(
        {
          success: false,
          error: { code: error.code, message: error.message },
        },
        { status: error.status ?? 500 }
      );
    }
    return mapRouteError(error);
  }
}
