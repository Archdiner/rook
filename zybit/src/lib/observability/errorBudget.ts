/**
 * Error budget tracker for integration sync reliability.
 *
 * Tracks consecutive failures per integration and auto-degrades status:
 *   - 0 failures  -> 'active'
 *   - 3 failures  -> 'degraded'
 *   - 5+ failures -> 'disconnected' + alert email via Resend
 */

import { eq, sql } from 'drizzle-orm';
import { Resend } from 'resend';

import { getDb } from '@/lib/db/client';
import { phase2Integrations } from '@/lib/db/schema';
import { logger } from './logger';

const DEGRADED_THRESHOLD = 3;
const DISCONNECTED_THRESHOLD = 5;

export async function trackSyncResult(
  integrationId: string,
  success: boolean,
  errorCode?: string
): Promise<void> {
  const db = getDb();

  if (success) {
    await db
      .update(phase2Integrations)
      .set({
        consecutiveFailures: 0,
        status: 'active',
        lastErrorCode: null,
        updatedAt: new Date(),
      })
      .where(eq(phase2Integrations.id, integrationId));
    return;
  }

  // Failure path — increment counter atomically and read back
  await db
    .update(phase2Integrations)
    .set({
      consecutiveFailures: sql`${phase2Integrations.consecutiveFailures} + 1`,
      lastErrorCode: errorCode ?? null,
      updatedAt: new Date(),
    })
    .where(eq(phase2Integrations.id, integrationId));

  const rows = await db
    .select({
      consecutiveFailures: phase2Integrations.consecutiveFailures,
      siteId: phase2Integrations.siteId,
      organizationId: phase2Integrations.organizationId,
      provider: phase2Integrations.provider,
    })
    .from(phase2Integrations)
    .where(eq(phase2Integrations.id, integrationId))
    .limit(1);

  const row = rows[0];
  if (!row) return;

  const failures = row.consecutiveFailures;

  if (failures >= DISCONNECTED_THRESHOLD) {
    await db
      .update(phase2Integrations)
      .set({ status: 'disconnected', updatedAt: new Date() })
      .where(eq(phase2Integrations.id, integrationId));

    await sendDisconnectedAlert(integrationId, row.provider, row.siteId, row.organizationId, failures);
  } else if (failures >= DEGRADED_THRESHOLD) {
    await db
      .update(phase2Integrations)
      .set({ status: 'degraded', updatedAt: new Date() })
      .where(eq(phase2Integrations.id, integrationId));
  }
}

async function sendDisconnectedAlert(
  integrationId: string,
  provider: string,
  siteId: string,
  organizationId: string,
  failures: number
): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const alertTo = process.env.ALERT_EMAIL_TO;
    if (!apiKey || !alertTo) {
      logger.warn('Skipping disconnect alert — RESEND_API_KEY or ALERT_EMAIL_TO not set', {
        service: 'cron-sync',
        integrationId,
        siteId,
        organizationId,
      });
      return;
    }

    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: 'Zybit Alerts <onboarding@resend.dev>',
      to: alertTo,
      subject: `[Zybit] Integration disconnected: ${provider} (${siteId})`,
      text: [
        `Integration ${integrationId} (${provider}) for site ${siteId} has failed ${failures} consecutive syncs and has been marked disconnected.`,
        '',
        `Organization: ${organizationId}`,
        `Site: ${siteId}`,
        `Provider: ${provider}`,
        `Consecutive failures: ${failures}`,
        '',
        'Check the integration configuration and provider status.',
      ].join('\n'),
    });

    logger.info('Disconnect alert email sent', {
      service: 'cron-sync',
      integrationId,
      siteId,
      organizationId,
    });
  } catch (err) {
    logger.error('Failed to send disconnect alert email', {
      service: 'cron-sync',
      integrationId,
      siteId,
      organizationId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
