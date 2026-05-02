/**
 * FORGE-020 — PostHog pull-sync cron + volume-triggered insights
 *
 * Runs every 30 minutes (configured in vercel.json).
 *
 * For each active PostHog integration:
 *   1. Pull new events from PostHog into phase1_events.
 *   2. Count current distinct sessions for the site.
 *   3. Compare against `forge_site_meta.session_count_at_last_run`.
 *   4. If delta ≥ threshold (default 100 sessions), run the Phase 2
 *      insights pipeline and upsert fresh findings — then update the meta.
 *
 * This means insights refresh automatically when traffic warrants it,
 * not on a fixed schedule. Low-traffic sites are never re-run needlessly;
 * high-traffic sites get fresh insights faster.
 */

import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';
import { createPhase1Repository } from '@/lib/phase1';
import { mapRouteError, unauthorized } from '@/app/api/phase1/_shared';
import { runPostHogPullSyncJob } from '@/lib/phase2/jobs/runPostHogPullSyncJob';
import { runPhase2InsightsPipeline } from '@/lib/phase2';
import { getDb } from '@/lib/db/client';
import { zybitSiteMeta, zybitFindings } from '@/lib/db/schema';
import type { AuditFinding } from '@/lib/phase2/rules/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Deterministic finding PK (mirrors /api/dashboard/findings/route.ts)
// ---------------------------------------------------------------------------

