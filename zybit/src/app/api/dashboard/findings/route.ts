/**
 * FORGE-065 — Dashboard: Findings API
 *
 * GET  /api/dashboard/findings?siteId=...&status=open&limit=50
 *   → lists persisted forge_findings, ordered by priority desc.
 *
 * POST /api/dashboard/findings/sync (handled by /sync/route.ts)
 */

import { createHash } from 'crypto';
import { randomUUID } from 'crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { badRequest, mapRouteError, parseJsonObject, parseString, success } from '@/app/api/phase1/_shared';
import { resolveZybitActor } from '@/lib/auth/actor';
import { getDb } from '@/lib/db/client';
import { zybitFindings } from '@/lib/db/schema';
import { assertSiteInOrganization } from '@/lib/auth/tenantScope';
import { createPhase1Repository } from '@/lib/phase1';
import { runPhase2InsightsPipeline } from '@/lib/phase2';
import type { AuditFinding } from '@/lib/phase2/rules/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Deterministic primary key for a finding: stable across re-runs so we can
 * upsert without creating duplicates.
 */
export function findingPk(siteId: string, ruleId: string, pathRef: string | null): string {
  const raw = `${siteId}|${ruleId}|${pathRef ?? '__site__'}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 24);
}

const VALID_STATUSES = ['open', 'approved', 'dismissed', 'shipped', 'measured'] as const;
type FindingStatus = (typeof VALID_STATUSES)[number];

// ---------------------------------------------------------------------------
// GET — list findings for a site
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const actorResult = await resolveZybitActor(request, { allowQueryFallback: true });
    if (!actorResult.ok) return actorResult.response;

    const url = new URL(request.url);
    const siteId = parseString(url.searchParams.get('siteId'));
    if (!siteId) return badRequest('`siteId` query param is required.');

    const statusParam = url.searchParams.get('status');
    const statusFilter =
      statusParam && VALID_STATUSES.includes(statusParam as FindingStatus)
        ? (statusParam as FindingStatus)
        : null;

    const repository = createPhase1Repository();
    const siteGate = await assertSiteInOrganization({
      repository,
      organizationId: actorResult.actor.organizationId,
      siteId,
    });
    if (!siteGate.ok) return siteGate.response;

    const db = getDb();
    const conditions = [eq(zybitFindings.siteId, siteId)];
    if (statusFilter) conditions.push(eq(zybitFindings.status, statusFilter));

    const rows = await db
      .select()
      .from(zybitFindings)
      .where(and(...conditions))
      .orderBy(desc(zybitFindings.priorityScore))
      .limit(100);

    return success(rows);
  } catch (error) {
    return mapRouteError(error);
  }
}

// ---------------------------------------------------------------------------
// POST — sync: run insights pipeline and upsert findings
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonObject(request);
    if (!parsed.ok) return badRequest(parsed.message);
    const body = parsed.value;

    const siteId = parseString(body.siteId);
    if (!siteId) return badRequest('`siteId` is required.');

    const daysRaw = typeof body.days === 'number' ? body.days : 7;
    const days = Math.min(Math.max(1, Math.floor(daysRaw)), 90);
    const endMs = Date.now();
    const startMs = endMs - days * 86_400_000;
    const window = {
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
    };

    const actorResult = await resolveZybitActor(request, {
      bodyOrganizationId: body.organizationId,
      allowQueryFallback: false,
    });
    if (!actorResult.ok) return actorResult.response;

    const repository = createPhase1Repository();
    const siteGate = await assertSiteInOrganization({
      repository,
      organizationId: actorResult.actor.organizationId,
      siteId,
    });
    if (!siteGate.ok) return siteGate.response;

    const insightsResult = await runPhase2InsightsPipeline({
      organizationId: actorResult.actor.organizationId,
      siteId,
      window,
      maxFindings: 25,
    });

    const auditFindings = (insightsResult.auditReport?.findings ?? []) as AuditFinding[];
    const now = new Date();

    const db = getDb();

    // Upsert each finding — preserve operator status/preview if already set
    const upserted: string[] = [];
    for (const f of auditFindings) {
      const pk = findingPk(siteId, f.ruleId, f.pathRef);
      upserted.push(pk);

      await db
        .insert(zybitFindings)
        .values({
          id: pk,
          organizationId: actorResult.actor.organizationId,
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
          status: 'open',
          lastSeenAt: now,
          insightWindowStart: new Date(startMs),
          insightWindowEnd: new Date(endMs),
        })
        .onConflictDoUpdate({
          target: zybitFindings.id,
          set: {
            // Refresh analytical fields
            severity: f.severity,
            confidence: f.confidence,
            priorityScore: f.priorityScore,
            title: f.title,
            summary: f.summary,
            recommendation: f.recommendation,
            evidence: f.evidence,
            refs: f.refs ?? null,
            lastSeenAt: now,
            insightWindowStart: new Date(startMs),
            insightWindowEnd: new Date(endMs),
            updatedAt: now,
            // Note: status / preview fields are NOT overwritten — operator decisions persist
          },
        });
    }

    // Return persisted rows (sorted by priority)
    const rows = await db
      .select()
      .from(zybitFindings)
      .where(eq(zybitFindings.siteId, siteId))
      .orderBy(desc(zybitFindings.priorityScore))
      .limit(100);

    return success({
      synced: upserted.length,
      trustworthy: insightsResult.trustworthy,
      findings: rows,
      diagnostics: insightsResult.auditReport?.diagnostics ?? [],
    });
  } catch (error) {
    return mapRouteError(error);
  }
}
