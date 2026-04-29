import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { createPhase1Repository } from '@/lib/phase1';
import {
  badRequest,
  mapRouteError,
  parseJsonObject,
  parseString,
  resolveOrganizationContext,
  success,
} from '@/app/api/phase1/_shared';
import { CANONICAL_EVENT_SCHEMA_VERSION } from '@/lib/phase2/types';
import type { CanonicalEventInput } from '@/lib/phase2/types';
import type {
  CreateCanonicalEventInput,
  IntegrationRecord,
} from '@/lib/phase1/repository';
import type { SyncReport } from '@/lib/phase2/connectors/types';
import {
  PostHogConnectorError,
  resolvePostHogSecret,
  runPostHogSync,
} from '@/lib/phase2/connectors/posthog';

interface RouteContext {
  params: Promise<{ id: string }>;
}

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
  repository: ReturnType<typeof createPhase1Repository>;
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

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id) {
      return badRequest('`id` is required.');
    }

    const orgContext = resolveOrganizationContext(request, { allowQueryFallback: false });
    if (!orgContext.ok) {
      return orgContext.response;
    }

    const parsed = await parseJsonObject(request).catch(() => null);
    const body = parsed && parsed.ok ? parsed.value : {};
    const since = parseString(body.since ?? null);
    const until = parseString(body.until ?? null);
    const maxEventsRaw = body.maxEvents;
    const maxEvents =
      typeof maxEventsRaw === 'number' && Number.isInteger(maxEventsRaw) && maxEventsRaw > 0
        ? Math.min(maxEventsRaw, 25000)
        : DEFAULT_MAX_EVENTS;

    const repository = createPhase1Repository();
    const integration = await repository.getIntegration({
      organizationId: orgContext.organizationId,
      id,
    });
    if (!integration) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INTEGRATION_NOT_FOUND', message: 'Integration not found.' },
        },
        { status: 404 }
      );
    }

    if (integration.provider !== 'posthog') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNSUPPORTED_PROVIDER',
            message: `Sync is only implemented for PostHog; got "${integration.provider}".`,
          },
        },
        { status: 501 }
      );
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
        return NextResponse.json(
          {
            success: false,
            error: { code: error.code, message: error.message },
          },
          { status: 401 }
        );
      }
      throw error;
    }

    let runResult;
    try {
      runResult = await runPostHogSync({
        integration,
        secret,
        since,
        until,
        maxEvents,
      });
    } catch (error) {
      const code =
        error instanceof PostHogConnectorError ? error.code : 'POSTHOG_HTTP';
      const message = error instanceof Error ? error.message : 'Sync failed.';
      await persistSyncOutcome({
        repository,
        integration,
        cursor: integration.cursor,
        errorCode: code,
      });
      return NextResponse.json(
        { success: false, error: { code, message } },
        { status: 502 }
      );
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

    return success(report);
  } catch (error) {
    return mapRouteError(error);
  }
}
