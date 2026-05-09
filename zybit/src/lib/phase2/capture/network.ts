/**
 * Network request log → summary.
 *
 * Wires up request/response Playwright listeners before navigation.
 * `summarize()` is called after page load to produce the network block
 * in PageCapture. Third-party domains are anything not on the site's
 * own hostname or its subdomains.
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

  const onRequest = (req: Request) => {
    if (records.length >= MAX_RECORDS) return;
    records.push({ url: req.url(), startTime: Date.now() });
  };

  const onResponse = (res: Response) => {
    // Find the most recent unresolved record matching this URL
    for (let i = records.length - 1; i >= 0; i--) {
      const r = records[i];
      if (r.url === res.url() && r.endTime === undefined) {
        r.endTime = Date.now();
        const cl = res.headers()['content-length'];
        if (cl) r.bytes = parseInt(cl, 10);
        break;
      }
    }
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
          if (
            hostname !== siteHostname &&
            !hostname.endsWith(`.${siteHostname}`)
          ) {
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
