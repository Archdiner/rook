/**
 * GET /api/phase2/capture/status/[runId]
 *
 * Returns the current status of a capture run.
 * Requires: insights:run scope (same key that started the run).
 */

import { mapRouteError, success } from '@/app/api/phase1/_shared';
import { assertApiKeyHasScope, resolveZybitActor } from '@/lib/auth/actor';
import { assertSiteInOrganization } from '@/lib/auth/tenantScope';
import { createPhase1Repository } from '@/lib/phase1';
import { createCaptureRepository } from '@/lib/phase2/capture/repository';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await params;
    if (!runId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: '`runId` is required.' } },
        { status: 400 },
      );
    }

    const actorResult = await resolveZybitActor(request, {
      bodyOrganizationId: undefined,
      allowQueryFallback: true,
    });
    if (!actorResult.ok) return actorResult.response;
    const scopeErr = assertApiKeyHasScope(actorResult.actor, 'insights:run');
    if (scopeErr) return scopeErr;

    const captureRepo = createCaptureRepository();
    const run = await captureRepo.getCaptureRun(runId);

    if (!run) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Run not found.' } },
        { status: 404 },
      );
    }

    // Verify the run belongs to the actor's organization
    if (run.organizationId !== actorResult.actor.organizationId) {
      const repository = createPhase1Repository();
      const siteGate = await assertSiteInOrganization({
        repository,
        organizationId: actorResult.actor.organizationId,
        siteId: run.siteId,
      });
      if (!siteGate.ok) return siteGate.response;
    }

    return success(run);
  } catch (error) {
    return mapRouteError(error);
  }
}
