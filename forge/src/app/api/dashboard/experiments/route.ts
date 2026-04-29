/**
 * FORGE-067/068 — Dashboard: Experiments API
 *
 * GET  /api/dashboard/experiments?siteId=...&status=running
 * POST /api/dashboard/experiments  → create experiment (optionally from a finding)
 */

import { randomUUID } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { badRequest, mapRouteError, parseJsonObject, parseString, success } from '@/app/api/phase1/_shared';
import { resolveForgeActor } from '@/lib/auth/forgeActor';
import { getDb } from '@/lib/db/client';
import { forgeExperiments, forgeFindings } from '@/lib/db/schema';
import { assertSiteInOrganization } from '@/lib/auth/tenantScope';
import { createPhase1Repository } from '@/lib/phase1';

const VALID_STATUSES = ['draft', 'running', 'completed', 'stopped'] as const;

export async function GET(request: Request) {
  try {
    const actorResult = await resolveForgeActor(request, { allowQueryFallback: true });
    if (!actorResult.ok) return actorResult.response;

    const url = new URL(request.url);
    const siteId = parseString(url.searchParams.get('siteId'));
    if (!siteId) return badRequest('`siteId` query param is required.');

    const statusParam = url.searchParams.get('status');
    const statusFilter =
      statusParam && VALID_STATUSES.includes(statusParam as (typeof VALID_STATUSES)[number])
        ? statusParam
        : null;

    const repository = createPhase1Repository();
    const siteGate = await assertSiteInOrganization({
      repository,
      organizationId: actorResult.actor.organizationId,
      siteId,
    });
    if (!siteGate.ok) return siteGate.response;

    const db = getDb();
    const conditions = [eq(forgeExperiments.siteId, siteId)];
    if (statusFilter) conditions.push(eq(forgeExperiments.status, statusFilter));

    const rows = await db
      .select()
      .from(forgeExperiments)
      .where(and(...conditions))
      .orderBy(desc(forgeExperiments.createdAt))
      .limit(50);

    return success(rows);
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = await parseJsonObject(request);
    if (!parsed.ok) return badRequest(parsed.message);
    const body = parsed.value;

    const siteId = parseString(body.siteId);
    if (!siteId) return badRequest('`siteId` is required.');

    const hypothesis = parseString(body.hypothesis);
    if (!hypothesis) return badRequest('`hypothesis` is required.');

    const primaryMetric = parseString(body.primaryMetric);
    if (!primaryMetric) return badRequest('`primaryMetric` is required.');

    const actorResult = await resolveForgeActor(request, {
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

    // Optional: link to a finding and mark it approved
    const findingId = parseString(body.findingId) ?? null;
    const db = getDb();

    if (findingId) {
      await db
        .update(forgeFindings)
        .set({ status: 'approved', updatedAt: new Date() })
        .where(
          and(
            eq(forgeFindings.id, findingId),
            eq(forgeFindings.organizationId, actorResult.actor.organizationId)
          )
        );
    }

    const durationDays = typeof body.durationDays === 'number'
      ? Math.min(Math.max(1, Math.floor(body.durationDays)), 365)
      : 14;

    const controlPct = typeof body.audienceControlPct === 'number'
      ? Math.min(Math.max(1, body.audienceControlPct), 99)
      : 50;

    const now = new Date();
    const startNow = body.startImmediately === true;

    const [experiment] = await db
      .insert(forgeExperiments)
      .values({
        id: randomUUID(),
        organizationId: actorResult.actor.organizationId,
        siteId,
        findingId,
        hypothesis,
        primaryMetric,
        primaryMetricSource: parseString(body.primaryMetricSource) ?? 'posthog',
        audienceControlPct: controlPct,
        audienceVariantPct: 100 - controlPct,
        durationDays,
        status: startNow ? 'running' : 'draft',
        externalUrl: parseString(body.externalUrl) ?? null,
        externalProvider: parseString(body.externalProvider) ?? null,
        externalId: parseString(body.externalId) ?? null,
        guardrails: Array.isArray(body.guardrails) ? body.guardrails.map(String) : null,
        notes: parseString(body.notes) ?? null,
        startedAt: startNow ? now : null,
      })
      .returning();

    return success(experiment, 201);
  } catch (error) {
    return mapRouteError(error);
  }
}
