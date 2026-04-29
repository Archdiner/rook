import { createPhase1Repository } from '@/lib/phase1';
import {
  badRequest,
  mapRouteError,
  parseJsonObject,
  resolveOrganizationContext,
  success,
} from '@/app/api/phase1/_shared';
import {
  badConfigRequest,
  buildSiteConfig,
  parsePhase2SiteConfigBody,
} from '../../../_shared';

interface RouteContext {
  params: Promise<{ siteId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { siteId } = await context.params;
    if (!siteId) {
      return badRequest('`siteId` is required.');
    }

    const orgContext = resolveOrganizationContext(request, { allowQueryFallback: true });
    if (!orgContext.ok) {
      return orgContext.response;
    }

    const repository = createPhase1Repository();
    const config = await repository.getPhase2SiteConfig({
      organizationId: orgContext.organizationId,
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

    const orgContext = resolveOrganizationContext(request, {
      bodyOrganizationId: parsed.value.organizationId,
      allowQueryFallback: false,
    });
    if (!orgContext.ok) {
      return orgContext.response;
    }

    const parsedBody = parsePhase2SiteConfigBody(parsed.value);
    if (!parsedBody.ok) {
      return badConfigRequest(parsedBody.message);
    }

    const repository = createPhase1Repository();
    const config = await repository.upsertPhase2SiteConfig(
      buildSiteConfig({
        siteId,
        organizationId: orgContext.organizationId,
        body: parsedBody.value,
      })
    );

    return success({ siteId, config });
  } catch (error) {
    return mapRouteError(error);
  }
}
