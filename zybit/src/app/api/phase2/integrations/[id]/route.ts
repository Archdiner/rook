import { createPhase1Repository } from '@/lib/phase1';
import {
  badRequest,
  mapRouteError,
  success,
} from '@/app/api/phase1/_shared';
import { assertApiKeyHasAnyScope, resolveZybitActor } from '@/lib/auth/actor';
import { assertIntegrationScopedToOrganization } from '@/lib/auth/tenantScope';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return badRequest('`id` is required.');
    }

    const actorResult = await resolveZybitActor(request, { allowQueryFallback: true });
    if (!actorResult.ok) {
      return actorResult.response;
    }
    const scopeErr = assertApiKeyHasAnyScope(actorResult.actor, [
      'integrations:manage',
      'insights:run',
    ]);
    if (scopeErr) return scopeErr;

    const repository = createPhase1Repository();
    const row = await repository.getIntegrationById(id);
    const scoped = assertIntegrationScopedToOrganization(row, actorResult.actor.organizationId);
    if (!scoped.ok) {
      return scoped.response;
    }

    return success(scoped.integration);
  } catch (error) {
    return mapRouteError(error);
  }
}
