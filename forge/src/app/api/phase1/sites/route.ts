import { randomUUID } from 'crypto';
import { createPhase1Repository } from '@/lib/phase1';
import {
  badRequest,
  mapRouteError,
  parseJsonObject,
  parseOptionalString,
  parsePositiveInt,
  resolveOrganizationContext,
  parseString,
  success,
} from '../_shared';

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonObject(request);
    if (!parsed.ok) {
      return badRequest(parsed.message);
    }
    const body = parsed.value;

    const name = parseString(body.name);
    if (!name) {
      return badRequest('`name` is required and must be a non-empty string.');
    }

    const domain = parseString(body.domain);
    if (!domain) {
      return badRequest('`domain` is required and must be a non-empty string.');
    }

    const analyticsProvider = parseOptionalString(body.analyticsProvider);
    const orgContext = resolveOrganizationContext(request, {
      bodyOrganizationId: body.organizationId,
      allowQueryFallback: false,
    });
    if (!orgContext.ok) {
      return orgContext.response;
    }

    const repository = createPhase1Repository();
    const site = {
      id: randomUUID(),
      organizationId: orgContext.organizationId,
      name,
      domain: domain.toLowerCase(),
      createdAt: new Date().toISOString(),
      ...(analyticsProvider ? { analyticsProvider } : {}),
    };

    const created = await repository.createSite(site);
    return success(created, 201);
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function GET(request: Request) {
  try {
    const repository = createPhase1Repository();
    const url = new URL(request.url);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 50, 200);
    const orgContext = resolveOrganizationContext(request, { allowQueryFallback: true });
    if (!orgContext.ok) {
      return orgContext.response;
    }
    const sites = await repository.listSites({ organizationId: orgContext.organizationId, limit });
    return success(sites);
  } catch (error) {
    return mapRouteError(error);
  }
}
