/**
 * Stale sync alert endpoint — called by Vercel Cron every 30 minutes.
 *
 * GET /api/health/alert — no auth (invoked by Vercel scheduler).
 * Checks for integrations whose last sync is > 2 hours ago and sends
 * an alert email via Resend for each.
 */

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getDb } from '@/lib/db/client';
import { phase2Integrations } from '@/lib/db/schema';
import { logger } from '@/lib/observability/logger';

const STALE_THRESHOLD_HOURS = 2;

export async function GET() {
  const service = 'health-alert' as const;

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
      })
      .from(phase2Integrations);

    const now = Date.now();
    const thresholdMs = STALE_THRESHOLD_HOURS * 60 * 60 * 1000;

    const stale = integrations.filter((i) => {
      if (!i.lastSyncedAt) return true;
      return now - new Date(i.lastSyncedAt).getTime() > thresholdMs;
    });

    if (stale.length === 0) {
      logger.info('No stale integrations found', { service });
      return NextResponse.json({ alerted: 0 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const alertTo = process.env.ALERT_EMAIL_TO;

    if (!apiKey || !alertTo) {
      logger.warn('RESEND_API_KEY or ALERT_EMAIL_TO not set — skipping stale alerts', {
        service,
        staleCount: stale.length,
      });
      return NextResponse.json({ alerted: 0, skipped: stale.length, reason: 'missing_env' });
    }

    const resend = new Resend(apiKey);
    let alerted = 0;

    for (const integration of stale) {
      try {
        const hoursStale = integration.lastSyncedAt
          ? Math.round((now - new Date(integration.lastSyncedAt).getTime()) / (60 * 60 * 1000) * 10) / 10
          : null;

        await resend.emails.send({
          from: 'Zybit Alerts <onboarding@resend.dev>',
          to: alertTo,
          subject: `[Zybit] Stale sync: ${integration.provider} (${integration.siteId})`,
          text: [
            `Integration ${integration.id} (${integration.provider}) for site ${integration.siteId} has not synced in ${hoursStale !== null ? `${hoursStale} hours` : 'unknown time'}.`,
            '',
            `Organization: ${integration.organizationId}`,
            `Site: ${integration.siteId}`,
            `Provider: ${integration.provider}`,
            `Status: ${integration.status}`,
            `Last synced: ${integration.lastSyncedAt?.toISOString() ?? 'never'}`,
            '',
            'Check the integration and provider status.',
          ].join('\n'),
        });

        alerted++;
      } catch (err) {
        logger.error('Failed to send stale alert email', {
          service,
          integrationId: integration.id,
          siteId: integration.siteId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('Stale sync alert run complete', { service, alerted, total: stale.length });
    return NextResponse.json({ alerted, total: stale.length });
  } catch (error) {
    logger.error('Health alert route failed', {
      service,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
