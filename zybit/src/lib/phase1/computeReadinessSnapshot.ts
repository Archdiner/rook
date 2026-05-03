import { randomUUID } from 'crypto';

import { evaluateAllCategories } from '@/lib/phase1/sufficiency';

import type { Phase1Event, Phase1ReadinessSnapshot } from '@/lib/phase1/repository/types';

const CONVERSION_EVENT_TYPES = new Set([
  'purchase',
  'conversion',
  'order_completed',
  'checkout_complete',
  'subscription_convert',
]);

function aggregateEvidence(events: Phase1Event[]): {
  sessions: number;
  events: number;
  conversions: number;
} {
  const sessionIds = new Set(events.map((e) => e.sessionId));
  let conversions = 0;
  for (const e of events) {
    if (CONVERSION_EVENT_TYPES.has(e.type)) {
      conversions += 1;
      continue;
    }
    const m = e.metrics;
    if (m && typeof m.conversion === 'number' && m.conversion > 0) {
      conversions += 1;
    }
  }
  return {
    sessions: sessionIds.size,
    events: events.length,
    conversions,
  };
}

/**
 * Maps raw events through the sufficiency engine ({@link evaluateAllCategories}) into the API snapshot shape.
 */
export function computeReadinessSnapshotFromEvents(
  siteId: string,
  events: Phase1Event[]
): Phase1ReadinessSnapshot {
  const evidence = aggregateEvidence(events);
  const result = evaluateAllCategories({ evidence });

  const progresses = result.orderedResults.map((r) => r.progress);
  const score = Math.round(
    (progresses.reduce((sum, p) => sum + p, 0) / Math.max(progresses.length, 1)) * 100
  );

  const status: Phase1ReadinessSnapshot['status'] = result.overallReady
    ? 'sufficient'
    : score >= 50
      ? 'collecting'
      : 'insufficient';

  const reasonsFromEngine = result.orderedResults
    .filter((r) => !r.ready)
    .flatMap((r) => r.reasons.map((rr) => rr.message));

  const reasons =
    reasonsFromEngine.length > 0
      ? reasonsFromEngine.slice(0, 12)
      : ['Collect more behavioral evidence to unlock category-level readiness.'];

  return {
    id: randomUUID(),
    siteId,
    score,
    status,
    reasons,
    eventCount: events.length,
    sessionCount: evidence.sessions,
    generatedAt: new Date().toISOString(),
  };
}
