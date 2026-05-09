/**
 * Viewport + fold extraction.
 *
 * The fold is the bottom of the first viewport — the boundary below which
 * a visitor must scroll to see content. Rules compare `bbox.y < foldY`
 * for a precise above/below-fold classification, replacing the heuristic
 * `foldGuess` field produced by the static parser.
 */

import type { Page } from 'playwright-core';

export interface FoldData {
  viewportPx: { w: number; h: number };
  /** Y-coordinate (document-absolute, px) of the first-viewport bottom edge. */
  foldY: number;
}

export async function extractLayout(page: Page): Promise<FoldData> {
  const data = await page.evaluate(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
    scrollY: window.scrollY,
  }));
  return {
    viewportPx: { w: data.w, h: data.h },
    foldY: data.h + data.scrollY,
  };
}
