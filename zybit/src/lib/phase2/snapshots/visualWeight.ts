/**
 * Heuristic visual-weight scoring for CTA candidates.
 *
 * v1 is class-token based (Tailwind-friendly). It does not measure pixels;
 * downstream rules combine this signal with click-share to flag inversions
 * where the eye is pulled one way but clicks go another.
 */

import type { PageLandmark } from './types';

export interface VisualWeightInput {
  className: string | null;
  tag: 'a' | 'button';
  landmark: PageLandmark;
  ariaLabel: string | null;
  isPrimaryCandidate: boolean;
}

export interface VisualWeightResult {
  weight: number;
  signals: string[];
}

const TEXT_SIZE_TABLE: Array<readonly [string, number]> = [
  ['text-xs', 0.02],
  ['text-sm', 0.05],
  ['text-base', 0.08],
  ['text-lg', 0.12],
  ['text-xl', 0.16],
  ['text-2xl', 0.22],
  ['text-3xl', 0.28],
  ['text-4xl', 0.34],
  ['text-5xl', 0.4],
  ['text-6xl', 0.46],
  // text-7xl and larger — same ceiling per spec
  ['text-7xl', 0.52],
  ['text-8xl', 0.52],
  ['text-9xl', 0.52],
];

const BG_EXACT = new Set(['bg-primary', 'bg-black', 'bg-white']);
const BG_PREFIXES = ['bg-blue-', 'bg-indigo-', 'bg-violet-', 'bg-emerald-', 'bg-orange-', 'bg-red-'];

const STRONG_FONT_WEIGHTS = new Set(['font-bold', 'font-extrabold', 'font-black']);
const MEDIUM_FONT_WEIGHTS = new Set(['font-semibold']);

const BORDER_TOKENS = new Set(['border-2', 'border-4', 'ring-2', 'ring-4']);
const PADDING_TOKENS = new Set(['px-6', 'px-8', 'px-10', 'py-4', 'py-6', 'py-8']);
const ROUNDED_TOKENS = new Set(['rounded-full', 'rounded-2xl', 'rounded-3xl']);

function tokenize(className: string | null): string[] {
  if (!className) return [];
  return className.split(/\s+/).filter(Boolean);
}

function bgMatches(token: string): boolean {
  if (BG_EXACT.has(token)) return true;
  return BG_PREFIXES.some((prefix) => token.startsWith(prefix));
}

function landmarkBonus(landmark: PageLandmark): number {
  switch (landmark) {
    case 'header':
    case 'main':
      return 0.15;
    case 'nav':
      return 0.05;
    case 'aside':
      return -0.05;
    case 'footer':
      return -0.1;
    default:
      return 0;
  }
}

function pickHighestTextSize(tokens: string[]): { token: string; value: number } | null {
  let best: { token: string; value: number } | null = null;
  for (const tok of tokens) {
    const entry = TEXT_SIZE_TABLE.find(([name]) => name === tok);
    if (!entry) continue;
    if (!best || entry[1] > best.value) {
      best = { token: tok, value: entry[1] };
    }
  }
  return best;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function scoreVisualWeight(input: VisualWeightInput): VisualWeightResult {
  const tokens = tokenize(input.className);
  const signals: string[] = [];
  let weight = 0;

  // Tag base.
  weight += input.tag === 'button' ? 0.2 : 0.1;
  signals.push(`tag:${input.tag}`);

  // Landmark contribution (always emit a signal so explanations stay legible).
  const lb = landmarkBonus(input.landmark);
  weight += lb;
  if (lb !== 0) signals.push(`landmark:${input.landmark}`);

  // Text size — single best contributor.
  const ts = pickHighestTextSize(tokens);
  if (ts) {
    weight += ts.value;
    signals.push(ts.token);
  }

  // Background hint — additive once even if multiple bg tokens are present.
  const bgHits = tokens.filter(bgMatches);
  if (bgHits.length > 0) {
    weight += 0.1;
    for (const t of bgHits) signals.push(t);
  }

  // Font weight — strong tier wins; otherwise medium tier.
  const strongHits = tokens.filter((t) => STRONG_FONT_WEIGHTS.has(t));
  const mediumHits = tokens.filter((t) => MEDIUM_FONT_WEIGHTS.has(t));
  if (strongHits.length > 0) {
    weight += 0.08;
    for (const t of strongHits) signals.push(t);
  } else if (mediumHits.length > 0) {
    weight += 0.04;
    for (const t of mediumHits) signals.push(t);
  }

  const borderHits = tokens.filter((t) => BORDER_TOKENS.has(t));
  if (borderHits.length > 0) {
    weight += 0.04;
    for (const t of borderHits) signals.push(t);
  }

  const paddingHits = tokens.filter((t) => PADDING_TOKENS.has(t));
  if (paddingHits.length > 0) {
    weight += 0.04;
    for (const t of paddingHits) signals.push(t);
  }

  const roundedHits = tokens.filter((t) => ROUNDED_TOKENS.has(t));
  if (roundedHits.length > 0) {
    weight += 0.03;
    for (const t of roundedHits) signals.push(t);
  }

  if (input.isPrimaryCandidate) {
    weight += 0.1;
    signals.push('primary-candidate');
  }

  if (input.ariaLabel && input.ariaLabel.length > 0) {
    weight += 0.02;
    signals.push('aria-label');
  }

  return { weight: round3(clamp01(weight)), signals };
}
