/**
 * Fold-guess heuristic.
 *
 * v1 has no rendering pipeline, so we approximate "above the fold" from
 * landmark and document position. Downstream rules treat this as a hint,
 * not a claim — they soften copy when the guess is `uncertain`.
 */

import type { FoldGuess, PageLandmark } from './types';

export interface FoldGuessInput {
  landmark: PageLandmark;
  documentIndex: number;
  totalCandidates: number;
  bodyChildIndex: number;
  totalBodyChildren: number;
}

export function guessFold(input: FoldGuessInput): FoldGuess {
  if (input.landmark === 'header') return 'above';
  if (input.landmark === 'footer') return 'below';
  if (input.landmark === 'dialog') return 'uncertain';

  if (input.totalBodyChildren > 0) {
    const ratio = input.bodyChildIndex / input.totalBodyChildren;
    if (ratio <= 0.25) return 'above';
    if (ratio >= 0.75) return 'below';
  }

  if (input.documentIndex === 0) return 'above';
  return 'uncertain';
}
