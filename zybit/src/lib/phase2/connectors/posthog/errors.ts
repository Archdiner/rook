/**
 * Structured error class for the PostHog connector. The `code` discriminant
 * lets callers branch on intent (auth, rate-limit, parse, ...) without
 * pattern-matching on free-form messages. Error messages MUST NEVER include
 * the API key or any other secret.
 */

export type PostHogErrorCode =
  | "POSTHOG_AUTH"
  | "POSTHOG_NOT_FOUND"
  | "POSTHOG_RATE_LIMIT"
  | "POSTHOG_HTTP"
  | "POSTHOG_TIMEOUT"
  | "POSTHOG_PARSE"
  | "POSTHOG_CONFIG"
  | "POSTHOG_ABORT";

export interface PostHogConnectorErrorOptions {
  status?: number;
  retryable?: boolean;
  cause?: unknown;
}

const NON_RETRYABLE_DEFAULT: ReadonlySet<PostHogErrorCode> = new Set<PostHogErrorCode>([
  "POSTHOG_AUTH",
  "POSTHOG_NOT_FOUND",
  "POSTHOG_PARSE",
  "POSTHOG_CONFIG",
  "POSTHOG_ABORT",
]);

export class PostHogConnectorError extends Error {
  public readonly code: PostHogErrorCode;
  public readonly status?: number;
  public readonly retryable: boolean;

  constructor(
    code: PostHogErrorCode,
    message: string,
    opts: PostHogConnectorErrorOptions = {},
  ) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "PostHogConnectorError";
    this.code = code;
    this.status = opts.status;
    this.retryable = opts.retryable ?? !NON_RETRYABLE_DEFAULT.has(code);
  }
}
