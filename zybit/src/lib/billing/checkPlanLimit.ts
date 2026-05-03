/**
 * Plan limit enforcement — checks whether an org can use a resource.
 */

import { eq, and, count } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { organizations, phase1Sites, zybitExperiments, zybitUsage } from '@/lib/db/schema';
import { PLAN_LIMITS, type PlanId, isValidPlanId } from './plans';

export interface PlanLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  plan: string;
}

// Simple in-memory cache with TTL for org plan data
const planCache = new Map<string, { plan: PlanId; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getOrgPlan(orgId: string): Promise<PlanId> {
  const cached = planCache.get(orgId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.plan;
  }

  const db = getDb();
  const [org] = await db
    .select({ plan: organizations.plan })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  const plan = org && isValidPlanId(org.plan) ? org.plan : 'starter';
  planCache.set(orgId, { plan, expiresAt: Date.now() + CACHE_TTL_MS });
  return plan;
}

/** Clear cached plan for an org (call after plan changes). */
export function invalidatePlanCache(orgId: string): void {
  planCache.delete(orgId);
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function checkPlanLimit(
  orgId: string,
  resource: 'sites' | 'events' | 'experiments'
): Promise<PlanLimitResult> {
  const plan = await getOrgPlan(orgId);
  const limits = PLAN_LIMITS[plan];

  const db = getDb();

  switch (resource) {
    case 'sites': {
      const [result] = await db
        .select({ total: count() })
        .from(phase1Sites)
        .where(eq(phase1Sites.organizationId, orgId));
      const current = result?.total ?? 0;
      return {
        allowed: current < limits.sites,
        current,
        limit: limits.sites,
        plan,
      };
    }

    case 'events': {
      const period = currentPeriod();
      const [result] = await db
        .select({ total: zybitUsage.eventsIngested })
        .from(zybitUsage)
        .where(
          and(
            eq(zybitUsage.organizationId, orgId),
            eq(zybitUsage.period, period)
          )
        )
        .limit(1);
      const current = result?.total ?? 0;
      return {
        allowed: current < limits.eventsPerMonth,
        current,
        limit: limits.eventsPerMonth,
        plan,
      };
    }

    case 'experiments': {
      const [result] = await db
        .select({ total: count() })
        .from(zybitExperiments)
        .where(
          and(
            eq(zybitExperiments.organizationId, orgId),
            eq(zybitExperiments.status, 'running')
          )
        );
      const current = result?.total ?? 0;
      return {
        allowed: current < limits.concurrentExperiments,
        current,
        limit: limits.concurrentExperiments,
        plan,
      };
    }
  }
}
