/**
 * Internal utilities shared across the Phase 2 design rules. Pure functions,
 * no I/O. Keep tone consistent with `phase2/rollups/helpers.ts` — small,
 * deterministic, easy to test individually.
 */

import type { CanonicalEvent } from "@/lib/phase2/types";
import type { CtaCandidate, PageSnapshot } from "@/lib/phase2/snapshots/types";

/** Lowercase + collapse whitespace for fuzzy text matching. */
export function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Reads a string value off `event.properties` defensively. Returns `null`
 * for missing values, non-strings, or empty strings (so callers can short
 * circuit with a single nullish check).
 */
export function readStringProp(
  props: CanonicalEvent["properties"],
  key: string,
): string | null {
  const v = props?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Match a CTA from a snapshot to a click/rage event. Tries text first,
 * then tag + class-token overlap, then a best-effort `cta_id` ⇄ `ref`
 * comparison. Returns the first matched `CtaCandidate` or `null`.
 */
export function matchCtaToEvent(
  snapshot: PageSnapshot,
  event: CanonicalEvent,
): CtaCandidate | null {
  const ctas = snapshot.data.ctas;
  if (ctas.length === 0) {
    return null;
  }

  // Strategy 1: text match (case-insensitive, whitespace-collapsed).
  const text =
    readStringProp(event.properties, "cta_text") ??
    readStringProp(event.properties, "rage_target_text");
  if (text !== null) {
    const wanted = normalizeText(text);
    if (wanted.length > 0) {
      for (const cta of ctas) {
        if (normalizeText(cta.text) === wanted) {
          return cta;
        }
      }
    }
  }

  // Strategy 2: same tag and overlapping class signals.
  const tag = readStringProp(event.properties, "element_tag");
  const classes = readStringProp(event.properties, "element_classes");
  if (tag !== null && classes !== null) {
    const eventTokens = tokenizeClassList(classes);
    if (eventTokens.size > 0) {
      for (const cta of ctas) {
        if (cta.tag !== tag) continue;
        const overlap = cta.visualWeightSignals.some((sig) => eventTokens.has(sig));
        if (overlap) {
          return cta;
        }
      }
    }
  }

  // Strategy 3: best-effort id ⇄ ref equality.
  const ctaId = readStringProp(event.properties, "cta_id");
  if (ctaId !== null) {
    for (const cta of ctas) {
      if (cta.ref === ctaId) {
        return cta;
      }
    }
  }

  return null;
}

/** Splits a class-attribute string into a Set of non-empty tokens. */
export function tokenizeClassList(value: string): Set<string> {
  const out = new Set<string>();
  for (const token of value.split(/\s+/)) {
    if (token.length > 0) {
      out.add(token);
    }
  }
  return out;
}

/**
 * Group an array by `key`, return entries sorted by count desc and then
 * key asc (deterministic tiebreaker).
 */
export function topByCount<T>(
  items: readonly T[],
  key: (t: T) => string,
): Array<{ key: string; items: T[]; count: number }> {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    let bucket = buckets.get(k);
    if (!bucket) {
      bucket = [];
      buckets.set(k, bucket);
    }
    bucket.push(item);
  }
  const out: Array<{ key: string; items: T[]; count: number }> = [];
  for (const [k, bucket] of buckets) {
    out.push({ key: k, items: bucket, count: bucket.length });
  }
  out.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.key.localeCompare(b.key);
  });
  return out;
}

/**
 * Share = `count / total`, rounded to 4 decimals. Returns `null` when
 * `total` is `0` so callers can opt out of emitting a finding.
 */
export function share(count: number, total: number): number | null {
  if (!Number.isFinite(count) || !Number.isFinite(total) || total <= 0) {
    return null;
  }
  return round(count / total, 4);
}

/**
 * Gini coefficient over a vector of non-negative bucket counts.
 * `0` = perfectly uniform; `1` = fully concentrated. Returns `0` for
 * degenerate inputs (empty array, all zeros).
 */
export function gini(counts: readonly number[]): number {
  const n = counts.length;
  if (n === 0) return 0;
  let sum = 0;
  for (const c of counts) {
    if (!Number.isFinite(c) || c < 0) return 0;
    sum += c;
  }
  if (sum === 0) return 0;
  const sorted = [...counts].sort((a, b) => a - b);
  let acc = 0;
  for (let i = 0; i < n; i += 1) {
    // i here is 0-indexed; the canonical formula uses 1-indexed i.
    acc += (2 * (i + 1) - n - 1) * sorted[i];
  }
  return acc / (n * sum);
}

/** Wrap text in backticks, or fall back to "(unnamed CTA)" when empty. */
export function quote(text: string | null | undefined): string {
  if (typeof text !== "string") return "(unnamed CTA)";
  const trimmed = text.trim();
  if (trimmed.length === 0) return "(unnamed CTA)";
  return `\`${trimmed}\``;
}

/** Cap a number to N decimal places, returned as a number. */
export function round(n: number, decimals: number): number {
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

/**
 * Format a 0..1 fraction as a percentage string with 0 or 1 decimal places —
 * `0.38` → `"38"`, `0.385` → `"38.5"`. Use as `${pct(x)}%` in summaries.
 */
export function pct(fraction: number): string {
  if (!Number.isFinite(fraction)) return "0";
  const v = fraction * 100;
  // Snap to integer when the fractional part is below half a tenth — keeps
  // copy clean (`38%` not `38.0%`) without mis-stating noisy ratios.
  if (Math.abs(v - Math.round(v)) < 0.05) {
    return String(Math.round(v));
  }
  return v.toFixed(1);
}

/** Format an integer count with locale separators (`1420` → `"1,420"`). */
export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString("en-US");
}

/** Clamp a number into the inclusive `[lo, hi]` range. */
export function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

/**
 * Lowercases, trims, and replaces runs of non-alphanumerics with `-`.
 * Returns `"_"` when the value collapses to nothing so finding ids stay
 * unique even on empty inputs.
 */
export function sanitizeIdSegment(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned : "_";
}

/** Reads `metrics.scrollPctNormalized` first, falling back to `metrics.scrollPct / 100`. */
export function readScrollFraction(event: CanonicalEvent): number | null {
  const norm = event.metrics?.scrollPctNormalized;
  if (typeof norm === "number" && Number.isFinite(norm)) {
    return norm;
  }
  const raw = event.metrics?.scrollPct;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw / 100;
  }
  return null;
}

/**
 * Picks the most common non-empty value of `properties[key]` in `events`.
 * Ties broken by lexicographic order. Returns `null` when no event carries
 * a usable value.
 */
export function modeStringProp(
  events: readonly CanonicalEvent[],
  key: string,
): string | null {
  const counts = new Map<string, number>();
  for (const event of events) {
    const v = readStringProp(event.properties, key);
    if (v === null) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  let best: { value: string; count: number } | null = null;
  for (const [value, count] of counts) {
    if (
      !best ||
      count > best.count ||
      (count === best.count && value.localeCompare(best.value) < 0)
    ) {
      best = { value, count };
    }
  }
  return best === null ? null : best.value;
}
