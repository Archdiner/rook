/**
 * Resolves the PostHog API key from `process.env` using the integration's
 * declared `secretRef`. The resolved value is never logged. Failures throw a
 * typed `PostHogConnectorError` so the route layer can map them to a 401
 * response without leaking the key name into the response body.
 */

import { PostHogConnectorError } from "./errors";

export function resolvePostHogSecret(secretRef: string | null): string {
  if (secretRef === null || secretRef === undefined) {
    throw new PostHogConnectorError(
      "POSTHOG_AUTH",
      "Integration has no secretRef configured.",
    );
  }
  const ref = secretRef.trim();
  if (ref.length === 0) {
    throw new PostHogConnectorError(
      "POSTHOG_AUTH",
      "Integration has no secretRef configured.",
    );
  }
  const raw = process.env[ref];
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value.length === 0) {
    throw new PostHogConnectorError(
      "POSTHOG_AUTH",
      `Secret env var ${ref} is not set.`,
    );
  }
  return value;
}
