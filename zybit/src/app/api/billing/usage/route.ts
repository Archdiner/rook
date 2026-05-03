/**
 * GET /api/billing/usage
 *
 * Returns current-month usage counters for the authenticated org.
 */

import { resolveZybitActor } from '@/lib/auth/actor';
import { getUsage } from '@/lib/billing/usage';
import { mapRouteError, success } from '@/app/api/phase1/_shared';

export async function GET(request: Request) {
  try {
    const actorResult = await resolveZybitActor(request, { allowQueryFallback: true });
    if (!actorResult.ok) return actorResult.response;

    const orgId = actorResult.actor.organizationId;
    const usage = await getUsage(orgId);

    return success(usage);
  } catch (error) {
    return mapRouteError(error);
  }
}
