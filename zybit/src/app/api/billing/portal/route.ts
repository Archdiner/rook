/**
 * POST /api/billing/portal
 *
 * Creates a Stripe Customer Portal session so the user can manage
 * their subscription (change plan, update payment, cancel).
 */

import { resolveZybitActor } from '@/lib/auth/actor';
import { getStripe, getOrCreateStripeCustomer } from '@/lib/billing/stripe';
import { mapRouteError, success } from '@/app/api/phase1/_shared';

export async function POST(request: Request) {
  try {
    const actorResult = await resolveZybitActor(request);
    if (!actorResult.ok) return actorResult.response;

    const orgId = actorResult.actor.organizationId;
    const customerId = await getOrCreateStripeCustomer(orgId);
    const stripe = getStripe();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/dashboard/settings`,
    });

    return success({ url: portalSession.url });
  } catch (error) {
    return mapRouteError(error);
  }
}
