/**
 * Post-hydration DOM serialization.
 *
 * Captures the rendered outerHTML after JS has settled — the signal
 * the rule engine actually needs, not the server-sent skeleton.
 */

import type { Page } from 'playwright-core';
import { logger } from '@/lib/observability';

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

  logger.warn('capture.dom.truncated', {
    service: 'capture-record',
    originalBytes: bytes.length,
    limitBytes: RENDERED_HTML_MAX_BYTES,
    url: page.url(),
  });

  // TextDecoder handles incomplete multi-byte sequences gracefully (replacement char).
  // Trim to the last '>' so we don't hand the parser a split tag — open text nodes
  // after the cutoff are benign, but a half-written attribute is not.
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let truncated = decoder.decode(bytes.slice(0, RENDERED_HTML_MAX_BYTES));
  const lastTag = truncated.lastIndexOf('>');
  if (lastTag > 0) truncated = truncated.slice(0, lastTag + 1);

  return { html: truncated, byteSize: bytes.length };
}
