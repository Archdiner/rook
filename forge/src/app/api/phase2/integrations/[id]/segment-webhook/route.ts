import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

import {
  badRequest,
  mapRouteError,
  parseJsonObject,
  parseString,
  resolveOrganizationContext,
  success,
} from '@/app/api/phase1/_shared';
import { createPhase1Repository } from '@/lib/phase1';
import type { CreateCanonicalEventInput } from '@/lib/phase1/repository';
import {
  assertSegmentProvider,
  mapSegmentMessageToCanonical,
  resolveSegmentWebhookSecret,
  unwrapSegmentPayload,
  SegmentConnectorError,
} from '@/lib/phase2/connectors/segment';
import type { CanonicalEventInput } from '@/lib/phase2/types';
import { CANONICAL_EVENT_SCHEMA_VERSION } from '@/lib/phase2/types';

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export const config = {
  runtime: 'nodejs',
};

function toCreates(
  inputs: CanonicalEventInput[],
  organizationId: string
): CreateCanonicalEventInput[] {
  const now = new Date().toISOString();
  return inputs.map((input) => {
    const occurredAt = input.occurredAt ?? now;
    const base: CreateCanonicalEventInput = {
      id: randomUUID(),
      organizationId,
      siteId: input.siteId,
      sessionId: input.sessionId,
      type: input.type,
      path: input.path,
      occurredAt,
      createdAt: now,
      source: input.source ?? 'segment',
      schemaVersion: CANONICAL_EVENT_SCHEMA_VERSION,
    };
    if (input.metrics) base.metrics = input.metrics;
    if (input.properties) base.properties = input.properties;
    if (input.anonymousId) base.anonymousId = input.anonymousId;
    if (input.sourceEventId) base.sourceEventId = input.sourceEventId;
    return base;
  });
}

/** Segment HTTP Source / Forward webhook — Bearer token must match env integration.secretRef. */
export async function POST(request: Request, context: RouteCtx) {
  try {
    const { id } = await context.params;
    if (!id) return badRequest('`integration` id missing.');

    const orgContext = resolveOrganizationContext(request, {
      bodyOrganizationId: undefined,
      allowQueryFallback: true,
    });
    if (!orgContext.ok) return orgContext.response;

    const repository = createPhase1Repository();
    const integration = await repository.getIntegration({
      organizationId: orgContext.organizationId,
      id,
    });

    if (!integration) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTEGRATION_NOT_FOUND',
            message: 'Integration not found.',
          },
        },
        { status: 404 }
      );
    }

    try {
      assertSegmentProvider(integration.provider);

      let secretFromEnv = '';
      if (integration.secretRef) {
        secretFromEnv = resolveSegmentWebhookSecret(integration.secretRef);
      }

      const hdr = parseString(request.headers.get('authorization')) ?? '';
      const bearer = hdr.toLowerCase().startsWith('bearer ') ? hdr.slice(7).trim() : '';
      const okAuth = secretFromEnv.length > 0 && bearer === secretFromEnv;
      if (!okAuth) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'SEGMENT_WEBHOOK_UNAUTHORIZED',
              message: 'Send Authorization: Bearer <token> matching the env var referenced by integration.secretRef.',
            },
          },
          { status: 401 }
        );
      }
    } catch (e) {
      if (e instanceof SegmentConnectorError) {
        return NextResponse.json(
          {
            success: false,
            error: { code: e.code, message: e.message },
          },
          {
            status:
              e.code === 'SEGMENT_SECRET_MISSING' ||
              e.code === 'SEGMENT_SECRET_UNRESOLVED'
                ? 400
                : 401,
          }
        );
      }
      throw e;
    }

    const parsed = await parseJsonObject(request);
    if (!parsed.ok) return badRequest(parsed.message);

    const rawItems = unwrapSegmentPayload(parsed.value);
    const inputs = rawItems
      .map((msg) =>
        mapSegmentMessageToCanonical(msg, { siteId: integration.siteId })
      )
      .filter(Boolean) as CanonicalEventInput[];

    if (inputs.length === 0) {
      return success({
        inserted: 0,
        deduped: 0,
        mapped: 0,
        skipped: rawItems.length,
        hint: 'No Segment page/track messages (identity-only batches return empty).',
      });
    }

    const result = await repository.createCanonicalEventsBatch(
      toCreates(inputs, integration.organizationId)
    );
    return success({
      mapped: inputs.length,
      skipped: rawItems.length - inputs.length,
      inserted: result.inserted,
      deduped: result.deduped,
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
