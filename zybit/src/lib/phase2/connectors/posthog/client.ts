/**
 * PostHog HTTP client. The ONLY place network I/O lives in the connector.
 *
 * Guarantees:
 *   - 15s per-request timeout via `AbortController`, composed with caller signal.
 *   - Up to 3 retries on transient failures (429, 5xx, network/timeout) with
 *     exponential backoff: 200ms, 800ms, 2400ms. `Retry-After` honored on 429,
 *     capped at 30s.
 *   - Structured `PostHogConnectorError` for every failure path; no API key
 *     ever appears in an error message.
 *   - No mapping, no cursor logic, no persistence. Caller composes pagination.
 */

import { PostHogConnectorError } from "./errors";
import type { PostHogEventsPage } from "./types";

export interface ClientArgs {
  host: string;
  projectId: string;
  apiKey: string;
}

export interface FetchEventsArgs {
  /** ISO; PostHog returns events strictly after this. Optional. */
  after?: string;
  /** Pagination URL from a previous page's `next`. Mutually exclusive with `after`. */
  nextUrl?: string;
  /** Page size; clamped to 1..100. Defaults to 100. */
  limit?: number;
  /** AbortSignal forwarded to fetch. */
  signal?: AbortSignal;
}

const PER_REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRY_AFTER_MS = 30_000;
const RETRY_BACKOFFS_MS: ReadonlyArray<number> = [200, 800, 2400];
const DEFAULT_LIMIT = 100;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT;
  const rounded = Math.floor(limit);
  if (rounded < MIN_LIMIT) return MIN_LIMIT;
  if (rounded > MAX_LIMIT) return MAX_LIMIT;
  return rounded;
}

function validateHost(host: string): URL {
  if (typeof host !== "string" || host.trim().length === 0) {
    throw new PostHogConnectorError("POSTHOG_CONFIG", "PostHog host is required.");
  }
  let parsed: URL;
  try {
    parsed = new URL(host);
  } catch {
    throw new PostHogConnectorError("POSTHOG_CONFIG", "PostHog host must be a valid URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new PostHogConnectorError(
      "POSTHOG_CONFIG",
      "PostHog host must use http or https protocol.",
    );
  }
  return parsed;
}

function buildEventsUrl(client: ClientArgs, after: string | undefined, limit: number): string {
  const base = validateHost(client.host);
  const projectId = client.projectId.trim();
  const root = base.toString().replace(/\/+$/, "");
  let url = `${root}/api/projects/${encodeURIComponent(projectId)}/events/?limit=${limit}`;
  if (after !== undefined && after.length > 0) {
    url += `&after=${encodeURIComponent(after)}`;
  }
  return url;
}

function isEventsPage(value: unknown): value is PostHogEventsPage {
  if (value === null || typeof value !== "object") return false;
  const obj = value as { results?: unknown; next?: unknown; previous?: unknown };
  if (!Array.isArray(obj.results)) return false;
  if (obj.next !== undefined && obj.next !== null && typeof obj.next !== "string") return false;
  if (obj.previous !== undefined && obj.previous !== null && typeof obj.previous !== "string") {
    return false;
  }
  return true;
}

