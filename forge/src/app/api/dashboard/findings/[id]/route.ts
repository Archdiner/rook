/**
 * FORGE-065/066 — Dashboard: Single finding CRUD
 *
 * GET   /api/dashboard/findings/[id]  → fetch one finding
 * PATCH /api/dashboard/findings/[id]  → update status / preview artifact
 */

import { eq, and } from 'drizzle-orm';
import { badRequest, mapRouteError, parseJsonObject, parseString, success } from '@/app/api/phase1/_shared';
import { forbidden } from '@/app/api/phase1/_shared';
import { resolveForgeActor } from '@/lib/auth/forgeActor';
import { getDb } from '@/lib/db/client';
import { forgeFindings } from '@/lib/db/schema';

const VALID_STATUSES = ['open', 'approved', 'dismissed', 'shipped', 'measured'] as const;
const VALID_PREVIEW_TYPES = ['staging', 'deployment', 'image', 'mock'] as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const actorResult = await resolveForgeActor(request, { allowQueryFallback: true });
    if (!actorResult.ok) return actorResult.response;

    const db = getDb();
    const rows = await db
      .select()
      .from(forgeFindings)
      .where(
        and(
          eq(forgeFindings.id, id),
          eq(forgeFindings.organizationId, actorResult.actor.organizationId)
        )
      )
      .limit(1);

    if (rows.length === 0) {
      return forbidden('Finding not found.', 'NOT_FOUND');
    }
    return success(rows[0]);
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsed = await parseJsonObject(request);
    if (!parsed.ok) return badRequest(parsed.message);
    const body = parsed.value;

    const actorResult = await resolveForgeActor(request, {
      bodyOrganizationId: body.organizationId,
      allowQueryFallback: false,
    });
    if (!actorResult.ok) return actorResult.response;

    const db = getDb();

    // Verify ownership
    const existing = await db
      .select()
      .from(forgeFindings)
      .where(
        and(
          eq(forgeFindings.id, id),
          eq(forgeFindings.organizationId, actorResult.actor.organizationId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return forbidden('Finding not found.', 'NOT_FOUND');
    }

    // Build update object from provided fields
    const update: Record<string, unknown> = { updatedAt: new Date() };

    if (body.status !== undefined) {
      const s = parseString(body.status);
      if (!s || !VALID_STATUSES.includes(s as (typeof VALID_STATUSES)[number])) {
        return badRequest(`\`status\` must be one of: ${VALID_STATUSES.join(', ')}.`);
      }
      update.status = s;
    }

    if (body.previewUrl !== undefined) {
      update.previewUrl = parseString(body.previewUrl) ?? null;
    }

    if (body.previewType !== undefined) {
      const pt = parseString(body.previewType);
      if (pt && !VALID_PREVIEW_TYPES.includes(pt as (typeof VALID_PREVIEW_TYPES)[number])) {
        return badRequest(`\`previewType\` must be one of: ${VALID_PREVIEW_TYPES.join(', ')}.`);
      }
      update.previewType = pt ?? null;
    }

    if (body.previewNotes !== undefined) {
      update.previewNotes = parseString(body.previewNotes) ?? null;
    }

    await db
      .update(forgeFindings)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(update as any)
      .where(eq(forgeFindings.id, id));

    const updated = await db
      .select()
      .from(forgeFindings)
      .where(eq(forgeFindings.id, id))
      .limit(1);

    return success(updated[0]);
  } catch (error) {
    return mapRouteError(error);
  }
}
