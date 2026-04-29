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
import { runPhase2InsightsPipeline } from '@/lib/phase2';

const DEFAULT_MAX_FINDINGS = 3;

function parseMaxFindings(value: unknown): number | null {
  if (value === undefined || value === null) return DEFAULT_MAX_FINDINGS;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return null;
  return Math.min(value, 25);
}

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

    const response = await runPhase2InsightsPipeline({
      organizationId: actorResult.actor.organizationId,
      siteId,
      window: window.value,
      maxFindings,
    });

    return success(response);
  } catch (error) {
    return mapRouteError(error);
  }
}
