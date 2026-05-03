/**
 * POST /api/proxy/assignment
 *
 * Public (no auth) -- fire-and-forget from proxy middleware.
 * Logs an experiment assignment event into phase1Events.
 */

import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/client';
import { phase1Events, phase1Sites } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface AssignmentBody {
  experimentId: string;
  bucket: string;
  visitorId: string;
  siteId: string;
  path: string;
  timestamp: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AssignmentBody;

    if (!body.experimentId || !body.bucket || !body.visitorId || !body.siteId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Missing required fields.' } },
        { status: 400 },
      );
    }

    const db = getDb();

    // Look up org from site
    const sites = await db
      .select({ organizationId: phase1Sites.organizationId })
      .from(phase1Sites)
      .where(eq(phase1Sites.id, body.siteId))
      .limit(1);

    const orgId = sites[0]?.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Site not found.' } },
        { status: 404 },
      );
    }

    await db.insert(phase1Events).values({
      id: randomUUID(),
      organizationId: orgId,
      siteId: body.siteId,
      sessionId: body.visitorId,
      type: 'experiment_assignment',
      path: body.path || '/',
      metrics: null,
      properties: {
        experimentId: body.experimentId,
        bucket: body.bucket,
        visitorId: body.visitorId,
      },
      occurredAt: body.timestamp ? new Date(body.timestamp) : new Date(),
      source: 'proxy',
      sourceEventId: `${body.experimentId}:${body.visitorId}`,
      schemaVersion: 1,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 },
    );
  }
}
