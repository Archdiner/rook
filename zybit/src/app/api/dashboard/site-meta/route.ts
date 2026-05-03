/**
 * GET/PATCH /api/dashboard/site-meta?siteId=...
 *
 * GET  — returns forge_site_meta for the site (creates default row if missing).
 * PATCH — updates monthlyRevenueCents and/or avgOrderValueCents.
 *
 * Revenue context is optional but enables per-finding "estimated revenue at risk"
 * framing — the primary differentiator from raw analytics output.
 */

import { eq } from 'drizzle-orm';
import { badRequest, mapRouteError, parseJsonObject, parseString, success } from '@/app/api/phase1/_shared';
import { resolveZybitActor } from '@/lib/auth/actor';
import { assertSiteInOrganization } from '@/lib/auth/tenantScope';
import { getDb } from '@/lib/db/client';
import { zybitSiteMeta } from '@/lib/db/schema';
import { createPhase1Repository } from '@/lib/phase1';

async function getOrInit(siteId: string, organizationId: string) {
  const db = getDb();
  const rows = await db.select().from(zybitSiteMeta).where(eq(zybitSiteMeta.siteId, siteId)).limit(1);
  if (rows[0]) return rows[0];
  // Initialise with defaults — don't fail just because meta row doesn't exist yet
  const [row] = await db
    .insert(zybitSiteMeta)
    .values({ siteId, organizationId, sessionCountAtLastRun: 0, insightThreshold: 100, updatedAt: new Date() })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function GET(request: Request) {
  try {
    const actorResult = await resolveZybitActor(request, { allowQueryFallback: true });
    if (!actorResult.ok) return actorResult.response;

    const url = new URL(request.url);
    const siteId = parseString(url.searchParams.get('siteId'));
    if (!siteId) return badRequest('`siteId` is required.');

    const repository = createPhase1Repository();
    const siteGate = await assertSiteInOrganization({ repository, organizationId: actorResult.actor.organizationId, siteId });
    if (!siteGate.ok) return siteGate.response;

    const row = await getOrInit(siteId, actorResult.actor.organizationId);
    return success(row);
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actorResult = await resolveZybitActor(request, { allowQueryFallback: true });
    if (!actorResult.ok) return actorResult.response;

    const parsed = await parseJsonObject(request);
    if (!parsed.ok) return badRequest(parsed.message);

    const url = new URL(request.url);
    const siteId = parseString(url.searchParams.get('siteId') ?? String(parsed.value.siteId ?? ''));
    if (!siteId) return badRequest('`siteId` is required.');

    const repository = createPhase1Repository();
    const siteGate = await assertSiteInOrganization({ repository, organizationId: actorResult.actor.organizationId, siteId });
    if (!siteGate.ok) return siteGate.response;

    const body = parsed.value;
    const set: Partial<typeof zybitSiteMeta.$inferInsert> = { updatedAt: new Date() };

    if (typeof body.monthlyRevenueCents === 'number' && body.monthlyRevenueCents >= 0) {
      set.monthlyRevenueCents = Math.round(body.monthlyRevenueCents);
    }
    if (typeof body.avgOrderValueCents === 'number' && body.avgOrderValueCents >= 0) {
      set.avgOrderValueCents = Math.round(body.avgOrderValueCents);
    }
    if (typeof body.insightThreshold === 'number' && body.insightThreshold >= 10) {
      set.insightThreshold = Math.min(Math.round(body.insightThreshold), 10000);
    }

    const db = getDb();
    // Ensure row exists
    await db
      .insert(zybitSiteMeta)
      .values({ siteId, organizationId: actorResult.actor.organizationId, sessionCountAtLastRun: 0, insightThreshold: 100, updatedAt: new Date(), ...set })
      .onConflictDoUpdate({ target: zybitSiteMeta.siteId, set });

    const row = await getOrInit(siteId, actorResult.actor.organizationId);
    return success(row);
  } catch (error) {
    return mapRouteError(error);
  }
}
