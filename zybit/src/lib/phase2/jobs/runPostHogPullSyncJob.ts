import { randomUUID } from 'node:crypto';

import type {
  CreateCanonicalEventInput,
  IntegrationRecord,
  Phase1Repository,
} from '@/lib/phase1/repository';
import {
  PostHogConnectorError,
  resolvePostHogSecret,
  runPostHogSync,
} from '@/lib/phase2/connectors/posthog';
import type { SyncReport } from '@/lib/phase2/connectors/types';
import { CANONICAL_EVENT_SCHEMA_VERSION } from '@/lib/phase2/types';
import type { CanonicalEventInput } from '@/lib/phase2/types';

const DEFAULT_MAX_EVENTS = 5000;

function toCreateInputs(
  events: CanonicalEventInput[],
  organizationId: string
): CreateCanonicalEventInput[] {
  const now = new Date().toISOString();
  return events.map((input) => {
    const createdAt = now;
    const occurredAt = input.occurredAt ?? createdAt;
    const out: CreateCanonicalEventInput = {
      id: randomUUID(),
      organizationId,
      siteId: input.siteId,
      sessionId: input.sessionId,
      type: input.type,
      path: input.path,
      occurredAt,
      createdAt,
      source: input.source ?? 'posthog',
      schemaVersion: CANONICAL_EVENT_SCHEMA_VERSION,
    };
    if (input.metrics) out.metrics = input.metrics;
    if (input.properties) out.properties = input.properties;
    if (input.anonymousId) out.anonymousId = input.anonymousId;
    if (input.sourceEventId) out.sourceEventId = input.sourceEventId;
    return out;
  });
}

async function persistSyncOutcome(args: {
  repository: Phase1Repository;
  integration: IntegrationRecord;
  cursor: Record<string, unknown> | null;
  errorCode: string | null;
}): Promise<IntegrationRecord> {
  const { repository, integration, cursor, errorCode } = args;
  return repository.updateIntegrationState({
    id: integration.id,
    organizationId: integration.organizationId,
    cursor,
    lastSyncedAt: new Date().toISOString(),
    lastErrorCode: errorCode,
    status: errorCode ? 'error' : 'active',
    updatedAt: new Date().toISOString(),
  });
}

export type PostHogPullSyncOutcome =
  | { ok: true; report: SyncReport }
  | { ok: false; httpStatus: number; code: string; message: string };

/**
 * Runs a PostHog pull sync for one integration row. Updates integration cursor / error state.
 */
export async function runPostHogPullSyncJob(args: {
  repository: Phase1Repository;
  integration: IntegrationRecord;
  since?: string | null;
  until?: string | null;
  maxEvents?: number;
}): Promise<PostHogPullSyncOutcome> {
  const { repository, integration } = args;
  const maxEvents =
    typeof args.maxEvents === 'number' && Number.isInteger(args.maxEvents) && args.maxEvents > 0
      ? Math.min(args.maxEvents, 25000)
      : DEFAULT_MAX_EVENTS;

  if (integration.provider !== 'posthog') {
    return {
      ok: false,
      httpStatus: 501,
      code: 'UNSUPPORTED_PROVIDER',
      message: `Sync is only implemented for PostHog; "${integration.provider}" is not supported.`,
    };
  }

  let secret: string;
  try {
    secret = resolvePostHogSecret(integration.secretRef);
  } catch (error) {
    if (error instanceof PostHogConnectorError) {
      await persistSyncOutcome({
        repository,
        integration,
        cursor: integration.cursor,
        errorCode: error.code,
      });
      return { ok: false, httpStatus: 401, code: error.code, message: error.message };
    }
    throw error;
  }

  let runResult;
  try {
    runResult = await runPostHogSync({
      integration,
      secret,
      since: args.since ?? null,
      until: args.until ?? null,
      maxEvents,
    });
  } catch (error) {
    const code = error instanceof PostHogConnectorError ? error.code : 'POSTHOG_HTTP';
    const message = error instanceof Error ? error.message : 'Sync failed.';
    await persistSyncOutcome({
      repository,
      integration,
      cursor: integration.cursor,
      errorCode: code,
    });
    return { ok: false, httpStatus: 502, code, message };
  }

  const inputs = toCreateInputs(runResult.events, integration.organizationId);
  const insertResult = await repository.createCanonicalEventsBatch(inputs);

  await persistSyncOutcome({
    repository,
    integration,
    cursor: runResult.cursor,
    errorCode: null,
  });

  const report: SyncReport = {
    fetched: runResult.events.length,
    inserted: insertResult.inserted,
    deduped: insertResult.deduped,
    skipped: [],
    errors: [],
    cursor: runResult.cursor,
    hasMore: runResult.hasMore,
  };

  return { ok: true, report };
}
