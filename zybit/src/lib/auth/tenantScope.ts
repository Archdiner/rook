import { NextResponse } from 'next/server';

import type { Phase1Repository } from '@/lib/phase1/repository/types';
import type { IntegrationRecord } from '@/lib/phase2/connectors/types';

export async function assertSiteInOrganization(args: {
  repository: Phase1Repository;
  organizationId: string;
  siteId: string;
}): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const site = await args.repository.getSite({
    organizationId: args.organizationId,
    siteId: args.siteId,
  });
  if (!site) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: {
            code: 'SITE_NOT_IN_ORGANIZATION',
            message: 'The site does not exist or is not in your organization.',
          },
        },
        { status: 404 }
      ),
    };
  }
  return { ok: true };
}

function integrationMissing(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: { code: 'INTEGRATION_NOT_FOUND', message: 'Integration not found.' },
    },
    { status: 404 }
  );
}

export function assertIntegrationScopedToOrganization(
  integration: IntegrationRecord | null,
  organizationId: string
): { ok: true; integration: IntegrationRecord } | { ok: false; response: NextResponse } {
  if (!integration) return { ok: false, response: integrationMissing() };
  if (integration.organizationId !== organizationId) {
    return { ok: false, response: integrationMissing() };
  }
  return { ok: true, integration };
}
