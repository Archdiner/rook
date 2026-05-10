/**
 * Per-site daily capture budget enforcement.
 *
 * Budget cap comes from `phase2_site_configs.captureBudgetUsdDay`
 * (default $1.00/day). Daily spend is accumulated in
 * `forge_site_meta.captureSpendDayUsd` with a date column that
 * auto-resets the counter when the date changes.
 *
 * Hard-stops at 100% of budget; warns at 80%.
 */

import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { zybitSiteMeta, phase2SiteConfigs } from '@/lib/db/schema';

const DEFAULT_BUDGET_USD = 1.0;
const WARN_FRACTION = 0.8;

export interface BudgetStatus {
  remainingUsd: number;
  totalBudgetUsd: number;
  spentTodayUsd: number;
  isExceeded: boolean;
  isWarning: boolean;
}

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function checkBudget(siteId: string): Promise<BudgetStatus> {
  const db = getDb();
  const today = todayUtcDate();

  const [metaRows, configRows] = await Promise.all([
    db.select().from(zybitSiteMeta).where(eq(zybitSiteMeta.siteId, siteId)).limit(1),
    db.select().from(phase2SiteConfigs).where(eq(phase2SiteConfigs.siteId, siteId)).limit(1),
  ]);

  // decimal columns return strings from Postgres — parse to float for arithmetic
  const budgetUsd = configRows[0]?.captureBudgetUsdDay != null
    ? parseFloat(String(configRows[0].captureBudgetUsdDay))
    : DEFAULT_BUDGET_USD;

  const meta = metaRows[0];
  const spentToday =
    meta?.captureSpendDayDate === today && meta.captureSpendDayUsd != null
      ? parseFloat(String(meta.captureSpendDayUsd))
      : 0;

  const remaining = Math.max(0, budgetUsd - spentToday);
  return {
    remainingUsd: remaining,
    totalBudgetUsd: budgetUsd,
    spentTodayUsd: spentToday,
    isExceeded: spentToday >= budgetUsd,
    isWarning: spentToday >= budgetUsd * WARN_FRACTION,
  };
}

/**
 * Atomically add `costUsd` to today's spend counter, resetting
 * when the calendar date has rolled over.
 */
export async function recordCaptureSpend(
  siteId: string,
  organizationId: string,
  costUsd: number,
): Promise<void> {
  if (costUsd <= 0) return;
  const db = getDb();
  const today = todayUtcDate();

  await db
    .insert(zybitSiteMeta)
    .values({
      siteId,
      organizationId,
      captureSpendDayUsd: String(costUsd),
      captureSpendDayDate: today,
    })
    .onConflictDoUpdate({
      target: zybitSiteMeta.siteId,
      set: {
        captureSpendDayUsd: sql`
          CASE
            WHEN ${zybitSiteMeta.captureSpendDayDate} = ${today}
            THEN ${zybitSiteMeta.captureSpendDayUsd} + ${costUsd}
            ELSE ${costUsd}
          END
        `,
        captureSpendDayDate: today,
        updatedAt: sql`now()`,
      },
    });
}
