export class GA4ConnectorError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'GA4ConnectorError';
  }
}
