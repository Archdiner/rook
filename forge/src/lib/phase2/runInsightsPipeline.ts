import { createPhase1Repository, generateFindings } from '@/lib/phase1';
import { buildInsightInputFromEvents, runInsightInputGate } from '@/lib/phase2';
import type { Phase2SiteConfig, RollupContext, RunInsightsResponse, TimeWindow } from '@/lib/phase2/types';
import { runAuditRules } from '@/lib/phase2/rules';
import type { PageSnapshot } from '@/lib/phase2/snapshots/types';

export interface RunPhase2InsightsArgs {
  organizationId: string;
  siteId: string;
  window: TimeWindow;
  maxFindings: number;
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

function buildSnapshotIndex(snapshots: PageSnapshot[]): Map<string, PageSnapshot> {
  const map = new Map<string, PageSnapshot>();
  for (const s of snapshots) {
    if (!map.has(s.pathRef)) {
      map.set(s.pathRef, s);
    }
  }
  return map;
}

/**
 * Single entry point for Phase 2 insights + audit — used by HTTP routes and tests.
 */
export async function runPhase2InsightsPipeline(
  args: RunPhase2InsightsArgs
): Promise<RunInsightsResponse> {
  const { organizationId, siteId, window, maxFindings } = args;
  const repository = createPhase1Repository();

  const [config, events, pageSnapshots] = await Promise.all([
    repository.getPhase2SiteConfig({ organizationId, siteId }),
    repository.listEventsInWindow({ organizationId, siteId, window }),
    repository.listPageSnapshots({ organizationId, siteId, limit: 200 }),
  ]);

  const resolvedConfig = config ?? emptyConfig(siteId, organizationId);

  const ctx: RollupContext = {
    siteId,
    window,
    config: resolvedConfig,
    events,
  };

  const generatedAt = new Date().toISOString();
  const rollup = buildInsightInputFromEvents(ctx, generatedAt);
  const gate = runInsightInputGate({
    rollup,
    config: resolvedConfig,
    window,
  });

  const findings = generateFindings(rollup.insightInput, { maxFindings });

  const pageSnapshotsByPath = buildSnapshotIndex(pageSnapshots);
  const auditReport = runAuditRules({
    organizationId,
    siteId,
    window,
    config: resolvedConfig,
    events,
    rollup,
    pageSnapshots,
    pageSnapshotsByPath,
  });

  return {
    siteId,
    window,
    generatedAt,
    findings,
    warnings: gate.warnings,
    diagnostics: rollup.diagnostics,
    trustworthy: gate.ok,
    auditReport,
  };
}
