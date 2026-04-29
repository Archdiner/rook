import {
  badRequest,
  mapRouteError,
  parseJsonObject,
  success,
} from '@/app/api/phase1/_shared';
import { badConfigRequest, parseTimeWindow } from '../../_shared';
import { assertApiKeyHasScope, resolveForgeActor } from '@/lib/auth/forgeActor';
import { assertSiteInOrganization } from '@/lib/auth/tenantScope';
import { createPhase1Repository } from '@/lib/phase1';
import {
  buildReceiptMarkdown,
  runPhase2InsightsPipeline,
} from '@/lib/phase2';
import type { ForgeReceiptV1Envelope } from '@/lib/phase2/types';
import { NextResponse } from 'next/server';

const DEFAULT_MAX_FINDINGS = 3;

function parseMaxFindings(value: unknown): number | null {
  if (value === undefined || value === null) return DEFAULT_MAX_FINDINGS;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return null;
  return Math.min(value, 25);
}

/** Query `format`, body `format`, then Accept (markdown only). Defaults to JSON receipt envelope. */
function resolveReceiptFormat(request: Request, body: Record<string, unknown>): 'json' | 'markdown' {
  let qp: string | null = null;
  try {
    qp = new URL(request.url).searchParams.get('format');
  } catch {
    qp = null;
  }
  if (qp === 'markdown' || qp === 'json') return qp;
  const raw = body.format;
  if (raw === 'markdown' || raw === 'json') return raw;
  const accept = request.headers.get('accept');
  if (accept?.includes('text/markdown')) return 'markdown';
  return 'json';
}

function filenameSafe(s: string): string {
  return s.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'site';
}

/**
 * Credibility exports: **`forge.receipt.v1`** JSON or downloadable Markdown companion.
 *
 * Same request body as `POST /api/phase2/insights/run` plus optional `{ "format": "json" | "markdown" }`
 * or `?format=`.
 */
export async function POST(request: Request) {
  try {
    const parsed = await parseJsonObject(request);
    if (!parsed.ok) {
      return badRequest(parsed.message);
    }
    const body = parsed.value;

    const siteId = typeof body.siteId === 'string' ? body.siteId.trim() : '';
    if (!siteId) {
      return badRequest('`siteId` is required.');
    }

    const window = parseTimeWindow(body.window);
    if (!window.ok) {
      return badConfigRequest(window.message);
    }

    const maxFindings = parseMaxFindings(body.maxFindings);
    if (maxFindings === null) {
      return badConfigRequest('`maxFindings` must be a positive integer when provided.');
    }

    const actorResult = await resolveForgeActor(request, {
      bodyOrganizationId: body.organizationId,
      allowQueryFallback: false,
    });
    if (!actorResult.ok) {
      return actorResult.response;
    }
    const scopeErr = assertApiKeyHasScope(actorResult.actor, 'insights:run');
    if (scopeErr) return scopeErr;

    const repository = createPhase1Repository();
    const siteGate = await assertSiteInOrganization({
      repository,
      organizationId: actorResult.actor.organizationId,
      siteId,
    });
    if (!siteGate.ok) return siteGate.response;

    const run = await runPhase2InsightsPipeline({
      organizationId: actorResult.actor.organizationId,
      siteId,
      window: window.value,
      maxFindings,
    });

    const format = resolveReceiptFormat(request, body);

    if (format === 'markdown') {
      const markdown = buildReceiptMarkdown(run);
      const stamp =
        typeof run.generatedAt === 'string' ? run.generatedAt.slice(0, 10).replace(/-/g, '') : '';
      const name = `forge-receipt_${filenameSafe(siteId)}_${stamp || 'export'}.md`;
      return new NextResponse(markdown, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${name}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const exportedAt = new Date().toISOString();
    const envelope: ForgeReceiptV1Envelope = {
      schemaVersion: 'forge.receipt.v1',
      exportedAt,
      run,
    };

    return success(envelope);
  } catch (error) {
    return mapRouteError(error);
  }
}
