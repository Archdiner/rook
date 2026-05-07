import type { Bucket } from '../bucketing';

export interface AssignmentEvent {
  experimentId: string;
  bucket: Bucket;
  visitorId: string;
  siteId: string;
  path: string;
  timestamp: string;
}

export function logAssignment(baseUrl: string, event: AssignmentEvent): void {
  try {
    const url = new URL('/api/proxy/assignment', baseUrl);
    void fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }).catch(() => {});
  } catch {
    // URL construction or fetch dispatch failed — never block the response
  }
}
