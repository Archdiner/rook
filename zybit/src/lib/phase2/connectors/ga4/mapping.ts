/**
 * GA4 → CanonicalEvent mapping.
 *
 * GA4 event names differ from PostHog/Segment conventions:
 *   page_view          → page_view
 *   session_start      → session_start
 *   purchase           → purchase (maps to 'checkout_complete' canonical)
 *   add_to_cart        → add_to_cart
 *   begin_checkout     → checkout_start
 *   scroll             → scroll (deep scroll = engagement signal)
 *   click              → click (requires link_url dimension)
 *   form_submit        → form_submit
 *   search             → search
 *
 * TODO (Zybit-111): extend this map as more GA4 event types are observed in the wild.
 * TODO (Zybit-111): handle GA4 custom events (event names are arbitrary strings).
 */

import type { CanonicalEventInput } from '@/lib/phase2/types';
import type { GA4EventRow } from './types';

const GA4_EVENT_MAP: Record<string, string> = {
  page_view: 'page_view',
  session_start: 'session_start',
  purchase: 'checkout_complete',
  add_to_cart: 'add_to_cart',
  begin_checkout: 'checkout_start',
  form_submit: 'form_submit',
  search: 'search',
  scroll: 'scroll',
  click: 'click',
};

export function mapGA4Event(
  row: GA4EventRow,
  siteId: string,
): CanonicalEventInput | null {
  const type = GA4_EVENT_MAP[row.eventName];
  if (!type) return null; // skip unknown event types for now

  return {
    siteId,
    type,
    sessionId: row.sessionId,
    anonymousId: row.userId ?? undefined,
    path: row.pagePath ?? '/',
    occurredAt: row.timestamp,
    source: 'ga4' as const,
    properties: {
      originalEventName: row.eventName,
      ...(Object.fromEntries(
        Object.entries(row.dimensions).map(([k, v]) => [k, v]),
      ) as Record<string, string>),
    },
  };
}

export function mapGA4Events(
  rows: GA4EventRow[],
  siteId: string,
): CanonicalEventInput[] {
  return rows.flatMap((row) => {
    const mapped = mapGA4Event(row, siteId);
    return mapped ? [mapped] : [];
  });
}
