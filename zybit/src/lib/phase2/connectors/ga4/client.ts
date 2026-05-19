/**
 * GA4 Data API client.
 *
 * Calls the Google Analytics Data API v1beta `runReport` endpoint.
 * Auth: Google service account via a JWT bearer token.
 *
 * TODO (Zybit-110): implement service-account JWT signing.
 *   Option A: `google-auth-library` package (adds ~200kB to bundle).
 *   Option B: manual JWT with the Web Crypto API (zero deps, works in edge).
 *   Recommended: Option B — sign the JWT with crypto.subtle.importKey + sign,
 *   then exchange for an access token via the Google OAuth2 token endpoint.
 *   Reference: https://developers.google.com/identity/protocols/oauth2/service-account
 *
 * TODO (Zybit-110): handle pagination — GA4 runReport returns up to 100k rows;
 *   use `offset` + `limit` parameters and loop until rowCount is reached.
 */

import { GA4ConnectorError } from './errors';
import type { GA4EventRow } from './types';

const GA4_API_BASE = 'https://analyticsdata.googleapis.com/v1beta';

/** Minimal JWT claim set for Google service account auth. */
interface JwtClaims {
  iss: string;   // service account email
  scope: string; // 'https://www.googleapis.com/auth/analytics.readonly'
  aud: string;   // 'https://oauth2.googleapis.com/token'
  iat: number;
  exp: number;
}

/**
 * Exchange a service account key JSON for a short-lived access token.
 *
 * TODO (Zybit-110): implement. Currently throws to force a clear error at
 * integration time rather than silently returning empty results.
 */
async function getAccessToken(_serviceAccountKeyJson: string): Promise<string> {
  // TODO: parse service account JSON, sign JWT with crypto.subtle, exchange for token.
  throw new GA4ConnectorError(
    'NOT_IMPLEMENTED',
    'GA4 service-account auth is not yet implemented. See client.ts TODO (Zybit-110).',
  );
}

/**
 * Fetch one page of events from the GA4 Data API.
 *
 * TODO (Zybit-110): implement after getAccessToken is done.
 */
export async function fetchGA4EventsPage(
  _propertyId: string,
  _afterTimestamp: string,
  _accessToken: string,
): Promise<GA4EventRow[]> {
  // TODO: POST to `${GA4_API_BASE}/${propertyId}:runReport`
  //   dimensions: eventName, sessionId, userId (if available), pagePath, date, hour, minute
  //   metrics: eventCount (to detect rows)
  //   dateRanges: [ { startDate: afterTimestamp (YYYY-MM-DD), endDate: 'today' } ]
  //   dimensionFilter: filter out internal traffic if needed
  //
  // Map response rows to GA4EventRow[].
  // Sort by timestamp ascending for cursor correctness.
  //
  // Note: GA4 runReport aggregates by default — individual session-level events
  // require the raw-events export (BigQuery sink) or the Real-Time API.
  // For first-pass, use aggregated page-level data and approximate sessions.
  //
  // TODO (Zybit-112): evaluate switching to GA4 → BigQuery export for raw events.

  void GA4_API_BASE;
  throw new GA4ConnectorError(
    'NOT_IMPLEMENTED',
    'GA4 event fetch is not yet implemented. See client.ts TODO (Zybit-110).',
  );
}

export { getAccessToken };
export type { JwtClaims };
