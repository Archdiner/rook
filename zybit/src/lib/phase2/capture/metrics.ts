/**
 * Web performance metrics via PerformanceObserver.
 *
 * Reads buffered LCP + CLS entries (already collected during navigation)
 * plus TTFB from Navigation Timing. INP is headless-unreliable so always null.
 * Waits 800 ms for observer callbacks to finish flushing.
 */

import type { Page } from 'playwright-core';

export interface PerformanceMetrics {
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  ttfbMs: number | null;
}

export async function extractMetrics(page: Page): Promise<PerformanceMetrics> {
  return page.evaluate(
    (): Promise<{
      lcpMs: number | null;
      inpMs: number | null;
      cls: number | null;
      ttfbMs: number | null;
    }> =>
      new Promise(resolve => {
        const result = { lcpMs: null as number | null, inpMs: null, cls: null as number | null, ttfbMs: null as number | null };

        // TTFB: synchronous read from Navigation Timing
        try {
          const [nav] = performance.getEntriesByType(
            'navigation',
          ) as PerformanceNavigationTiming[];
          if (nav) result.ttfbMs = Math.round(nav.responseStart);
        } catch {}

        let lcpValue: number | null = null;
        let clsTotal = 0;
        let lcpObs: PerformanceObserver | undefined;
        let clsObs: PerformanceObserver | undefined;

        try {
          lcpObs = new PerformanceObserver(list => {
            const entries = list.getEntries();
            if (entries.length > 0)
              lcpValue = Math.round(entries[entries.length - 1].startTime);
          });
          lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });
        } catch {}

        try {
          clsObs = new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
              const shift = entry as PerformanceEntry & {
                value: number;
                hadRecentInput: boolean;
              };
              if (!shift.hadRecentInput) clsTotal += shift.value;
            }
          });
          clsObs.observe({ type: 'layout-shift', buffered: true });
        } catch {}

        setTimeout(() => {
          lcpObs?.disconnect();
          clsObs?.disconnect();
          result.lcpMs = lcpValue;
          result.cls = Math.round(clsTotal * 10000) / 10000;
          resolve(result);
        }, 800);
      }),
  );
}
