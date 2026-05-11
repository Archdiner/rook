/**
 * Full-page screenshot → Vercel Blob upload.
 *
 * Non-fatal: if BLOB_READ_WRITE_TOKEN is absent (local dev) or upload
 * fails, returns null. The capture artifact is still complete and usable
 * by rules — screenshots are for dashboard preview, not analysis.
 */

import { put } from '@vercel/blob';
import type { Page } from 'playwright-core';
import type { CaptureBreakpoint } from './types';

export async function captureScreenshot(
  page: Page,
  siteId: string,
  pathRef: string,
  breakpoint: CaptureBreakpoint,
  runId: string,
): Promise<string | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;

  try {
    const buffer = await page.screenshot({ type: 'png', fullPage: true, timeout: 10_000 });
    const safePathRef = pathRef.replace(/[^a-zA-Z0-9-]/g, '_').replace(/_+/g, '_');
    const filename = `captures/${siteId}/${safePathRef}/${breakpoint}/${runId}.png`;
    const { url } = await put(filename, buffer, { access: 'private', token });
    return url;
  } catch {
    return null;
  }
}
