/**
 * GA4 sync adapter.
 *
 * Entry point called by the sync cron once GA4 is configured for a site.
 * Same contract as the PostHog adapter: returns canonical events + updated cursor;
 * never writes to storage directly.
 *
 * TODO (Zybit-110): implement after client.ts auth is done.
 */

import type { CanonicalEventInput } from '@/lib/phase2/types';
import type { ConnectorContext } from '../types';
import { GA4ConnectorError } from './errors';
import type { GA4ConnectorConfig, GA4Cursor } from './types';

interface GA4SyncResult {
  events: CanonicalEventInput[];
  cursor: GA4Cursor;
  errorCode?: string;
  errorMessage?: string;
}

const DEFAULT_CURSOR: GA4Cursor = {
  afterTimestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
};

export async function syncGA4(ctx: ConnectorContext): Promise<GA4SyncResult> {
  const config = ctx.integration.config as unknown as GA4ConnectorConfig;
  if (!config.propertyId) {
    return {
      events: [],
      cursor: (ctx.integration.cursor as GA4Cursor | null) ?? DEFAULT_CURSOR,
      errorCode: 'CONFIG_MISSING',
      errorMessage: 'GA4 propertyId is required in integration config.',
    };
  }

  const saKeyEnv = ctx.integration.secretRef ?? 'GOOGLE_SA_KEY';
  const serviceAccountKeyJson = process.env[saKeyEnv];
  if (!serviceAccountKeyJson) {
    return {
      events: [],
      cursor: (ctx.integration.cursor as GA4Cursor | null) ?? DEFAULT_CURSOR,
      errorCode: 'SECRET_MISSING',
      errorMessage: `Environment variable ${saKeyEnv} is not set.`,
    };
  }

  try {
    // TODO (Zybit-110): uncomment once client.ts is implemented.
    //
    // const { getAccessToken, fetchGA4EventsPage } = await import('./client');
    // const accessToken = await getAccessToken(serviceAccountKeyJson);
    // const cursor = (ctx.integration.cursor as GA4Cursor | null) ?? DEFAULT_CURSOR;
    //
    // const rows = await fetchGA4EventsPage(config.propertyId, cursor.afterTimestamp, accessToken);
    //
    // const { mapGA4Events } = await import('./mapping');
    // const events = mapGA4Events(rows, ctx.integration.siteId, ctx.integration.organizationId);
    //
    // const latestTimestamp = rows.reduce(
    //   (max, r) => (r.timestamp > max ? r.timestamp : max),
    //   cursor.afterTimestamp,
    // );
    //
    // return {
    //   events,
    //   cursor: { afterTimestamp: latestTimestamp } satisfies GA4Cursor,
    // };

    void serviceAccountKeyJson; // remove once implemented
    throw new GA4ConnectorError('NOT_IMPLEMENTED', 'GA4 sync not yet implemented. See sync.ts.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err instanceof GA4ConnectorError ? err.code : 'UNKNOWN';
    return {
      events: [],
      cursor: (ctx.integration.cursor as GA4Cursor | null) ?? DEFAULT_CURSOR,
      errorCode: code,
      errorMessage: message,
    };
  }
}

export type { GA4ConnectorConfig, GA4Cursor };
