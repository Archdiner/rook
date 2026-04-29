import {
  badRequest,
  mapRouteError,
  parseJsonObject,
  resolveOrganizationContext,
  success,
} from '@/app/api/phase1/_shared';
import { badConfigRequest, parseTimeWindow } from '../../_shared';
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

    const orgContext = resolveOrganizationContext(request, {
      bodyOrganizationId: body.organizationId,
      allowQueryFallback: false,
    });
    if (!orgContext.ok) {
      return orgContext.response;
    }

    const response = await runPhase2InsightsPipeline({
      organizationId: orgContext.organizationId,
      siteId,
      window: window.value,
      maxFindings,
    });

    return success(response);
  } catch (error) {
    return mapRouteError(error);
  }
}