function parseRetryAfter(header: string | null): number | null {
  if (header === null) return null;
  const trimmed = header.trim();
  if (trimmed.length === 0) return null;
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }
  const target = Date.parse(trimmed);
  if (Number.isFinite(target)) {
    const delta = target - Date.now();
    return Math.min(Math.max(delta, 0), MAX_RETRY_AFTER_MS);
  }
  return null;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new PostHogConnectorError("POSTHOG_ABORT", "Request aborted by caller."));
      return;
    }
    let onAbort: (() => void) | null = null;
    const timer = setTimeout(() => {
      if (signal && onAbort) signal.removeEventListener("abort", onAbort);
      resolve();
    }, Math.max(0, ms));
    if (signal) {
      onAbort = () => {
        clearTimeout(timer);
        reject(new PostHogConnectorError("POSTHOG_ABORT", "Request aborted by caller."));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

/**
 * Performs ONE fetch with a 15s internal timeout. Composes the caller signal
 * with the timeout signal so either can cancel the request. Wraps non-HTTP
 * failures (network errors, aborts, timeouts) into `PostHogConnectorError`.
 */
async function performFetch(
  url: string,
  init: RequestInit,
  callerSignal: AbortSignal | undefined,
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(PER_REQUEST_TIMEOUT_MS);
  const composite =
    callerSignal !== undefined ? AbortSignal.any([timeoutSignal, callerSignal]) : timeoutSignal;

  try {
    return await fetch(url, { ...init, signal: composite });
  } catch (err) {
    if (callerSignal?.aborted) {
      throw new PostHogConnectorError("POSTHOG_ABORT", "Request aborted by caller.", { cause: err });
    }
    if (timeoutSignal.aborted) {
      throw new PostHogConnectorError(
        "POSTHOG_TIMEOUT",
        "Request to PostHog timed out after 15s.",
        { cause: err },
      );
    }
    throw new PostHogConnectorError(
      "POSTHOG_TIMEOUT",
      "Network error contacting PostHog.",
      { cause: err },
    );
  }
}

/** Performs ONE page request with retries. Caller composes pagination. */
export async function fetchPostHogEventsPage(
  client: ClientArgs,
  args: FetchEventsArgs,
): Promise<PostHogEventsPage> {
  if (typeof client.apiKey !== "string" || client.apiKey.trim().length === 0) {
    throw new PostHogConnectorError("POSTHOG_AUTH", "PostHog API key is empty.");
  }
  if (typeof client.projectId !== "string" || client.projectId.trim().length === 0) {
    throw new PostHogConnectorError("POSTHOG_CONFIG", "PostHog projectId is required.");
  }

  const limit = clampLimit(args.limit ?? DEFAULT_LIMIT);
  const url = args.nextUrl !== undefined && args.nextUrl.length > 0
    ? args.nextUrl
    : buildEventsUrl(client, args.after, limit);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${client.apiKey}`,
    Accept: "application/json",
  };

  let lastError: PostHogConnectorError | null = null;

  for (let attempt = 0; attempt <= RETRY_BACKOFFS_MS.length; attempt++) {
    if (args.signal?.aborted) {
      throw new PostHogConnectorError("POSTHOG_ABORT", "Request aborted by caller.");
    }

    let attemptError: PostHogConnectorError | null = null;
    let waitOverrideMs: number | null = null;

    try {
      const response = await performFetch(url, { method: "GET", headers }, args.signal);

      if (response.ok) {
        let bodyText: string;
        try {
          bodyText = await response.text();
        } catch (err) {
          throw new PostHogConnectorError(
            "POSTHOG_PARSE",
            "Failed to read PostHog response body.",
            { cause: err },
          );
        }
        let json: unknown;
        try {
          json = JSON.parse(bodyText);
        } catch (err) {
          throw new PostHogConnectorError(
            "POSTHOG_PARSE",
            "Failed to parse PostHog response as JSON.",
            { cause: err },
          );
        }
        if (!isEventsPage(json)) {
          throw new PostHogConnectorError(
            "POSTHOG_PARSE",
            "PostHog response missing required `results` array.",
          );
        }
        return json;
      }

      const status = response.status;
      try {
        await response.text();
      } catch {
        // ignore body drain failure
      }

      if (status === 401 || status === 403) {
        throw new PostHogConnectorError(
          "POSTHOG_AUTH",
          `PostHog rejected the API key (status ${status}).`,
          { status },
        );
      }
      if (status === 404) {
        throw new PostHogConnectorError(
          "POSTHOG_NOT_FOUND",
          "PostHog project or endpoint not found (status 404).",
          { status },
        );
      }
      if (status === 429) {
        waitOverrideMs = parseRetryAfter(response.headers.get("retry-after"));
        attemptError = new PostHogConnectorError(
          "POSTHOG_RATE_LIMIT",
          "PostHog rate limit exceeded (status 429).",
          { status },
        );
      } else if (status >= 500 && status < 600) {
        attemptError = new PostHogConnectorError(
          "POSTHOG_HTTP",
          `PostHog returned status ${status}.`,
          { status },
        );
      } else {
        // 400 and other non-retryable 4xx
        throw new PostHogConnectorError(
          "POSTHOG_HTTP",
          `PostHog returned status ${status}.`,
          { status, retryable: false },
        );
      }
    } catch (err) {
      if (err instanceof PostHogConnectorError) {
        if (!err.retryable) throw err;
        attemptError = err;
      } else {
        throw new PostHogConnectorError(
          "POSTHOG_HTTP",
          "Unexpected error contacting PostHog.",
          { cause: err },
        );
      }
    }

    if (attemptError === null) continue;
    lastError = attemptError;

    if (attempt >= RETRY_BACKOFFS_MS.length) {
      throw attemptError;
    }
    const waitMs = waitOverrideMs ?? RETRY_BACKOFFS_MS[attempt];
    await sleep(waitMs, args.signal);
  }

  throw lastError ?? new PostHogConnectorError(
    "POSTHOG_HTTP",
    "PostHog request exhausted retries.",
  );
}