function findingPk(siteId: string, ruleId: string, pathRef: string | null): string {
  const raw = `${siteId}|${ruleId}|${pathRef ?? '__site__'}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 24);
}

// ---------------------------------------------------------------------------
// Count current distinct sessions for a site
// ---------------------------------------------------------------------------

async function countSiteSessions(siteId: string): Promise<number> {
  const db = getDb();
  const result = await db.execute(
    sql`SELECT COUNT(DISTINCT session_id) AS cnt FROM phase1_events WHERE site_id = ${siteId}`
  );
  const rows = result.rows as Array<{ cnt: string | number }>;
  return Number(rows[0]?.cnt ?? 0);
}

// ---------------------------------------------------------------------------
// Upsert fresh findings after insights run
// ---------------------------------------------------------------------------

async function upsertFindings(
  organizationId: string,
  siteId: string,
  auditFindings: AuditFinding[],
  windowStart: number,
  windowEnd: number
): Promise<number> {
  if (auditFindings.length === 0) return 0;
  const db = getDb();
  const now = new Date();

  const values = auditFindings.map((f) => ({
    id: findingPk(siteId, f.ruleId, f.pathRef),
    organizationId,
    siteId,
    ruleId: f.ruleId,
    category: f.category,
    severity: f.severity,
    confidence: f.confidence,
    priorityScore: f.priorityScore,
    pathRef: f.pathRef,
    title: f.title,
    summary: f.summary,
    recommendation: f.recommendation,
    evidence: f.evidence,
    refs: f.refs ?? null,
    status: 'open' as const,
    lastSeenAt: now,
    insightWindowStart: new Date(windowStart),
    insightWindowEnd: new Date(windowEnd),
  }));

  await db
    .insert(zybitFindings)
    .values(values)
    .onConflictDoUpdate({
      target: zybitFindings.id,
      set: {
        severity: sql`excluded.severity`,
        confidence: sql`excluded.confidence`,
        priorityScore: sql`excluded.priority_score`,
        title: sql`excluded.title`,
        summary: sql`excluded.summary`,
        recommendation: sql`excluded.recommendation`,
        evidence: sql`excluded.evidence`,
        refs: sql`excluded.refs`,
        lastSeenAt: sql`excluded.last_seen_at`,
        insightWindowStart: sql`excluded.insight_window_start`,
        insightWindowEnd: sql`excluded.insight_window_end`,
        updatedAt: now,
        // Note: status / preview fields are preserved on conflict
      },
    });

  return auditFindings.length;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

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

    const db = getDb();
    const now = new Date();

    type IntegrationResult = {
      id: string;
      siteId: string;
      organizationId: string;
      syncOk: boolean;
      syncInserted?: number;
      insightsTriggered: boolean;
      insightsSynced?: number;
      sessionDelta?: number;
      code?: string;
      message?: string;
    };

    async function processIntegration(
      integration: (typeof integrations)[number]
    ): Promise<IntegrationResult> {
      const { siteId, organizationId } = integration;

      // ── 1. Pull new events ──────────────────────────────────────────────
      const syncOutcome = await runPostHogPullSyncJob({
        repository,
        integration,
        maxEvents: 5000,
      });

      if (!syncOutcome.ok) {
        return {
          id: integration.id,
          siteId,
          organizationId,
          syncOk: false,
          insightsTriggered: false,
          code: syncOutcome.code,
          message: syncOutcome.message,
        };
      }

      // ── 2. Count current sessions + load site meta in parallel ──────────
      const [currentSessions, metaRows] = await Promise.all([
        countSiteSessions(siteId),
        db.select().from(zybitSiteMeta).where(eq(zybitSiteMeta.siteId, siteId)).limit(1),
      ]);

      const meta = metaRows[0] ?? null;
      const prevSessions = meta?.sessionCountAtLastRun ?? 0;
      const threshold = meta?.insightThreshold ?? 100;
      const sessionDelta = currentSessions - prevSessions;

      const shouldRunInsights = sessionDelta >= threshold;

      let insightsSynced = 0;

      if (shouldRunInsights) {
        // ── 3. Run insights pipeline ─────────────────────────────────────
        const endMs = Date.now();
        const startMs = endMs - 7 * 86_400_000;
        const window = {
          start: new Date(startMs).toISOString(),
          end: new Date(endMs).toISOString(),
        };

        const insightsResult = await runPhase2InsightsPipeline({
          organizationId,
          siteId,
          window,
          maxFindings: 25,
        });

        const auditFindings = (insightsResult.auditReport?.findings ?? []) as AuditFinding[];
        insightsSynced = await upsertFindings(
          organizationId,
          siteId,
          auditFindings,
          startMs,
          endMs
        );

        // ── 4. Update site meta with new session count ───────────────────
        await db
          .insert(zybitSiteMeta)
          .values({
            siteId,
            organizationId,
            sessionCountAtLastRun: currentSessions,
            insightThreshold: threshold,
            lastInsightRunAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: zybitSiteMeta.siteId,
            set: {
              sessionCountAtLastRun: currentSessions,
              lastInsightRunAt: now,
              updatedAt: now,
            },
          });
      } else if (!meta) {
        // First sync for this site — initialise meta without running insights yet
        await db
          .insert(zybitSiteMeta)
          .values({
            siteId,
            organizationId,
            sessionCountAtLastRun: 0,
            insightThreshold: threshold,
            updatedAt: now,
          })
          .onConflictDoNothing();
      }

      return {
        id: integration.id,
        siteId,
        organizationId,
        syncOk: true,
        syncInserted: syncOutcome.report.inserted,
        insightsTriggered: shouldRunInsights,
        insightsSynced,
        sessionDelta,
      };
    }

    // Process integrations in parallel batches of 5 to avoid overwhelming
    // external APIs while staying well within the 300s function timeout.
    const CONCURRENCY = 5;
    const results: IntegrationResult[] = [];
    for (let i = 0; i < integrations.length; i += CONCURRENCY) {
      const chunk = integrations.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(chunk.map(processIntegration));
      for (const outcome of settled) {
        if (outcome.status === 'fulfilled') {
          results.push(outcome.value);
        } else {
          // Unexpected rejection — surface it without aborting the whole run
          results.push({
            id: 'unknown',
            siteId: 'unknown',
            organizationId: 'unknown',
            syncOk: false,
            insightsTriggered: false,
            code: 'INTERNAL_ERROR',
            message: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
          });
        }
      }
    }

    return NextResponse.json({ success: true, data: { synced: results.length, results } });
  } catch (error) {
    return mapRouteError(error);
  }
}

export const GET = runHandler;
export const POST = runHandler;
