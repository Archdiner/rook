/**
 * Post-hydration DOM serialization.
 *
 * Captures the rendered outerHTML after JS has settled — the signal
 * the rule engine actually needs, not the server-sent skeleton.
 */

import type { Page } from 'playwright-core';

/** 2 MB cap — keeps the artifact manageable while capturing >99% of real sites. */
const RENDERED_HTML_MAX_BYTES = 2 * 1024 * 1024;

export async function extractRenderedHtml(
  page: Page,
): Promise<{ html: string; byteSize: number }> {
  const raw = await page.content();
  const encoder = new TextEncoder();
  const bytes = encoder.encode(raw);

  if (bytes.length <= RENDERED_HTML_MAX_BYTES) {
    return { html: raw, byteSize: bytes.length };
  }

  const decoder = new TextDecoder('utf-8');
  const truncated = decoder.decode(bytes.slice(0, RENDERED_HTML_MAX_BYTES));
  return { html: truncated, byteSize: RENDERED_HTML_MAX_BYTES };
}
