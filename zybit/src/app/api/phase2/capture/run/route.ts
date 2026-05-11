/**
 * POST /api/phase2/capture/run
 *
 * Synchronously captures a single URL at all breakpoints and persists the
 * results. Returns the generated PageCapture IDs.
 *
 * Requires: insights:run scope.
 * Budget cap enforced per-site before capture starts.
 */

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { badRequest, mapRouteError, parseJsonObject, success } from '@/app/api/phase1/_shared';
import { assertApiKeyHasScope, resolveZybitActor } from '@/lib/auth/actor';
import { assertSiteInOrganization } from '@/lib/auth/tenantScope';
import { createPhase1Repository } from '@/lib/phase1';
import { capturePageAllBreakpoints, checkBudget, isCaptureV2Enabled } from '@/lib/phase2/capture';
import type { CaptureBreakpoint } from '@/lib/phase2/capture';
import { createCaptureRepository } from '@/lib/phase2/capture/repository';
import { logger } from '@/lib/observability';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const flagEnabled = await isCaptureV2Enabled();
    if (!flagEnabled) {
      return NextResponse.json(
        { success: false, error: { code: 'FEATURE_DISABLED', message: 'Headless capture is not enabled.' } },
        { status: 503 },
      );
    }

    const parsed = await parseJsonObject(request);
    if (!parsed.ok) return badRequest(parsed.message);
    const body = parsed.value;

    const siteId = typeof body.siteId === 'string' ? body.siteId.trim() : '';
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!siteId) return badRequest('`siteId` is required.');
    if (!url) return badRequest('`url` is required.');

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return badRequest('`url` must be a valid absolute URL.');
    }
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      return badRequest('`url` must use http or https.');
    }

    const breakpoints = Array.isArray(body.breakpoints)
      ? (body.breakpoints as CaptureBreakpoint[])
      : undefined;

    const actorResult = await resolveZybitActor(request, {
      bodyOrganizationId: body.organizationId,
      allowQueryFallback: false,
    });
    if (!actorResult.ok) return actorResult.response;
    const scopeErr = assertApiKeyHasScope(actorResult.actor, 'insights:run');
    if (scopeErr) return scopeErr;

    const { organizationId } = actorResult.actor;
    const repository = createPhase1Repository();
    const siteGate = await assertSiteInOrganization({ repository, organizationId, siteId });
    if (!siteGate.ok) return siteGate.response;

    const budget = await checkBudget(siteId);
    if (budget.isExceeded) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BUDGET_EXCEEDED',
            message: `Daily capture budget exhausted ($${budget.spentTodayUsd.toFixed(4)} of $${budget.totalBudgetUsd.toFixed(2)}).`,
          },
        },
        { status: 429 },
      );
    }

    const runId = randomUUID();
    const captureRepo = createCaptureRepository();
    const startedAt = new Date();

    await captureRepo.upsertCaptureRun({
      id: runId,
      organizationId,
      siteId,
      status: 'running',
      totalPaths: 1,
      startedAt,
    });

    logger.info('capture.run.start', { service: 'capture-record', siteId, url, runId });

    const pathRef = parsedUrl.pathname || '/';
    const summary = await capturePageAllBreakpoints({
      siteId,
      organizationId,
      url,
      pathRef,
      runId,
      breakpoints,
    });

    // Persist each successful capture
    for (const capture of summary.captures) {
      await captureRepo.insertPageCapture({
        id: randomUUID(),
        organizationId,
        siteId,
        runId,
        pathRef: capture.pathRef,
        capture,
      });
    }

    const finalStatus = summary.failedBreakpoints.length === 0 ? 'completed' : 'partial';
    await captureRepo.upsertCaptureRun({
      id: runId,
      organizationId,
      siteId,
      status: finalStatus,
      totalPaths: 1,
      completedPaths: summary.captures.length > 0 ? 1 : 0,
      failedPaths: summary.failedBreakpoints.length > 0 ? 1 : 0,
      totalCostUsd: summary.totalCostUsd,
      startedAt,
      completedAt: new Date(),
    });

    logger.info('capture.run.done', {
      service: 'capture-record',
      siteId,
      runId,
      captured: summary.captures.length,
      failed: summary.failedBreakpoints.length,
      costUsd: summary.totalCostUsd,
    });

    return success({
      runId,
      captured: summary.captures.length,
      failedBreakpoints: summary.failedBreakpoints,
      totalCostUsd: summary.totalCostUsd,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
