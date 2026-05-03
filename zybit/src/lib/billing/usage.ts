/**
 * Usage tracking — increment and query monthly usage counters.
 */

import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { zybitUsage } from '@/lib/db/schema';

type UsageMetric = 'eventsIngested' | 'snapshotsTaken' | 'insightsRuns';

function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function usageId(orgId: string, period: string): string {
  return `${orgId}_${period}`;
}

/**
 * Upsert a usage increment for the current month.
 */
export async function incrementUsage(
  orgId: string,
  metric: UsageMetric,
  count = 1
): Promise<void> {
  const period = currentPeriod();
  const id = usageId(orgId, period);
  const db = getDb();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columnMap: Record<UsageMetric, any> = {
    eventsIngested: zybitUsage.eventsIngested,
    snapshotsTaken: zybitUsage.snapshotsTaken,
    insightsRuns: zybitUsage.insightsRuns,
  };

  const col = columnMap[metric];

  await db
    .insert(zybitUsage)
    .values({
      id,
      organizationId: orgId,
      period,
      [metric]: count,
    })
    .onConflictDoUpdate({
      target: zybitUsage.id,
      set: {
        [metric]: sql`${col} + ${count}`,
      },
    });
}

/**
 * Get usage record for an org in a given month (defaults to current).
 */
export async function getUsage(
  orgId: string,
  month?: string
): Promise<{
  period: string;
  eventsIngested: number;
  snapshotsTaken: number;
  insightsRuns: number;
}> {
  const period = month ?? currentPeriod();
  const db = getDb();

  const [row] = await db
    .select({
      period: zybitUsage.period,
      eventsIngested: zybitUsage.eventsIngested,
      snapshotsTaken: zybitUsage.snapshotsTaken,
      insightsRuns: zybitUsage.insightsRuns,
    })
    .from(zybitUsage)
    .where(
      and(eq(zybitUsage.organizationId, orgId), eq(zybitUsage.period, period))
    )
    .limit(1);

  return row ?? { period, eventsIngested: 0, snapshotsTaken: 0, insightsRuns: 0 };
}
