import type { ConnectorProvider } from '@/lib/phase2/connectors/types';

export class SegmentConnectorError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SegmentConnectorError';
    this.code = code;
  }
}

/**
 * Resolves webhook auth — same convention as PostHog: env var NAME holds the
 * shared secret bearer token callers send in Authorization.
 */
export function resolveSegmentWebhookSecret(secretRef: string | null): string {
  if (!secretRef || secretRef.trim().length === 0) {
    throw new SegmentConnectorError('SEGMENT_SECRET_MISSING', 'Segment integration lacks secretRef.');
  }
  const fromEnv = process.env[secretRef];
  if (typeof fromEnv !== 'string' || fromEnv.trim().length === 0) {
    throw new SegmentConnectorError(
      'SEGMENT_SECRET_UNRESOLVED',
      `Missing or empty secret for env var "${secretRef}".`
    );
  }
  return fromEnv.trim();
}

export function assertSegmentProvider(provider: ConnectorProvider): void {
  if (provider !== 'segment') {
    throw new SegmentConnectorError('INTEGRATION_MISMATCH', `Expected segment integration, got "${provider}".`);
  }
}
