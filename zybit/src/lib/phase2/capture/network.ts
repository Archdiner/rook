/**
 * Network request log → summary.
 *
 * Wires up request/response Playwright listeners before navigation.
 * `summarize()` is called after page load to produce the network block
 * in PageCapture. Third-party domains are anything not on the site's
 * own hostname or its subdomains.
 *
 * Pending requests are tracked in a Map<url, RequestRecord[]> so each
 * response match is O(1) rather than O(N) over the full record array.
 * Multiple in-flight requests to the same URL are queued FIFO.
 */

import type { Page, Request, Response } from 'playwright-core';

export interface NetworkSummary {
  totalRequests: number;
  totalBytes: number;
  p95LatencyMs: number;
  thirdPartyDomains: string[];
}

interface RequestRecord {
  url: string;
  startTime: number;
  endTime?: number;
  bytes?: number;
}

const MAX_RECORDS = 1000;
const MAX_THIRD_PARTY = 50;

export function createNetworkLog(page: Page, siteHostname: string) {
  const records: RequestRecord[] = [];
  // url → FIFO queue of unresolved records for that URL
  const pending = new Map<string, RequestRecord[]>();

  const onRequest = (req: Request) => {
    if (records.length >= MAX_RECORDS) return;
    const record: RequestRecord = { url: req.url(), startTime: Date.now() };
    records.push(record);
    const queue = pending.get(record.url);
    if (queue) {
      queue.push(record);
    } else {
      pending.set(record.url, [record]);
    }
  };

  const onResponse = (res: Response) => {
    const url = res.url();
    const queue = pending.get(url);
    if (!queue?.length) return;
    // Dequeue the oldest pending record for this URL (FIFO)
    const record = queue.shift()!;
    if (queue.length === 0) pending.delete(url);
    record.endTime = Date.now();
    const cl = res.headers()['content-length'];
    if (cl) record.bytes = parseInt(cl, 10);
  };

  page.on('request', onRequest);
  page.on('response', onResponse);

  return {
    summarize(): NetworkSummary {
      const latencies = records
        .filter(r => r.endTime !== undefined)
        .map(r => r.endTime! - r.startTime)
        .sort((a, b) => a - b);

      const p95Idx = Math.max(0, Math.floor(latencies.length * 0.95) - 1);
      const p95LatencyMs = latencies[p95Idx] ?? 0;
      const totalBytes = records.reduce((sum, r) => sum + (r.bytes ?? 0), 0);

      const thirdPartySet = new Set<string>();
      for (const r of records) {
        try {
          const hostname = new URL(r.url).hostname;
          if (hostname !== siteHostname && !hostname.endsWith(`.${siteHostname}`)) {
            thirdPartySet.add(hostname);
          }
        } catch {
          // malformed URL — skip
        }
      }

      return {
        totalRequests: records.length,
        totalBytes,
        p95LatencyMs,
        thirdPartyDomains: Array.from(thirdPartySet).slice(0, MAX_THIRD_PARTY),
      };
    },

    cleanup() {
      page.off('request', onRequest);
      page.off('response', onResponse);
    },
  };
}
