import { createPhase1Repository } from '@/lib/phase1';
import {
  badRequest,
  mapRouteError,
  parseJsonObject,
  success,
} from '@/app/api/phase1/_shared';
import {
  badConfigRequest,
  buildSiteConfig,
  parsePhase2SiteConfigBody,
} from '../../../_shared';
import { assertApiKeyHasAnyScope, assertApiKeyHasScope, resolveForgeActor } from '@/lib/auth/forgeActor';
import { assertSiteInOrganization } from '@/lib/auth/tenantScope';

interface RouteContext {
  params: Promise<{ siteId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { siteId } = await context.params;
    if (!siteId) {
      return badRequest('`siteId` is required.');
    }

    const actorResult = await resolveForgeActor(request, { allowQueryFallback: true });
    if (!actorResult.ok) {
      return actorResult.response;
    }
    const scopeErr = assertApiKeyHasAnyScope(actorResult.actor, [
      'integrations:manage',
      'insights:run',
    ]);
    if (scopeErr) return scopeErr;

    const repository = createPhase1Repository();
    const siteGate = await assertSiteInOrganization({
      repository,
      organizationId: actorResult.actor.organizationId,
      siteId,
    });
    if (!siteGate.ok) return siteGate.response;

    const config = await repository.getPhase2SiteConfig({
      organizationId: actorResult.actor.organizationId,
      siteId,
    });

    if (!config) {
      return success({ siteId, configured: false, config: null });
    }
    return success({ siteId, configured: true, config });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { siteId } = await context.params;
    if (!siteId) {
      return badRequest('`siteId` is required.');
    }

    const parsed = await parseJsonObject(request);
    if (!parsed.ok) {
      return badRequest(parsed.message);
    }

    const actorResult = await resolveForgeActor(request, {
      bodyOrganizationId: parsed.value.organizationId,
      allowQueryFallback: false,
    });
    if (!actorResult.ok) {
      return actorResult.response;
    }
    const scopeErr = assertApiKeyHasScope(actorResult.actor, 'integrations:manage');
    if (scopeErr) return scopeErr;

    const parsedBody = parsePhase2SiteConfigBody(parsed.value);
    if (!parsedBody.ok) {
      return badConfigRequest(parsedBody.message);
    }

    const repository = createPhase1Repository();
    const siteGate = await assertSiteInOrganization({
      repository,
      organizationId: actorResult.actor.organizationId,
      siteId,
    });
    if (!siteGate.ok) return siteGate.response;

    const config = await repository.upsertPhase2SiteConfig(
      buildSiteConfig({
        siteId,
        organizationId: actorResult.actor.organizationId,
        body: parsedBody.value,
      })
    );

    return success({ siteId, config });
  } catch (error) {
    return mapRouteError(error);
  }
}
