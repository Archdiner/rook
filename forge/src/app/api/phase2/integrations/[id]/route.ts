import { createPhase1Repository } from '@/lib/phase1';
import {
  badRequest,
  mapRouteError,
  resolveOrganizationContext,
  success,
} from '@/app/api/phase1/_shared';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return badRequest('`id` is required.');
    }

    const orgContext = resolveOrganizationContext(request, { allowQueryFallback: true });
    if (!orgContext.ok) {
      return orgContext.response;
    }

    const repository = createPhase1Repository();
    const integration = await repository.getIntegration({
      organizationId: orgContext.organizationId,
      id,
    });
    if (!integration) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTEGRATION_NOT_FOUND', message: 'Integration not found.' },
        },
        { status: 404 }
      );
    }

    return success(integration);
  } catch (error) {
    return mapRouteError(error);
  }
}
