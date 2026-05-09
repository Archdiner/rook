/**
 * Nightly capture refresh cron — runs at 02:00 UTC (configured in vercel.json).
 *
 * For each site that has a phase2 config:
 *   1. Fetch the most recent page snapshots to get the set of known URLs.
 *   2. Skip paths that have a capture fresher than 23 hours (already warm).
 *   3. Re-capture stale paths up to MAX_PATHS_PER_SITE, respecting budget.
 *
 * This keeps the headless artifact corpus fresh so audit rules always have
 * real measurements to work with, without burning budget on pages that were
 * recently captured on-demand.
 */

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db/client';
import { phase2SiteConfigs } from '@/lib/db/schema';
import { unauthorized, mapRouteError } from '@/app/api/phase1/_shared';
import { createPhase1Repository } from '@/lib/phase1';
import { capturePageAllBreakpoints, checkBudget, isCaptureV2Enabled, recordCaptureSpend } from '@/lib/phase2/capture';
import { createCaptureRepository } from '@/lib/phase2/capture/repository';
import { logger, cronitorPing } from '@/lib/observability';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_PATHS_PER_SITE = 10;
const STALE_HOURS = 23;
const MONITOR_KEY = 'refresh-captures';

function assertCronAuth(request: Request): NextResponse | null {
  const secret = process.env.FORGE_CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { success: false, error: { code: 'CRON_DISABLED', message: 'Set FORGE_CRON_SECRET to enable cron.' } },
      { status: 503 },
    );
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return unauthorized('Invalid cron authorization.', 'CRON_UNAUTHORIZED');
  }
  return null;
}

async function refreshSite(
  siteId: string,
  organizationId: string,
  siteUrl: string,
): Promise<{ captured: number; skipped: number; costUsd: number }> {
  const repository = createPhase1Repository();
  const captureRepo = createCaptureRepository();

  // Determine the set of known paths from page snapshots
  const snapshots = await repository.listPageSnapshots({ organizationId, siteId, limit: MAX_PATHS_PER_SITE });
  if (snapshots.length === 0) return { captured: 0, skipped: 0, costUsd: 0 };

  // Load recent captures to know what's already warm
  const recentCaptures = await captureRepo.listRecentPageCaptures({
    organizationId,
    siteId,
    sinceHours: STALE_HOURS,
    limit: 200,
  });
  const warmPaths = new Set(recentCaptures.map(c => c.pathRef));

  const stalePaths = snapshots
    .filter(s => !warmPaths.has(s.pathRef))
    .slice(0, MAX_PATHS_PER_SITE);

  if (stalePaths.length === 0) return { captured: 0, skipped: snapshots.length, costUsd: 0 };

  const budget = await checkBudget(siteId);
  if (budget.isExceeded) {
    logger.warn('capture.refresh.budget_exceeded', { service: 'capture-cron', siteId });
    return { captured: 0, skipped: stalePaths.length, costUsd: 0 };
  }

  const runId = randomUUID();
  const runStartedAt = new Date();

  await captureRepo.upsertCaptureRun({
    id: runId,
    organizationId,
    siteId,
    status: 'running',
    totalPaths: stalePaths.length,
    startedAt: runStartedAt,
  });

  let captured = 0;
  let totalCost = 0;

  for (const snapshot of stalePaths) {
    const currentBudget = await checkBudget(siteId);
    if (currentBudget.isExceeded) break;

    try {
      const url = siteUrl.replace(/\/$/, '') + snapshot.pathRef;
      const summary = await capturePageAllBreakpoints({
        siteId,
        organizationId,
        url,
        pathRef: snapshot.pathRef,
        runId,
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
      if (summary.captures.length > 0) captured++;
    } catch (err) {
      logger.warn('capture.refresh.path_failed', {
        service: 'capture-cron',
        siteId,
        pathRef: snapshot.pathRef,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const finalStatus: 'completed' | 'partial' | 'failed' =
    captured === 0 ? 'failed' : captured < stalePaths.length ? 'partial' : 'completed';
  await captureRepo.upsertCaptureRun({
    id: runId,
    organizationId,
    siteId,
    status: finalStatus,
    totalPaths: stalePaths.length,
    completedPaths: captured,
    failedPaths: stalePaths.length - captured,
    totalCostUsd: totalCost,
    startedAt: runStartedAt,
    completedAt: new Date(),
  });

  return { captured, skipped: snapshots.length - stalePaths.length, costUsd: totalCost };
}

async function runHandler(request: Request) {
  await cronitorPing(MONITOR_KEY, 'run');
  logger.info('capture.refresh.started', { service: 'capture-cron' });

  try {
    const authErr = assertCronAuth(request);
    if (authErr) {
      await cronitorPing(MONITOR_KEY, 'fail', 'auth failed');
      return authErr;
    }

    const flagEnabled = await isCaptureV2Enabled();
    if (!flagEnabled) {
      await cronitorPing(MONITOR_KEY, 'complete', 'feature disabled');
      return NextResponse.json({ success: true, data: { skipped: true, reason: 'capture_v2_enabled flag is off' } });
    }

    // Load all sites that have a phase2 config (any site with a config is eligible)
    const db = getDb();
    const configs = await db.select({
      siteId: phase2SiteConfigs.siteId,
      organizationId: phase2SiteConfigs.organizationId,
    }).from(phase2SiteConfigs);

    if (configs.length === 0) {
      await cronitorPing(MONITOR_KEY, 'complete', 'no sites');
      return NextResponse.json({ success: true, data: { sites: 0 } });
    }

    // Resolve base URL for each site from their integrations
    const repository = createPhase1Repository();

    type SiteResult = {
      siteId: string;
      captured: number;
      skipped: number;
      costUsd: number;
      error?: string;
    };

    const results: SiteResult[] = [];

    for (const cfg of configs) {
      // Use the site's PostHog integration to infer the base URL, or fall back
      // to an env override. Sites without a resolvable URL are skipped.
      const integrations = await repository.listIntegrations({
        organizationId: cfg.organizationId,
        siteId: cfg.siteId,
      });

      const siteUrlRaw =
        (integrations[0]?.config?.['siteUrl'] as string | undefined) ??
        process.env.CAPTURE_SITE_URL_OVERRIDE;

      if (!siteUrlRaw) {
        results.push({ siteId: cfg.siteId, captured: 0, skipped: 0, costUsd: 0, error: 'no_site_url' });
        continue;
      }

      try {
        const outcome = await refreshSite(cfg.siteId, cfg.organizationId, siteUrlRaw);
        results.push({ siteId: cfg.siteId, ...outcome });
      } catch (err) {
        results.push({
          siteId: cfg.siteId,
          captured: 0,
          skipped: 0,
          costUsd: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const totalCaptured = results.reduce((s, r) => s + r.captured, 0);
    logger.info('capture.refresh.done', { service: 'capture-cron', sites: configs.length, totalCaptured });
    await cronitorPing(MONITOR_KEY, 'complete');

    return NextResponse.json({ success: true, data: { sites: configs.length, results } });
  } catch (error) {
    await cronitorPing(MONITOR_KEY, 'fail', error instanceof Error ? error.message : 'unknown');
    return mapRouteError(error);
  }
}

export const GET = runHandler;
export const POST = runHandler;
