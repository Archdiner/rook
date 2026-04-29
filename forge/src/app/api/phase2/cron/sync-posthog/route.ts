import { NextResponse } from 'next/server';
import { createPhase1Repository } from '@/lib/phase1';
import { mapRouteError, unauthorized } from '@/app/api/phase1/_shared';
import { runPostHogPullSyncJob } from '@/lib/phase2/jobs/runPostHogPullSyncJob';

export const runtime = 'nodejs';

function assertCronAuth(request: Request): NextResponse | null {
  const secret = process.env.FORGE_CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CRON_DISABLED',
          message: 'Set FORGE_CRON_SECRET to enable scheduled PostHog sync.',
        },
      },
      { status: 503 }
    );
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return unauthorized('Invalid cron authorization.', 'CRON_UNAUTHORIZED');
  }
  return null;
}

async function runHandler(request: Request) {
  try {
    const authErr = assertCronAuth(request);
    if (authErr) return authErr;

    const repository = createPhase1Repository();
    if (repository.driver !== 'postgres') {
      return NextResponse.json({
        success: true,
        data: { skipped: true, reason: 'Postgres driver required for scheduled multi-tenant sync.' },
      });
    }

    const integrations = await repository.listIntegrationsByProvider({
      provider: 'posthog',
      limit: 50,
    });

    const results: Array<{
      id: string;
      organizationId: string;
      ok: boolean;
      code?: string;
      message?: string;
      inserted?: number;
    }> = [];

    for (const integration of integrations) {
      const outcome = await runPostHogPullSyncJob({
        repository,
        integration,
        maxEvents: 5000,
      });
      if (outcome.ok) {
        results.push({
          id: integration.id,
          organizationId: integration.organizationId,
          ok: true,
          inserted: outcome.report.inserted,
        });
      } else {
        results.push({
          id: integration.id,
          organizationId: integration.organizationId,
          ok: false,
          code: outcome.code,
          message: outcome.message,
        });
      }
    }

    return NextResponse.json({ success: true, data: { synced: results.length, results } });
  } catch (error) {
    return mapRouteError(error);
  }
}

export const GET = runHandler;
export const POST = runHandler;
