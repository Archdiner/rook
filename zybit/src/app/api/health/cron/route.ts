/**
 * Health check endpoint for uptime monitors.
 *
 * GET /api/health/cron — no auth required.
 * Returns staleness info for all integrations.
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { phase2Integrations } from '@/lib/db/schema';

const STALE_THRESHOLD_HOURS = 2;

export async function GET() {
  try {
    const db = getDb();
    const integrations = await db
      .select({
        id: phase2Integrations.id,
        siteId: phase2Integrations.siteId,
        organizationId: phase2Integrations.organizationId,
        provider: phase2Integrations.provider,
        status: phase2Integrations.status,
        lastSyncedAt: phase2Integrations.lastSyncedAt,
        consecutiveFailures: phase2Integrations.consecutiveFailures,
      })
      .from(phase2Integrations);

    const now = Date.now();
    const thresholdMs = STALE_THRESHOLD_HOURS * 60 * 60 * 1000;

    const enriched = integrations.map((i) => {
      const lastSync = i.lastSyncedAt ? new Date(i.lastSyncedAt).getTime() : 0;
      const stalenessMs = lastSync > 0 ? now - lastSync : null;
      const stalenessHours = stalenessMs !== null ? stalenessMs / (60 * 60 * 1000) : null;
      const isStale =
        stalenessMs === null ? true : stalenessMs > thresholdMs;

      return {
        id: i.id,
        siteId: i.siteId,
        organizationId: i.organizationId,
        provider: i.provider,
        status: i.status,
        lastSyncedAt: i.lastSyncedAt,
        consecutiveFailures: i.consecutiveFailures,
        stalenessHours: stalenessHours !== null ? Math.round(stalenessHours * 100) / 100 : null,
        isStale,
      };
    });

    const staleCount = enriched.filter((i) => i.isStale).length;
    const hasDisconnected = enriched.some((i) => i.status === 'disconnected');
    const overallStatus =
      hasDisconnected || staleCount > 0 ? 'degraded' : 'healthy';

    return NextResponse.json({
      status: overallStatus,
      integrations: enriched,
      staleCount,
      total: enriched.length,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
