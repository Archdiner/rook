import type { Bucket } from '../bucketing';

export interface AssignmentEvent {
  experimentId: string;
  bucket: Bucket;
  visitorId: string;
  siteId: string;
  path: string;
  timestamp: string;
}

export async function logAssignment(
  baseUrl: string,
  event: AssignmentEvent,
): Promise<void> {
  try {
    const url = new URL('/api/proxy/assignment', baseUrl);
    await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch {
    // Never throw — assignment logging is best-effort.
  }
}
