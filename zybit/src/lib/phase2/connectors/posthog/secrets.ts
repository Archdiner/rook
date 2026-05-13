import { decryptSecret } from "@/lib/crypto/secrets";
import { PostHogConnectorError } from "./errors";

export function resolvePostHogSecret(
  secretRef: string | null,
  config?: Record<string, unknown>,
): string {
  // Self-service path: encrypted API key stored in integration config
  if (config?.apiKeyEncrypted && typeof config.apiKeyEncrypted === "string") {
    try {
      const decrypted = decryptSecret(config.apiKeyEncrypted);
      if (decrypted.length > 0) return decrypted;
    } catch {
      // fall through to env-var path
    }
  }

  if (!secretRef || secretRef.trim().length === 0) {
    throw new PostHogConnectorError(
      "POSTHOG_AUTH",
      "Integration has no secretRef or encrypted key configured.",
    );
  }
  const raw = process.env[secretRef.trim()];
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value.length === 0) {
    throw new PostHogConnectorError(
      "POSTHOG_AUTH",
      `Secret env var ${secretRef.trim()} is not set.`,
    );
  }
  return value;
}
