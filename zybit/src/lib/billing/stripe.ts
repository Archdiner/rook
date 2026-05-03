/**
 * Stripe client singleton and customer helpers.
 */

import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { organizations } from '@/lib/db/schema';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set.');

  stripeInstance = new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
  return stripeInstance;
}

/**
 * Get or create a Stripe Customer for an organization.
 * Persists the customer ID back to the organizations table.
 */
export async function getOrCreateStripeCustomer(orgId: string): Promise<string> {
  const db = getDb();
  const [org] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      stripeCustomerId: organizations.stripeCustomerId,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  if (!org) throw new Error(`Organization not found: ${orgId}`);

  if (org.stripeCustomerId) return org.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    metadata: { orgId },
    name: org.name,
  });

  await db
    .update(organizations)
    .set({ stripeCustomerId: customer.id })
    .where(eq(organizations.id, orgId));

  return customer.id;
}
