/**
 * PostHog API DTOs (the subset Zybit actually uses) and connector config.
 * Source: https://posthog.com/docs/api/events
 */

export type PostHogHost = string;

export interface PostHogConnectorConfig {
  /** Full origin, e.g. "https://us.posthog.com" or self-hosted "https://ph.example.com". */
  host: PostHogHost;
  /** PostHog project id that owns the events. */
  projectId: string;
  /** Optional hard cap on events per sync run; defaults to 5000. */
  maxEventsPerSync?: number;
}

/** Wire shape returned by `GET /api/projects/:id/events/`. */
export interface PostHogEventDTO {
  id?: string;
  uuid?: string;
  event: string;
  timestamp: string;
  distinct_id?: string;
  person?: { distinct_id?: string };
  properties?: Record<string, unknown>;
  elements_chain?: string;
}

export interface PostHogEventsPage {
  results: PostHogEventDTO[];
  next?: string | null;
  previous?: string | null;
}

export interface PostHogCursor {
  /** ISO timestamp of the last event we processed; we resume strictly after it. */
  lastTimestamp: string | null;
  /** UUID of the last event for tie-breaking on identical timestamps. */
  lastUuid: string | null;
}

export type PostHogEventName =
  | "$pageview"
  | "$pageleave"
  | "$autocapture"
  | "$rageclick"
  | "$session_recording_started"
  | (string & {});
