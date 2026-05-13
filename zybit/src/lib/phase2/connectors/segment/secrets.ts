import type { ConnectorProvider } from '@/lib/phase2/connectors/types';

export class SegmentConnectorError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SegmentConnectorError';
    this.code = code;
  }
}

import { decryptSecret } from '@/lib/crypto/secrets';

export function resolveSegmentWebhookSecret(
  secretRef: string | null,
  config?: Record<string, unknown>,
): string {
  // Self-service path: encrypted bearer token stored in integration config
  if (config?.apiKeyEncrypted && typeof config.apiKeyEncrypted === 'string') {
    try {
      const decrypted = decryptSecret(config.apiKeyEncrypted);
      if (decrypted.length > 0) return decrypted;
    } catch {
      // fall through to env-var path
    }
  }

  if (!secretRef || secretRef.trim().length === 0) {
    throw new SegmentConnectorError('SEGMENT_SECRET_MISSING', 'Segment integration lacks secretRef or encrypted key.');
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
