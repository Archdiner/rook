import { createPhase1Repository, generateFindings } from '@/lib/phase1';
import {
  badRequest,
  mapRouteError,
  parseJsonObject,
  resolveOrganizationContext,
  success,
} from '@/app/api/phase1/_shared';
import {
  buildInsightInputFromEvents,
  runInsightInputGate,
} from '@/lib/phase2';
import type {
  Phase2SiteConfig,
  RollupContext,
  RunInsightsResponse,
} from '@/lib/phase2/types';
import { runAuditRules } from '@/lib/phase2/rules';
import type { PageSnapshot } from '@/lib/phase2/snapshots/types';
import { badConfigRequest, parseTimeWindow } from '../../_shared';

const DEFAULT_MAX_FINDINGS = 3;

function parseMaxFindings(value: unknown): number | null {
  if (value === undefined || value === null) return DEFAULT_MAX_FINDINGS;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return null;
  return Math.min(value, 25);
}

function emptyConfig(siteId: string, organizationId: string): Phase2SiteConfig {
  return {
    siteId,
    organizationId,
    cohortDimensions: [],
    onboardingSteps: [],
    ctas: [],
    narratives: [],
    updatedAt: new Date(0).toISOString(),
  };
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

    const repository = createPhase1Repository();

    const [config, events, pageSnapshots] = await Promise.all([
      repository.getPhase2SiteConfig({
        organizationId: orgContext.organizationId,
        siteId,
      }),
      repository.listEventsInWindow({
        organizationId: orgContext.organizationId,
        siteId,
        window: window.value,
      }),
      repository.listPageSnapshots({
        organizationId: orgContext.organizationId,
        siteId,
        limit: 200,
      }),
    ]);

    const resolvedConfig = config ?? emptyConfig(siteId, orgContext.organizationId);

    const ctx: RollupContext = {
      siteId,
      window: window.value,
      config: resolvedConfig,
      events,
    };

    const generatedAt = new Date().toISOString();
    const rollup = buildInsightInputFromEvents(ctx, generatedAt);
    const gate = runInsightInputGate({
      rollup,
      config: resolvedConfig,
      window: window.value,
    });

    const findings = generateFindings(rollup.insightInput, { maxFindings });

    const pageSnapshotsByPath = buildSnapshotIndex(pageSnapshots);
    const auditReport = runAuditRules({
      organizationId: orgContext.organizationId,
      siteId,
      window: window.value,
      config: resolvedConfig,
      events,
      rollup,
      pageSnapshots,
      pageSnapshotsByPath,
    });

    const response: RunInsightsResponse = {
      siteId,
      window: window.value,
      generatedAt,
      findings,
      warnings: gate.warnings,
      diagnostics: rollup.diagnostics,
      trustworthy: gate.ok,
      auditReport,
    };

    return success(response);
  } catch (error) {
    return mapRouteError(error);
  }
}

function buildSnapshotIndex(snapshots: PageSnapshot[]): Map<string, PageSnapshot> {
  const map = new Map<string, PageSnapshot>();
  for (const s of snapshots) {
    if (!map.has(s.pathRef)) {
      map.set(s.pathRef, s);
    }
  }
  return map;
}
