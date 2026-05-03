/**
 * Plan definitions and limits for Zybit billing tiers.
 */

export type PlanId = 'starter' | 'growth' | 'scale' | 'enterprise';

export interface PlanLimits {
  sites: number;
  eventsPerMonth: number;
  concurrentExperiments: number;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  starter:    { sites: 1,  eventsPerMonth: 100_000,   concurrentExperiments: 2 },
  growth:     { sites: 3,  eventsPerMonth: 500_000,   concurrentExperiments: 10 },
  scale:      { sites: 10, eventsPerMonth: 2_000_000, concurrentExperiments: Infinity },
  enterprise: { sites: Infinity, eventsPerMonth: Infinity, concurrentExperiments: Infinity },
} as const;

export const PLAN_DISPLAY: Record<PlanId, { name: string; price: string; priceNote: string; support: string }> = {
  starter:    { name: 'Starter',    price: '$199',   priceNote: '/mo', support: 'Email' },
  growth:     { name: 'Growth',     price: '$599',   priceNote: '/mo', support: 'Slack' },
  scale:      { name: 'Scale',      price: '$1,499', priceNote: '/mo', support: 'Dedicated' },
  enterprise: { name: 'Enterprise', price: 'Custom', priceNote: '',    support: 'SLA' },
};

export const PLAN_IDS: PlanId[] = ['starter', 'growth', 'scale', 'enterprise'];

export function isValidPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && PLAN_IDS.includes(value as PlanId);
}

/**
 * Map Stripe Price IDs (from env) back to plan tier.
 */
export function planIdFromStripePriceId(priceId: string): PlanId | null {
  const mapping: Record<string, PlanId> = {};
  if (process.env.STRIPE_PRICE_STARTER) mapping[process.env.STRIPE_PRICE_STARTER] = 'starter';
  if (process.env.STRIPE_PRICE_GROWTH) mapping[process.env.STRIPE_PRICE_GROWTH] = 'growth';
  if (process.env.STRIPE_PRICE_SCALE) mapping[process.env.STRIPE_PRICE_SCALE] = 'scale';
  return mapping[priceId] ?? null;
}

/**
 * Get the Stripe Price ID for a plan tier.
 */
export function stripePriceIdForPlan(planId: PlanId): string | null {
  const envMap: Record<string, string | undefined> = {
    starter: process.env.STRIPE_PRICE_STARTER,
    growth: process.env.STRIPE_PRICE_GROWTH,
    scale: process.env.STRIPE_PRICE_SCALE,
  };
  return envMap[planId] ?? null;
}

export function formatLimit(value: number): string {
  if (value === Infinity) return 'Unlimited';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}K`;
  return value.toString();
}
