/**
 * Internal utilities shared across the Phase 2 rollup builders. These are not
 * part of the public barrel but live alongside the builders for cohesion.
 */

import type { CanonicalEvent, Phase2SiteConfig } from "@/lib/phase2/types";

const DEFAULT_CONVERSION_EVENT_TYPES: readonly string[] = [
  "purchase",
  "conversion",
  "order_completed",
  "checkout_complete",
  "subscription_convert",
];

/**
 * Resolves the conversion event-type set for a site: the Zybit default set
 * union the per-site override list. Returned set is independent from `config`
 * so callers can mutate it safely.
 */
export function resolveConversionTypes(config: Phase2SiteConfig): Set<string> {
  const set = new Set<string>(DEFAULT_CONVERSION_EVENT_TYPES);
  const overrides = config.conversionEventTypes ?? [];
  for (const t of overrides) {
    if (typeof t === "string" && t.trim().length > 0) {
      set.add(t);
    }
  }
  return set;
}

/**
 * Treats an event as a conversion if its `type` is in the conversion set or
 * its `metrics.conversion` is a positive finite number (mirrors the Phase 1
 * readiness pattern in `computeReadinessSnapshot.ts`).
 */
export function isConversion(
  event: CanonicalEvent,
  conversionTypes: Set<string>,
): boolean {
  if (conversionTypes.has(event.type)) {
    return true;
  }
  const conversion = event.metrics?.conversion;
  return typeof conversion === "number" && Number.isFinite(conversion) && conversion > 0;
}

/** Treats an event as a rage signal when type is `rage_click` or `metrics.rage > 0`. */
export function isRage(event: CanonicalEvent): boolean {
  if (event.type === "rage_click") {
    return true;
  }
  const rage = event.metrics?.rage;
  return typeof rage === "number" && Number.isFinite(rage) && rage > 0;
}

/** Returns deduped non-empty values sorted by `localeCompare` ascending. */
export function uniqueSorted(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) {
      continue;
    }
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * Lowercases, trims and replaces runs of non-alphanumerics with `-` to
 * produce stable id segments. Returns an empty string when the value
 * collapses to nothing — callers must decide how to handle that.
 */
export function sanitizeIdSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
