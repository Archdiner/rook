/**
 * POST /api/phase2/capture/batch
 *
 * Captures multiple URLs synchronously and returns results when complete.
 * The function awaits all captures within the 300s maxDuration window
 * (≤20 paths × ~15s worst-case = ~300s max). A runId is created upfront
 * so callers can also look up run status after the fact via
 * GET /api/phase2/capture/status/[runId].
 *
 * Requires: insights:run scope.
 * Budget cap enforced before each individual capture.
 * Max 20 paths per batch call.
 */

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { badRequest, mapRouteError, parseJsonObject, success } from '@/app/api/phase1/_shared';
import { assertApiKeyHasScope, resolveZybitActor } from '@/lib/auth/actor';
import { assertSiteInOrganization } from '@/lib/auth/tenantScope';
import { createPhase1Repository } from '@/lib/phase1';
import { capturePageAllBreakpoints, checkBudget, isCaptureV2Enabled, recordCaptureSpend } from '@/lib/phase2/capture';
import type { CaptureBreakpoint } from '@/lib/phase2/capture';
import { createCaptureRepository } from '@/lib/phase2/capture/repository';
import { logger } from '@/lib/observability';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_PATHS = 20;

interface BatchEntry {
  url: string;
  pathRef: string;
}

interface BatchResult {
  completed: number;
  failed: number;
  totalCostUsd: number;
}

function parseEntries(raw: unknown): BatchEntry[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const entries: BatchEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const r = item as Record<string, unknown>;
    const url = typeof r.url === 'string' ? r.url.trim() : '';
    const pathRef = typeof r.pathRef === 'string' ? r.pathRef.trim() : '';
    if (!url || !pathRef) return null;
    try { new URL(url); } catch { return null; }
    entries.push({ url, pathRef });
  }
  return entries;
}

async function runBatch(
  runId: string,
  organizationId: string,
  siteId: string,
  entries: BatchEntry[],
  breakpoints: CaptureBreakpoint[] | undefined,
): Promise<BatchResult> {
  const captureRepo = createCaptureRepository();
  const batchStartedAt = new Date();
  let completed = 0;
  let failed = 0;
  let totalCost = 0;

  for (const entry of entries) {
    const budget = await checkBudget(siteId);
    if (budget.isExceeded) {
      failed += entries.length - completed - failed;
      logger.warn('capture.batch.budget_exceeded', { service: 'capture-record', siteId, runId });
      break;
    }

    try {
      const summary = await capturePageAllBreakpoints({
        siteId,
        organizationId,
        url: entry.url,
        pathRef: entry.pathRef,
        runId,
        breakpoints,
      });

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

      if (summary.totalCostUsd > 0) {
        await recordCaptureSpend(siteId, organizationId, summary.totalCostUsd);
      }

      totalCost += summary.totalCostUsd;
      if (summary.captures.length > 0) {
        completed++;
      } else {
        failed++;
      }
    } catch (err) {
      failed++;
      logger.warn('capture.batch.path_failed', {
        service: 'capture-record',
        siteId,
        runId,
        url: entry.url,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await captureRepo.upsertCaptureRun({
      id: runId,
      organizationId,
      siteId,
      status: 'running',
      totalPaths: entries.length,
      completedPaths: completed,
      failedPaths: failed,
      totalCostUsd: totalCost,
      startedAt: batchStartedAt,
    });
  }

  const finalStatus: 'completed' | 'partial' | 'failed' =
    failed === 0 ? 'completed' : completed === 0 ? 'failed' : 'partial';
  await captureRepo.upsertCaptureRun({
    id: runId,
    organizationId,
    siteId,
    status: finalStatus,
    totalPaths: entries.length,
    completedPaths: completed,
    failedPaths: failed,
    totalCostUsd: totalCost,
    startedAt: batchStartedAt,
    completedAt: new Date(),
  });

  logger.info('capture.batch.done', {
    service: 'capture-record',
    siteId,
    runId,
    completed,
    failed,
    totalCostUsd: totalCost,
  });

  return { completed, failed, totalCostUsd: totalCost };
}

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
    if (!siteId) return badRequest('`siteId` is required.');

    const entries = parseEntries(body.entries);
    if (!entries) return badRequest('`entries` must be a non-empty array of {url, pathRef}.');
    if (entries.length > MAX_PATHS) return badRequest(`Maximum ${MAX_PATHS} paths per batch.`);

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

    await captureRepo.upsertCaptureRun({
      id: runId,
      organizationId,
      siteId,
      status: 'running',
      totalPaths: entries.length,
      startedAt: new Date(),
    });

    logger.info('capture.batch.start', {
      service: 'capture-record',
      siteId,
      runId,
      paths: entries.length,
    });

    const result = await runBatch(runId, organizationId, siteId, entries, breakpoints);

    return success({ runId, ...result });
  } catch (error) {
    return mapRouteError(error);
  }
}
