/**
 * FORGE-064 — Baseline progress status
 *
 * GET /api/dashboard/status?siteId=...
 *
 * Returns a lightweight snapshot of the data pipeline state for a site:
 *   - integration health (last sync, errors)
 *   - event count in the last 7 days
 *   - gate readiness (trustworthy + blocking warnings)
 *   - open finding count (from forge_findings)
 *   - next cron estimate
 *
 * This is designed for the cockpit's "baseline learning" widget — cheap enough
 * to call on every page load without running the full insights pipeline.
 */

import { count, eq } from 'drizzle-orm';
import { badRequest, mapRouteError, parseString, success } from '@/app/api/phase1/_shared';
import { resolveForgeActor } from '@/lib/auth/forgeActor';
import { assertSiteInOrganization } from '@/lib/auth/tenantScope';
import { getDb } from '@/lib/db/client';
import { forgeFindings } from '@/lib/db/schema';
import { createPhase1Repository } from '@/lib/phase1';
import { buildInsightInputFromEvents, runInsightInputGate } from '@/lib/phase2';
import type { RollupContext } from '@/lib/phase2/types';

export async function GET(request: Request) {
  try {
    const actorResult = await resolveForgeActor(request, { allowQueryFallback: true });
    if (!actorResult.ok) return actorResult.response;

    const url = new URL(request.url);
    const siteId = parseString(url.searchParams.get('siteId'));
    if (!siteId) return badRequest('`siteId` query param is required.');

    const repository = createPhase1Repository();
    const siteGate = await assertSiteInOrganization({
      repository,
      organizationId: actorResult.actor.organizationId,
      siteId,
    });
    if (!siteGate.ok) return siteGate.response;

    const now = Date.now();
    const window7d = {
      start: new Date(now - 7 * 86_400_000).toISOString(),
      end: new Date(now).toISOString(),
    };

    // Parallel fetches — all lightweight
    const [integrations, events, config, findingCountRows] = await Promise.all([
      repository.listIntegrations({
        organizationId: actorResult.actor.organizationId,
        siteId,
      }),
      repository.listEventsInWindow({
        organizationId: actorResult.actor.organizationId,
        siteId,
        window: window7d,
      }),
      repository.getPhase2SiteConfig({
        organizationId: actorResult.actor.organizationId,
        siteId,
      }),
      // Count open findings without pulling full rows
      getDb()
        .select({ count: count() })
        .from(forgeFindings)
        .where(eq(forgeFindings.siteId, siteId)),
    ]);

    // Run just the gate (no audit rules — no expensive AI calls)
    const resolvedConfig = config ?? {
      siteId,
      organizationId: actorResult.actor.organizationId,
      cohortDimensions: [],
      onboardingSteps: [],
      ctas: [],
      narratives: [],
      updatedAt: new Date(0).toISOString(),
    };

    const ctx: RollupContext = {
      siteId,
      window: window7d,
      config: resolvedConfig,
      events,
    };
    const rollup = buildInsightInputFromEvents(ctx, new Date().toISOString());
    const gate = runInsightInputGate({ rollup, config: resolvedConfig, window: window7d });

    // Summarise integrations
    const integrationSummary = integrations.map((i) => ({
      id: i.id,
      provider: i.provider,
      status: i.status,
      lastSyncedAt: i.lastSyncedAt ?? null,
      lastErrorCode: i.lastErrorCode ?? null,
    }));

    const lastSync = integrations
      .map((i) => i.lastSyncedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

    const openFindings = Number((findingCountRows[0] as { count: number } | undefined)?.count ?? 0);

    return success({
      siteId,
      pipeline: {
        eventCount7d: events.length,
        sessionCount7d: rollup.insightInput.totals.sessions,
        lastSync,
        integrations: integrationSummary,
        healthy: integrations.length > 0 && integrations.every((i) => !i.lastErrorCode),
      },
      gate: {
        trustworthy: gate.ok,
        blockCount: gate.warnings.filter((w) => w.level === 'block').length,
        warnCount: gate.warnings.filter((w) => w.level === 'warn').length,
        warnings: gate.warnings.map((w) => ({
          code: w.code,
          level: w.level,
          message: w.message,
        })),
      },
      openFindings,
      // Human-readable progress toward "trustworthy" gate
      readinessPercent: gate.ok
        ? 100
        : Math.min(
            99,
            Math.round(
              (events.length /
                Math.max(events.length, 200)) * // rough proxy: 200 events ≈ sufficient
                100
            )
          ),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
